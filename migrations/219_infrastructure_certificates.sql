-- Migration 219: Certificate management for infrastructure domains.

CREATE TABLE infrastructure.certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    issuer TEXT NOT NULL,
    cert_type TEXT NOT NULL
        CHECK (cert_type IN ('root_ca', 'intermediate_ca', 'server', 'client', 'wildcard')),
    certificate TEXT NOT NULL,
    private_key_encrypted BYTEA,
    not_before TIMESTAMPTZ NOT NULL,
    not_after TIMESTAMPTZ NOT NULL,
    auto_renew BOOLEAN DEFAULT true,
    san TEXT[] DEFAULT '{}',
    serial_number TEXT,
    fingerprint_sha256 TEXT,
    status TEXT DEFAULT 'active'
        CHECK (status IN ('active', 'expired', 'revoked', 'pending')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_certs_domain ON infrastructure.certificates(domain_id);
CREATE INDEX idx_certs_expiry ON infrastructure.certificates(not_after) WHERE status = 'active';
