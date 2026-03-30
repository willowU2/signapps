-- Migration 119: LMS (Learning Management System) — JSONB storage in platform schema

CREATE SCHEMA IF NOT EXISTS platform;

CREATE TABLE IF NOT EXISTS platform.lms_data (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type  VARCHAR(64) NOT NULL,   -- 'course' | 'progress' | 'discussion'
    data         JSONB       NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lms_data_entity_type ON platform.lms_data (entity_type);
CREATE INDEX IF NOT EXISTS idx_lms_data_created_at  ON platform.lms_data (created_at DESC);
