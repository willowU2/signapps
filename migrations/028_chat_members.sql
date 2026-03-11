-- Chat channel members and direct messages support
-- Migration: 028_chat_members.sql
-- Channel members table for managing channel membership
CREATE TABLE IF NOT EXISTS channel_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Unique constraint: user can only be member once per channel
    UNIQUE(channel_id, user_id)
);
-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_channel_members_channel ON channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members(user_id);
-- Add unread tracking for channels
CREATE TABLE IF NOT EXISTS channel_read_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unread_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(channel_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_channel_read_status_user ON channel_read_status(user_id);
-- Add typing indicators (ephemeral, could also use in-memory)
CREATE TABLE IF NOT EXISTS channel_typing (
    channel_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(channel_id, user_id)
);
-- Cleanup old typing indicators (older than 10 seconds)
-- This can be run periodically or via a cron job
-- DELETE FROM channel_typing WHERE started_at < NOW() - INTERVAL '10 seconds';
COMMENT ON TABLE channel_members IS 'Channel membership for chat channels and DMs';
COMMENT ON TABLE channel_read_status IS 'Tracks last read position and unread count per user per channel';
COMMENT ON TABLE channel_typing IS 'Ephemeral typing indicators';