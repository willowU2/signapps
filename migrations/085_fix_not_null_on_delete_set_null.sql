-- Migration 085: Fix NOT NULL + ON DELETE SET NULL conflicts
-- Columns declared NOT NULL but whose FK uses ON DELETE SET NULL will cause
-- constraint violations when the referenced user is deleted.
-- Drop the NOT NULL constraint on each affected column.
-- The ON DELETE SET NULL action is already correct in the original FKs.

-- From migration 011 (calendar schema)
ALTER TABLE calendar.events       ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE calendar.tasks        ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE calendar.activity_log ALTER COLUMN user_id    DROP NOT NULL;

-- From migration 034 (scheduling schema)
ALTER TABLE scheduling.time_items ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE scheduling.templates  ALTER COLUMN created_by DROP NOT NULL;
