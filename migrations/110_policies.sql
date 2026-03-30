-- Migration 110: IT Policy / GPO system
-- GP1-GP5

CREATE TABLE IF NOT EXISTS it.policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}',
    parent_id UUID REFERENCES it.policies(id),
    priority INTEGER DEFAULT 0,
    mode VARCHAR(10) DEFAULT 'enforce',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS it.policy_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES it.policies(id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL,
    target_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS it.policy_compliance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hardware_id UUID NOT NULL REFERENCES it.hardware(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES it.policies(id) ON DELETE CASCADE,
    compliant BOOLEAN NOT NULL,
    details JSONB DEFAULT '{}',
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policies_category ON it.policies(category);
CREATE INDEX IF NOT EXISTS idx_policies_parent_id ON it.policies(parent_id);
CREATE INDEX IF NOT EXISTS idx_policy_assignments_policy_id ON it.policy_assignments(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_assignments_target ON it.policy_assignments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_policy_compliance_hardware_id ON it.policy_compliance(hardware_id);
CREATE INDEX IF NOT EXISTS idx_policy_compliance_policy_id ON it.policy_compliance(policy_id);
