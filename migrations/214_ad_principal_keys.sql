-- Migration 214: Kerberos principal keys
-- Stores encryption keys for Kerberos principals (users, computers, services, krbtgt).
-- key_data is encrypted at rest (AES-256-GCM with master key derived from JWT_SECRET + domain_sid).

CREATE TABLE IF NOT EXISTS ad_principal_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES ad_domains(id) ON DELETE CASCADE,
    principal_name TEXT NOT NULL,
    principal_type TEXT NOT NULL
        CHECK (principal_type IN ('user', 'computer', 'service', 'krbtgt')),
    key_version INT NOT NULL DEFAULT 1,
    enc_type INT NOT NULL,
    key_data BYTEA NOT NULL,
    salt TEXT,
    entity_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, principal_name, enc_type, key_version)
);

CREATE INDEX IF NOT EXISTS idx_principal_keys_lookup ON ad_principal_keys(domain_id, principal_name);
CREATE INDEX IF NOT EXISTS idx_principal_keys_entity ON ad_principal_keys(entity_id);
