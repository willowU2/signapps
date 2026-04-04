-- Migration 213: AD domain configuration
-- Links a tenant's org tree to an Active Directory domain with SID, realm, and DNS name.

CREATE TABLE ad_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    tree_id UUID NOT NULL,
    dns_name TEXT NOT NULL,
    netbios_name TEXT NOT NULL,
    domain_sid TEXT NOT NULL,
    realm TEXT NOT NULL,
    forest_root BOOLEAN DEFAULT false,
    domain_function_level INT DEFAULT 7,
    schema_version INT DEFAULT 1,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, dns_name)
);

CREATE INDEX idx_ad_domains_tenant ON ad_domains(tenant_id);
CREATE INDEX idx_ad_domains_realm ON ad_domains(realm);
