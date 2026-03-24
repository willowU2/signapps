ALTER TABLE identity.users DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE calendar.calendars DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE calendar.tasks DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE mail.emails DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE scheduling.time_items DROP COLUMN IF EXISTS deleted_at;
