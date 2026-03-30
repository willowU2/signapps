-- Migration 120: Internal Communications — JSONB storage in platform schema

CREATE SCHEMA IF NOT EXISTS platform;

CREATE TABLE IF NOT EXISTS platform.comms_data (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type  VARCHAR(64) NOT NULL,   -- 'announcement' | 'poll' | 'news_post'
    data         JSONB       NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comms_data_entity_type ON platform.comms_data (entity_type);
CREATE INDEX IF NOT EXISTS idx_comms_data_created_at  ON platform.comms_data (created_at DESC);
