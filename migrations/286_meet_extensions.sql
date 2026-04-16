-- 286_meet_extensions.sql
-- Extensions on meet schema for Phase 3 features: waiting room, polls,
-- raised hands, transcriptions + new flags on rooms.

-- Columns on meet.rooms (idempotent; Phase 0 didn't declare them).
ALTER TABLE meet.rooms
    ADD COLUMN IF NOT EXISTS host_identity TEXT,
    ADD COLUMN IF NOT EXISTS requires_knock BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS recording_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS has_password BOOLEAN NOT NULL DEFAULT false;

-- Waiting room requests (persisted; replaces the in-memory fallback).
CREATE TABLE IF NOT EXISTS meet.waiting_room_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES meet.rooms(id) ON DELETE CASCADE,
    identity TEXT NOT NULL,
    display_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'admitted', 'denied')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    UNIQUE (room_id, identity)
);

CREATE INDEX IF NOT EXISTS idx_meet_waiting_room_status
    ON meet.waiting_room_requests(room_id, status);

-- Polls.
CREATE TABLE IF NOT EXISTS meet.polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES meet.rooms(id) ON DELETE CASCADE,
    created_by TEXT NOT NULL,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    votes JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- Raised hands (not a queue — a living set of currently-raised).
CREATE TABLE IF NOT EXISTS meet.raised_hands (
    room_id UUID NOT NULL REFERENCES meet.rooms(id) ON DELETE CASCADE,
    identity TEXT NOT NULL,
    raised_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    lowered_at TIMESTAMPTZ,
    PRIMARY KEY (room_id, identity, raised_at)
);

-- Transcriptions (append-only log of utterances).
CREATE TABLE IF NOT EXISTS meet.transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES meet.rooms(id) ON DELETE CASCADE,
    speaker_identity TEXT NOT NULL,
    text TEXT NOT NULL,
    timestamp_ms BIGINT NOT NULL,
    language TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meet_transcriptions_room_ts
    ON meet.transcriptions(room_id, timestamp_ms);

-- Q&A (bonus table — Phase 3c will use it).
CREATE TABLE IF NOT EXISTS meet.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES meet.rooms(id) ON DELETE CASCADE,
    asked_by TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT,
    upvotes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    answered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_meet_questions_room
    ON meet.questions(room_id, created_at DESC);
