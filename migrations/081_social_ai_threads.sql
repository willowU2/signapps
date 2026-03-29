-- Migration 070: social.ai_threads — AI Agent Chat Threads

CREATE TABLE IF NOT EXISTS social.ai_threads (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL DEFAULT '',
    messages   JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_threads_user_id    ON social.ai_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_threads_updated_at ON social.ai_threads(updated_at DESC);
