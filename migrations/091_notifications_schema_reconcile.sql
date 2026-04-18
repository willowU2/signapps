-- Reconcile notifications.notifications table
-- Migration 056 created the table without source length limit and without
-- the 'urgent' priority value. The crate migration (20260324000011) expects:
--   source VARCHAR(32), priority including 'urgent', and a preferences table.
-- This migration brings the live schema into alignment.

-- 1. Narrow source column to VARCHAR(32) to match crate model
--    (existing TEXT values up to 32 chars are preserved; longer values
--     would fail the cast — none are expected in production at this stage)
ALTER TABLE notifications.notifications
    ALTER COLUMN source TYPE VARCHAR(32);

-- 2. Drop and recreate the priority CHECK constraint to add 'urgent'
ALTER TABLE notifications.notifications
    DROP CONSTRAINT IF EXISTS notifications_priority_check;

DO $$ BEGIN ALTER TABLE notifications.notifications
    ADD CONSTRAINT notifications_priority_check
        CHECK (priority IN ('low', 'normal', 'high', 'urgent')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Narrow type column to VARCHAR(20) for consistency with crate model
ALTER TABLE notifications.notifications
    ALTER COLUMN type TYPE VARCHAR(20);

-- 4. Make metadata nullable (crate schema has no NOT NULL on metadata)
ALTER TABLE notifications.notifications
    ALTER COLUMN metadata DROP NOT NULL;

-- 5. Add crate-expected indexes (IF NOT EXISTS guards idempotency)
CREATE INDEX IF NOT EXISTS idx_notif_user
    ON notifications.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notif_unread
    ON notifications.notifications(user_id, is_read)
    WHERE is_read = false;

-- 6. Create preferences table (defined in crate migration but absent from 056)
CREATE TABLE IF NOT EXISTS notifications.preferences (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL UNIQUE,
    email_enabled       BOOLEAN NOT NULL DEFAULT true,
    push_enabled        BOOLEAN NOT NULL DEFAULT false,
    quiet_hours_start   TIME,
    quiet_hours_end     TIME,
    disabled_types      TEXT[]  DEFAULT '{}',
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
