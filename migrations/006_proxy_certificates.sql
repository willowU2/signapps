-- Proxy certificates for TLS termination
CREATE TABLE IF NOT EXISTS proxy.acme_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    directory_url TEXT NOT NULL DEFAULT 'https://acme-v02.api.letsencrypt.org/directory',
    account_credentials JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proxy.certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain VARCHAR(255) NOT NULL,
    cert_pem TEXT NOT NULL,
    key_pem TEXT NOT NULL,
    issuer VARCHAR(255),
    not_before TIMESTAMPTZ NOT NULL,
    not_after TIMESTAMPTZ NOT NULL,
    auto_renew BOOLEAN DEFAULT TRUE,
    acme_account_id UUID REFERENCES proxy.acme_accounts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_domain ON proxy.certificates(domain);
