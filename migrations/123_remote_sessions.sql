-- Migration 123: Remote sessions table for custom WSS remote access protocol (RM5)
-- Tracks admin-initiated remote screen sessions per endpoint agent.

CREATE SCHEMA IF NOT EXISTS remote;

CREATE TABLE IF NOT EXISTS remote.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hardware_id UUID NOT NULL REFERENCES it.hardware(id) ON DELETE CASCADE,
    admin_user_id UUID NOT NULL,
    mode VARCHAR(20) NOT NULL DEFAULT 'observe',
        -- 'observe'  : screen capture only, silent, no input forwarding
        -- 'share'    : screen visible + user notification banner, no input
        -- 'control'  : full takeover, banner shown, mouse+keyboard forwarded
    status VARCHAR(20) NOT NULL DEFAULT 'active',
        -- 'active' | 'ended'
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER
);

CREATE INDEX IF NOT EXISTS idx_remote_sessions_hw
    ON remote.sessions(hardware_id, status);

CREATE INDEX IF NOT EXISTS idx_remote_sessions_admin
    ON remote.sessions(admin_user_id, started_at DESC);
