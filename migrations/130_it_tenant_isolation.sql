-- 130: Multi-tenant isolation for IT data (#18)
-- Adds tenant_id to key IT tables so data is isolated per workspace

ALTER TABLE it.hardware ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE it.policies ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE it.tickets ADD COLUMN IF NOT EXISTS tenant_id UUID;

CREATE INDEX IF NOT EXISTS idx_hardware_tenant ON it.hardware(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policies_tenant ON it.policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant ON it.tickets(tenant_id);

-- Device documentation (#11)
CREATE TABLE IF NOT EXISTS it.device_documentation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hardware_id UUID NOT NULL REFERENCES it.hardware(id) ON DELETE CASCADE,
    title VARCHAR(300) NOT NULL,
    content TEXT,
    doc_type VARCHAR(50) DEFAULT 'note',
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_device_docs_hardware ON it.device_documentation(hardware_id);

-- Software blacklist/whitelist (#20)
CREATE TABLE IF NOT EXISTS it.software_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    mode VARCHAR(20) NOT NULL DEFAULT 'blacklist' CHECK (mode IN ('whitelist', 'blacklist')),
    patterns TEXT[] DEFAULT '{}',
    action VARCHAR(20) NOT NULL DEFAULT 'alert' CHECK (action IN ('alert', 'remove')),
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Script parameters support (#19)
ALTER TABLE it.script_queue ADD COLUMN IF NOT EXISTS parameters JSONB DEFAULT '{}';

-- PSA webhook integrations (TK-PSA)
CREATE TABLE IF NOT EXISTS it.psa_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'generic',
    webhook_url TEXT NOT NULL,
    api_key TEXT,
    mapping_config JSONB DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
