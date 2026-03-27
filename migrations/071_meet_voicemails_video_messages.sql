-- Migration 071: meet.voicemails + meet.video_messages

-- ---------------------------------------------------------------------------
-- meet.voicemails
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meet.voicemails (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    caller_name       TEXT,
    caller_phone      TEXT,
    duration_seconds  INTEGER,
    transcription     TEXT,
    audio_storage_key TEXT,
    is_read           BOOLEAN NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voicemails_user_id    ON meet.voicemails(user_id);
CREATE INDEX IF NOT EXISTS idx_voicemails_created_at ON meet.voicemails(created_at DESC);

-- ---------------------------------------------------------------------------
-- meet.video_messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meet.video_messages (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id         UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    recipient_id      UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    duration_seconds  INTEGER,
    thumbnail_url     TEXT,
    video_storage_key TEXT,
    is_read           BOOLEAN NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_messages_sender_id    ON meet.video_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_video_messages_recipient_id ON meet.video_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_video_messages_created_at   ON meet.video_messages(created_at DESC);
