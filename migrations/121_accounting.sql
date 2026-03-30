-- Migration 121: Accounting — JSONB storage in platform schema

CREATE SCHEMA IF NOT EXISTS platform;

CREATE TABLE IF NOT EXISTS platform.accounting_data (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type  VARCHAR(64) NOT NULL,   -- 'journal_entry' | 'account' | 'report'
    data         JSONB       NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounting_data_entity_type ON platform.accounting_data (entity_type);
CREATE INDEX IF NOT EXISTS idx_accounting_data_created_at  ON platform.accounting_data (created_at DESC);
