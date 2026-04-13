-- Migration 300: Transcription jobs table
-- Tracks transcription requests from meet recordings, external captures, and voice memos

CREATE TABLE IF NOT EXISTS meet.transcription_jobs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id        UUID REFERENCES meet.recordings(id) ON DELETE CASCADE,
    capture_session_id  UUID,
    source              TEXT NOT NULL CHECK (source IN ('meet', 'external_capture', 'voice_memo')),
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    source_app          TEXT,
    language            TEXT,
    duration_ms         BIGINT,
    document_id         UUID,
    speaker_count       INTEGER,
    segment_count       INTEGER,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    tenant_id           UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tj_status ON meet.transcription_jobs(status);
CREATE INDEX IF NOT EXISTS idx_tj_tenant ON meet.transcription_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tj_recording ON meet.transcription_jobs(recording_id);
