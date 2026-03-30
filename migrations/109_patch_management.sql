-- Migration 109: Patch management — available patches and patch policies

CREATE TABLE IF NOT EXISTS it.available_patches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hardware_id UUID NOT NULL REFERENCES it.hardware(id) ON DELETE CASCADE,
    patch_id VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    severity VARCHAR(20) DEFAULT 'unknown',
    kb_number VARCHAR(20),
    category VARCHAR(50),
    size_bytes BIGINT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    approved_at TIMESTAMPTZ,
    deployed_at TIMESTAMPTZ,
    installed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_patches_hw ON it.available_patches(hardware_id);
CREATE INDEX IF NOT EXISTS idx_patches_status ON it.available_patches(status);

CREATE TABLE IF NOT EXISTS it.patch_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    auto_approve_critical BOOLEAN DEFAULT false,
    auto_approve_important BOOLEAN DEFAULT false,
    auto_approve_delay_hours INTEGER DEFAULT 24,
    maintenance_window_start TIME,
    maintenance_window_end TIME,
    target_group VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
