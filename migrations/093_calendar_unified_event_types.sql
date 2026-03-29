-- migrations/093_calendar_unified_event_types.sql
-- Extend calendar.events to support unified event types

-- Add event_type enum
DO $$ BEGIN
    CREATE TYPE calendar.event_type AS ENUM ('event', 'task', 'leave', 'shift', 'booking', 'milestone', 'blocker', 'cron');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE calendar.event_scope AS ENUM ('personal', 'team', 'org');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE calendar.event_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE calendar.event_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE calendar.leave_type AS ENUM ('cp', 'rtt', 'sick', 'unpaid', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE calendar.presence_mode AS ENUM ('office', 'remote', 'absent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE calendar.energy_level AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend events table
ALTER TABLE calendar.events
    ADD COLUMN IF NOT EXISTS event_type calendar.event_type DEFAULT 'event',
    ADD COLUMN IF NOT EXISTS scope calendar.event_scope DEFAULT 'personal',
    ADD COLUMN IF NOT EXISTS status calendar.event_status DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS priority calendar.event_priority DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS parent_event_id UUID REFERENCES calendar.events(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS resource_id UUID REFERENCES calendar.resources(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS category_id UUID,
    ADD COLUMN IF NOT EXISTS leave_type calendar.leave_type DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS presence_mode calendar.presence_mode DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS approval_by UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS approval_comment TEXT,
    ADD COLUMN IF NOT EXISTS energy_level calendar.energy_level DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS cron_expression TEXT,
    ADD COLUMN IF NOT EXISTS cron_target TEXT,
    ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS project_id UUID,
    ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Indexes for new fields
CREATE INDEX IF NOT EXISTS idx_events_event_type ON calendar.events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_scope ON calendar.events(scope);
CREATE INDEX IF NOT EXISTS idx_events_status ON calendar.events(status);
CREATE INDEX IF NOT EXISTS idx_events_leave_type ON calendar.events(leave_type) WHERE event_type = 'leave';
CREATE INDEX IF NOT EXISTS idx_events_assigned_to ON calendar.events(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_resource_id ON calendar.events(resource_id) WHERE resource_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_category_id ON calendar.events(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_parent ON calendar.events(parent_event_id) WHERE parent_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_project ON calendar.events(project_id) WHERE project_id IS NOT NULL;
