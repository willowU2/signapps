-- Migration 201: Service subdomain assignments for mail domains
-- Tracks which subdomains are mapped to which SignApps services.

-- Add missing columns to mailserver.domains (idempotent)
ALTER TABLE mailserver.domains
    ADD COLUMN IF NOT EXISTS dkim_dns_value TEXT,
    ADD COLUMN IF NOT EXISTS dns_verified BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS dns_verified_at TIMESTAMPTZ;

-- Service subdomain assignment table
CREATE TABLE IF NOT EXISTS mailserver.service_subdomains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES mailserver.domains(id) ON DELETE CASCADE,
    subdomain VARCHAR(63) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    service_port INT NOT NULL,
    record_type VARCHAR(10) NOT NULL DEFAULT 'CNAME',
    target VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(domain_id, subdomain)
);

-- Index for fast subdomain lookups by domain
CREATE INDEX IF NOT EXISTS idx_service_subdomains_domain_id
    ON mailserver.service_subdomains(domain_id);

-- Index for active subdomains filtering
CREATE INDEX IF NOT EXISTS idx_service_subdomains_active
    ON mailserver.service_subdomains(domain_id, is_active)
    WHERE is_active = true;
