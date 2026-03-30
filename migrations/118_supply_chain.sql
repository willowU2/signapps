-- Migration 118: Supply Chain — JSONB storage in platform schema
-- Tables: supply_chain_data (generic entity store)

CREATE SCHEMA IF NOT EXISTS platform;

CREATE TABLE IF NOT EXISTS platform.supply_chain_data (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type  VARCHAR(64) NOT NULL,   -- 'purchase_order' | 'warehouse' | 'inventory_item'
    data         JSONB       NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sc_data_entity_type ON platform.supply_chain_data (entity_type);
CREATE INDEX IF NOT EXISTS idx_sc_data_created_at  ON platform.supply_chain_data (created_at DESC);
