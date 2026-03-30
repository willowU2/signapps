-- Migration 103: Chat DB persistence (CH1)
-- Creates chat.channels and chat.messages tables to replace in-memory storage.

CREATE SCHEMA IF NOT EXISTS chat;

CREATE TABLE IF NOT EXISTS chat.channels (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    topic       TEXT,
    is_private  BOOLEAN NOT NULL DEFAULT false,
    created_by  UUID NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_channels_created_by ON chat.channels(created_by);
CREATE INDEX IF NOT EXISTS idx_chat_channels_name       ON chat.channels(name);

CREATE TABLE IF NOT EXISTS chat.messages (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id   UUID NOT NULL REFERENCES chat.channels(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL,
    username     TEXT NOT NULL,
    content      TEXT NOT NULL,
    parent_id    UUID REFERENCES chat.messages(id) ON DELETE SET NULL,
    reactions    JSONB NOT NULL DEFAULT '{}',
    attachment   JSONB,
    is_pinned    BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_id  ON chat.messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id     ON chat.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_parent_id   ON chat.messages(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at  ON chat.messages(channel_id, created_at DESC);
