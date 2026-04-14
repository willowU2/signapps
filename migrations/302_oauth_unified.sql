-- Migration 302: OAuth unified architecture — provider catalog, per-tenant configs,
-- user overrides, and refresh queue placeholder.
--
-- Plan 2 (signapps-oauth crate foundation): creates the 4 configuration tables.
-- Plan 3 (engine v2) will consume these tables.
-- Plan 4 (migration + event bus) will add the encrypted columns to existing
-- per-service tables (mail_accounts, calendar_provider_connections, ...).

-- ────────────────────────────────────────────────────────────────────────────
-- 1. oauth_providers — custom providers (Keycloak tenant, OIDC generic, SAML)
--    that are not in the embedded catalog.json. The embedded ~10-200 providers
--    are NOT duplicated here.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE oauth_providers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    key             TEXT NOT NULL,
    display_name    TEXT NOT NULL,
    protocol        TEXT NOT NULL CHECK (protocol IN ('OAuth2', 'OAuth1a', 'Oidc', 'Saml')),
    authorize_url   TEXT NOT NULL,
    access_url      TEXT NOT NULL,
    refresh_url     TEXT,
    profile_url     TEXT,
    revoke_url      TEXT,
    scope_delimiter TEXT NOT NULL DEFAULT ' ',
    default_scopes  TEXT[] NOT NULL DEFAULT '{}',
    pkce_required   BOOLEAN NOT NULL DEFAULT false,
    supports_refresh BOOLEAN NOT NULL DEFAULT true,
    categories      TEXT[] NOT NULL DEFAULT '{}',
    user_id_field   TEXT NOT NULL DEFAULT '$.sub',
    user_email_field TEXT,
    user_name_field TEXT,
    template_vars   TEXT[] NOT NULL DEFAULT '{}',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, key)
);

CREATE INDEX idx_oauth_providers_tenant ON oauth_providers (tenant_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. oauth_provider_configs — per-tenant config for a provider (catalog or custom).
--    Credentials are stored encrypted (AES-256-GCM via signapps-common::crypto).
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE oauth_provider_configs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    provider_key      TEXT NOT NULL,

    -- Encrypted credentials (ciphertext: version || nonce || ct+tag)
    client_id_enc     BYTEA,
    client_secret_enc BYTEA,
    extra_params_enc  BYTEA,

    -- Activation
    enabled           BOOLEAN NOT NULL DEFAULT false,
    -- CHECK constraint: subset of {'login','integration'}
    purposes          TEXT[] NOT NULL DEFAULT '{}'
                      CHECK (purposes <@ ARRAY['login','integration']),

    -- Allowed scopes (whitelist filtered by ScopeResolver::filter_scopes)
    allowed_scopes    TEXT[] NOT NULL DEFAULT '{}',

    -- Visibility
    visibility        TEXT NOT NULL DEFAULT 'all'
                      CHECK (visibility IN ('all','restricted')),
    visible_to_org_nodes UUID[] NOT NULL DEFAULT '{}',
    visible_to_groups    UUID[] NOT NULL DEFAULT '{}',
    visible_to_roles     TEXT[] NOT NULL DEFAULT '{}',
    visible_to_users     UUID[] NOT NULL DEFAULT '{}',

    -- User customization
    allow_user_override  BOOLEAN NOT NULL DEFAULT false,

    -- SSO tenant-level
    is_tenant_sso        BOOLEAN NOT NULL DEFAULT false,
    auto_provision_users BOOLEAN NOT NULL DEFAULT false,
    default_role         TEXT,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, provider_key)
);

CREATE INDEX idx_oauth_provider_configs_tenant   ON oauth_provider_configs (tenant_id);
CREATE INDEX idx_oauth_provider_configs_enabled  ON oauth_provider_configs (tenant_id, enabled);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. oauth_provider_purpose_overrides — per-(config, purpose) visibility override.
--    Allows "login for everyone, integration only for R&D" type policies.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE oauth_provider_purpose_overrides (
    provider_config_id UUID NOT NULL REFERENCES oauth_provider_configs(id) ON DELETE CASCADE,
    purpose            TEXT NOT NULL CHECK (purpose IN ('login','integration')),
    visibility         TEXT NOT NULL DEFAULT 'all'
                       CHECK (visibility IN ('all','restricted')),
    visible_to_org_nodes UUID[] NOT NULL DEFAULT '{}',
    visible_to_groups    UUID[] NOT NULL DEFAULT '{}',
    visible_to_roles     TEXT[] NOT NULL DEFAULT '{}',
    visible_to_users     UUID[] NOT NULL DEFAULT '{}',
    PRIMARY KEY (provider_config_id, purpose)
);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. oauth_user_overrides — a user's personal client_id/secret for a provider.
--    Only usable when the tenant admin set allow_user_override = true.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE oauth_user_overrides (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    tenant_id         UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    provider_key      TEXT NOT NULL,
    client_id_enc     BYTEA NOT NULL,
    client_secret_enc BYTEA NOT NULL,
    extra_params_enc  BYTEA,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, provider_key)
);

CREATE INDEX idx_oauth_user_overrides_user ON oauth_user_overrides (user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- Triggers: updated_at maintenance
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION oauth_touch_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER oauth_providers_touch_updated_at
    BEFORE UPDATE ON oauth_providers
    FOR EACH ROW EXECUTE FUNCTION oauth_touch_updated_at();

CREATE TRIGGER oauth_provider_configs_touch_updated_at
    BEFORE UPDATE ON oauth_provider_configs
    FOR EACH ROW EXECUTE FUNCTION oauth_touch_updated_at();
