-- SE2: SSO configurations per tenant (SAML / OIDC)
CREATE TABLE IF NOT EXISTS identity.sso_configs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    protocol     VARCHAR(10) NOT NULL CHECK (protocol IN ('saml', 'oidc')),
    enabled      BOOLEAN NOT NULL DEFAULT false,
    -- SAML fields
    idp_entity_id        TEXT,
    idp_sso_url          TEXT,
    idp_slo_url          TEXT,
    idp_certificate      TEXT,
    sp_entity_id         TEXT,
    -- OIDC fields
    oidc_issuer          TEXT,
    oidc_client_id       TEXT,
    oidc_client_secret   TEXT,     -- stored encrypted at application level
    oidc_scopes          TEXT DEFAULT 'openid email profile',
    -- Mapping
    email_attribute      TEXT DEFAULT 'email',
    name_attribute       TEXT DEFAULT 'name',
    -- Auto-provisioning
    auto_create_users    BOOLEAN NOT NULL DEFAULT true,
    default_role         SMALLINT NOT NULL DEFAULT 1,
    metadata             JSONB NOT NULL DEFAULT '{}',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, protocol)
);

CREATE INDEX IF NOT EXISTS idx_sso_configs_tenant ON identity.sso_configs(tenant_id);

-- SE5: Password policies per tenant
CREATE TABLE IF NOT EXISTS identity.password_policies (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE UNIQUE,
    min_length         SMALLINT NOT NULL DEFAULT 8,
    require_uppercase  BOOLEAN NOT NULL DEFAULT false,
    require_number     BOOLEAN NOT NULL DEFAULT false,
    require_special    BOOLEAN NOT NULL DEFAULT false,
    expiry_days        INTEGER,          -- NULL = never expires
    max_attempts       SMALLINT NOT NULL DEFAULT 5,
    lockout_minutes    SMALLINT NOT NULL DEFAULT 15,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_policies_tenant ON identity.password_policies(tenant_id);
