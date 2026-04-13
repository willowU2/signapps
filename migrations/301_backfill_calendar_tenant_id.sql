-- Backfill tenant_id on calendars that were seeded without one.
-- The owner's tenant_id is used as the source of truth.
-- This is required because the calendar API's find_by_id filters
-- by tenant_id (added in migration 031).

UPDATE calendar.calendars c
   SET tenant_id = u.tenant_id
  FROM identity.users u
 WHERE c.owner_id = u.id
   AND c.tenant_id IS NULL
   AND u.tenant_id IS NOT NULL;
