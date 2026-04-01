-- migrations/098_migrate_scheduling_to_calendar.sql
-- Migrate scheduling schema data → calendar schema
-- signapps-scheduler is being absorbed into signapps-calendar.
-- This migration is idempotent (INSERT ... ON CONFLICT DO NOTHING).
-- Wrapped in a DO $$ block so it silently skips if the scheduling schema
-- was never created (e.g. fresh installs that never ran migration 034).

DO $$
BEGIN

-- ============================================================================
-- 1. Migrate scheduling.resources → calendar.resources
--    Deduplicate by name: skip rows whose name already exists.
-- ============================================================================
IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'scheduling' AND table_name = 'resources'
) THEN
    INSERT INTO calendar.resources (id, name, resource_type, description, capacity, location, is_available, created_at, updated_at)
    SELECT
        sr.id,
        sr.name,
        sr.resource_type,
        sr.description,
        sr.capacity,
        sr.location,
        sr.is_active,
        sr.created_at,
        sr.updated_at
    FROM scheduling.resources sr
    WHERE NOT EXISTS (
        SELECT 1 FROM calendar.resources cr WHERE cr.name = sr.name
    )
    ON CONFLICT (id) DO NOTHING;
END IF;

-- ============================================================================
-- 2. Migrate scheduling.time_items → calendar.events
--    Scope mapping:  moi → personal | eux → team | nous → org
--    Item-type → event_type: task|event|booking|shift|milestone|blocker kept
--    as-is (they exist in calendar.event_type enum); 'reminder' → 'event'.
--    Status mapping: todo → draft | in_progress → pending | done → completed
--    | cancelled → rejected | pending → pending | confirmed → approved.
--
--    We need a calendar to attach these events to. We use the owner's
--    first calendar, or create a "Migrated from Scheduler" calendar if none
--    exists.
-- ============================================================================
IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'scheduling' AND table_name = 'time_items'
) THEN

    -- Ensure every owner has at least one calendar before inserting
    INSERT INTO calendar.calendars (owner_id, name, description, timezone, color, is_shared)
    SELECT DISTINCT ti.owner_id, 'Migré depuis Scheduler', 'Calendrier créé lors de la migration 098', 'UTC', '#6366f1', false
    FROM scheduling.time_items ti
    WHERE NOT EXISTS (
        SELECT 1 FROM calendar.calendars c WHERE c.owner_id = ti.owner_id
    );

    INSERT INTO calendar.events (
        id,
        calendar_id,
        title,
        description,
        start_time,
        end_time,
        timezone,
        is_all_day,
        created_by,
        event_type,
        scope,
        status,
        priority,
        resource_id,
        project_id,
        tags,
        created_at,
        updated_at
    )
    SELECT
        ti.id,
        -- Resolve target calendar: owner's first calendar
        (SELECT c.id
         FROM calendar.calendars c
         WHERE c.owner_id = ti.owner_id
         ORDER BY c.created_at
         LIMIT 1),
        ti.title,
        ti.description,
        COALESCE(ti.start_time, NOW()),
        COALESCE(ti.end_time, COALESCE(ti.start_time, NOW()) + INTERVAL '1 hour'),
        ti.timezone,
        ti.all_day,
        ti.created_by,
        -- event_type mapping
        CASE ti.item_type
            WHEN 'task'        THEN 'task'::calendar.event_type
            WHEN 'event'       THEN 'event'::calendar.event_type
            WHEN 'booking'     THEN 'booking'::calendar.event_type
            WHEN 'shift'       THEN 'shift'::calendar.event_type
            WHEN 'milestone'   THEN 'milestone'::calendar.event_type
            WHEN 'blocker'     THEN 'blocker'::calendar.event_type
            ELSE               'event'::calendar.event_type
        END,
        -- scope mapping
        CASE ti.scope
            WHEN 'moi'  THEN 'personal'::calendar.event_scope
            WHEN 'eux'  THEN 'team'::calendar.event_scope
            WHEN 'nous' THEN 'org'::calendar.event_scope
            ELSE        'personal'::calendar.event_scope
        END,
        -- status mapping
        CASE ti.status
            WHEN 'todo'        THEN 'draft'::calendar.event_status
            WHEN 'in_progress' THEN 'pending'::calendar.event_status
            WHEN 'done'        THEN 'completed'::calendar.event_status
            WHEN 'cancelled'   THEN 'rejected'::calendar.event_status
            WHEN 'pending'     THEN 'pending'::calendar.event_status
            WHEN 'confirmed'   THEN 'approved'::calendar.event_status
            ELSE               NULL
        END,
        -- priority mapping (same values, cast to enum)
        CASE ti.priority
            WHEN 'low'    THEN 'low'::calendar.event_priority
            WHEN 'medium' THEN 'medium'::calendar.event_priority
            WHEN 'high'   THEN 'high'::calendar.event_priority
            WHEN 'urgent' THEN 'urgent'::calendar.event_priority
            ELSE          NULL
        END,
        -- resource_id: only keep if the resource was migrated above
        CASE WHEN EXISTS (SELECT 1 FROM calendar.resources cr WHERE cr.id = ti.resource_id)
             THEN ti.resource_id
             ELSE NULL
        END,
        ti.project_id,
        ti.tags,
        ti.created_at,
        ti.updated_at
    FROM scheduling.time_items ti
    WHERE ti.deleted_at IS NULL
    ON CONFLICT (id) DO NOTHING;
END IF;

-- ============================================================================
-- 3. Migrate scheduling.time_item_users → calendar.event_attendees
--    Only for events that were successfully migrated in step 2.
-- ============================================================================
IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'scheduling' AND table_name = 'time_item_users'
) THEN
    INSERT INTO calendar.event_attendees (id, event_id, user_id, rsvp_status, created_at)
    SELECT
        tiu.id,
        tiu.time_item_id,
        tiu.user_id,
        COALESCE(tiu.rsvp_status, 'pending'),
        tiu.created_at
    FROM scheduling.time_item_users tiu
    WHERE EXISTS (
        SELECT 1 FROM calendar.events ce WHERE ce.id = tiu.time_item_id
    )
    ON CONFLICT (id) DO NOTHING;
END IF;

-- ============================================================================
-- 4. Mark scheduling schema as deprecated
-- ============================================================================
COMMENT ON SCHEMA scheduling IS
    'DEPRECATED as of migration 098 (2026-03-30). '
    'Data migrated to calendar schema. '
    'Schema retained for reference only — do not write new data here.';

END $$;
