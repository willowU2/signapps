-- SignApps Platform - Notifications Schema v2
-- Migration 265: Add notifications.items (rich notification model) and update preferences.
-- The legacy notifications.notifications table is kept; new endpoints use items.

CREATE SCHEMA IF NOT EXISTS notifications;

-- ── Rich notification items ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications.items (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL,
    type        TEXT        NOT NULL, -- 'system', 'mention', 'assignment', 'reminder', 'approval', 'share', 'comment', 'reaction'
    title       TEXT        NOT NULL,
    body        TEXT,
    module      TEXT        NOT NULL, -- source module (e.g. 'calendar', 'mail', 'drive')
    entity_type TEXT,                 -- optional: 'task', 'document', 'email', etc.
    entity_id   UUID,                 -- optional: link to source entity
    deep_link   TEXT,                 -- URL path to navigate to
    read        BOOLEAN     DEFAULT false,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_items_user
    ON notifications.items(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_items_unread
    ON notifications.items(user_id) WHERE read = false;

-- ── User notification preferences ───────────────────────────────────────────

-- Drop old preferences table if it exists (only had basic columns)
-- and recreate with richer schema.
DROP TABLE IF EXISTS notifications.preferences;

CREATE TABLE IF NOT EXISTS notifications.preferences (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID        NOT NULL UNIQUE,
    channels         JSONB       DEFAULT '{"in_app": true, "email": true, "push": false}',
    quiet_hours_start TIME,
    quiet_hours_end   TIME,
    digest_frequency TEXT        DEFAULT 'none', -- 'none', 'daily', 'weekly'
    muted_modules    TEXT[]      DEFAULT '{}',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
