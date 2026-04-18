-- Migration 218: Unified Infrastructure Domain Registry
-- Replaces ad_domains + mailserver.domains with a single source of truth.

CREATE SCHEMA IF NOT EXISTS infrastructure;

CREATE TABLE IF NOT EXISTS infrastructure.domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    dns_name TEXT NOT NULL,
    netbios_name TEXT,
    domain_type TEXT DEFAULT 'full'
        CHECK (domain_type IN ('full', 'dns_only', 'mail_only', 'internal')),
    ad_enabled BOOLEAN DEFAULT false,
    mail_enabled BOOLEAN DEFAULT false,
    dhcp_enabled BOOLEAN DEFAULT false,
    pxe_enabled BOOLEAN DEFAULT false,
    ntp_enabled BOOLEAN DEFAULT true,
    domain_sid TEXT,
    realm TEXT,
    forest_root BOOLEAN DEFAULT false,
    domain_function_level INT DEFAULT 7,
    tree_id UUID,
    cert_mode TEXT DEFAULT 'auto'
        CHECK (cert_mode IN ('auto', 'acme', 'internal_ca', 'manual', 'none')),
    ca_certificate TEXT,
    ca_private_key_encrypted BYTEA,
    dkim_private_key TEXT,
    dkim_selector VARCHAR(63) DEFAULT 'signapps',
    spf_record TEXT,
    dmarc_policy VARCHAR(10) DEFAULT 'none',
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, dns_name)
);

CREATE INDEX IF NOT EXISTS idx_infra_domains_tenant ON infrastructure.domains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_infra_domains_dns ON infrastructure.domains(dns_name);
