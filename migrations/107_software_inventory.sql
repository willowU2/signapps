-- Migration 107: Software inventory table for agent-reported installed software

CREATE TABLE IF NOT EXISTS it.software_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hardware_id UUID NOT NULL REFERENCES it.hardware(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(100),
    publisher VARCHAR(255),
    install_date DATE,
    size_bytes BIGINT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sw_inv_hw ON it.software_inventory(hardware_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sw_inv_unique ON it.software_inventory(hardware_id, name, version);
