-- Migration 115: CMDB — configuration items and relationships
-- CM1, CM2, CM4

CREATE TABLE IF NOT EXISTS it.configuration_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    ci_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    owner_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ci_type ON it.configuration_items(ci_type);
CREATE INDEX IF NOT EXISTS idx_ci_status ON it.configuration_items(status);

CREATE TABLE IF NOT EXISTS it.ci_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_ci_id UUID NOT NULL REFERENCES it.configuration_items(id) ON DELETE CASCADE,
    target_ci_id UUID NOT NULL REFERENCES it.configuration_items(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ci_rel_source ON it.ci_relationships(source_ci_id);
CREATE INDEX IF NOT EXISTS idx_ci_rel_target ON it.ci_relationships(target_ci_id);

-- CM2: Lifecycle fields on hardware
ALTER TABLE it.hardware ADD COLUMN IF NOT EXISTS lifecycle_stage VARCHAR(30);
ALTER TABLE it.hardware ADD COLUMN IF NOT EXISTS warranty_end DATE;
ALTER TABLE it.hardware ADD COLUMN IF NOT EXISTS lease_end DATE;
ALTER TABLE it.hardware ADD COLUMN IF NOT EXISTS disposal_date DATE;

-- CM3: Change management
CREATE TABLE IF NOT EXISTS it.change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    impact_analysis TEXT,
    risk_level VARCHAR(20) DEFAULT 'low',
    status VARCHAR(30) DEFAULT 'submitted',
    submitted_by UUID,
    reviewed_by UUID,
    approved_by UUID,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    implemented_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_change_requests_status ON it.change_requests(status);

CREATE TABLE IF NOT EXISTS it.change_request_cis (
    change_request_id UUID NOT NULL REFERENCES it.change_requests(id) ON DELETE CASCADE,
    ci_id UUID NOT NULL REFERENCES it.configuration_items(id) ON DELETE CASCADE,
    PRIMARY KEY (change_request_id, ci_id)
);

-- BK4: Maintenance windows
CREATE TABLE IF NOT EXISTS it.maintenance_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    hardware_id UUID REFERENCES it.hardware(id) ON DELETE CASCADE,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_maint_windows_hw ON it.maintenance_windows(hardware_id);
CREATE INDEX IF NOT EXISTS idx_maint_windows_time ON it.maintenance_windows(starts_at, ends_at);
