-- SignApps Platform - Notifications Schema
-- Version: 051
-- Feature: AQ-NOTDB — Ensure notifications schema and table exist

CREATE SCHEMA IF NOT EXISTS notifications;

CREATE TABLE IF NOT EXISTS notifications.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    type TEXT NOT NULL DEFAULT 'info'
        CHECK (type IN ('info', 'warning', 'alert', 'success')),
    title TEXT NOT NULL,
    body TEXT,
    source TEXT,
    priority TEXT NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('high', 'normal', 'low')),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
    ON notifications.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications.notifications(user_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at
    ON notifications.notifications(created_at DESC);
