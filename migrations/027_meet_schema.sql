-- Meet service schema
-- Video conferencing rooms, participants, and recordings

CREATE SCHEMA IF NOT EXISTS meet;

-- Rooms table
CREATE TABLE meet.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    room_code VARCHAR(10) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'ended')),
    is_private BOOLEAN NOT NULL DEFAULT false,
    password_hash VARCHAR(255),
    max_participants INTEGER,
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    settings JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Room participants tracking
CREATE TABLE meet.room_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES meet.rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    display_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'participant' CHECK (role IN ('host', 'moderator', 'participant')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    is_muted BOOLEAN NOT NULL DEFAULT false,
    is_video_off BOOLEAN NOT NULL DEFAULT false,
    is_screen_sharing BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(room_id, user_id) WHERE left_at IS NULL
);

-- Recordings
CREATE TABLE meet.recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES meet.rooms(id) ON DELETE CASCADE,
    started_by UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'recording' CHECK (status IN ('recording', 'processing', 'ready', 'failed')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    file_size_bytes BIGINT,
    storage_path VARCHAR(500),
    storage_bucket VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Meeting history for analytics
CREATE TABLE meet.meeting_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL,
    room_name VARCHAR(255) NOT NULL,
    host_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    participant_count INTEGER NOT NULL DEFAULT 0,
    max_concurrent_participants INTEGER NOT NULL DEFAULT 0,
    had_recording BOOLEAN NOT NULL DEFAULT false,
    had_screen_share BOOLEAN NOT NULL DEFAULT false
);

-- Indexes
CREATE INDEX idx_rooms_created_by ON meet.rooms(created_by);
CREATE INDEX idx_rooms_status ON meet.rooms(status);
CREATE INDEX idx_rooms_scheduled_start ON meet.rooms(scheduled_start);
CREATE INDEX idx_rooms_room_code ON meet.rooms(room_code);

CREATE INDEX idx_participants_room_id ON meet.room_participants(room_id);
CREATE INDEX idx_participants_user_id ON meet.room_participants(user_id);
CREATE INDEX idx_participants_active ON meet.room_participants(room_id) WHERE left_at IS NULL;

CREATE INDEX idx_recordings_room_id ON meet.recordings(room_id);
CREATE INDEX idx_recordings_status ON meet.recordings(status);

CREATE INDEX idx_history_host_id ON meet.meeting_history(host_id);
CREATE INDEX idx_history_started_at ON meet.meeting_history(started_at);
