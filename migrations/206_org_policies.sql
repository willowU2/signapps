-- Migration 206: GPO-style policy engine
-- Three tables: policies (definitions), policy_links (scope attachments),
-- and country_policies (per-country overrides/defaults).

-- ─── Policies ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workforce_org_policies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    domain      TEXT NOT NULL DEFAULT 'custom'
        CHECK (domain IN ('security', 'modules', 'naming', 'delegation', 'compliance', 'custom')),
    priority    INT NOT NULL DEFAULT 0,
    is_enforced BOOLEAN NOT NULL DEFAULT false,
    is_disabled BOOLEAN NOT NULL DEFAULT false,
    settings    JSONB NOT NULL DEFAULT '{}',
    version     INT NOT NULL DEFAULT 1,
    attributes  JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_org_policies_tenant
    ON workforce_org_policies (tenant_id);
CREATE INDEX IF NOT EXISTS idx_org_policies_domain
    ON workforce_org_policies (tenant_id, domain);
CREATE INDEX IF NOT EXISTS idx_org_policies_priority
    ON workforce_org_policies (tenant_id, priority DESC)
    WHERE is_disabled = false;

CREATE TRIGGER trg_org_policies_updated
    BEFORE UPDATE ON workforce_org_policies
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ─── Policy links (scope attachments) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workforce_org_policy_links (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id  UUID NOT NULL REFERENCES workforce_org_policies(id) ON DELETE CASCADE,
    link_type  TEXT NOT NULL
        CHECK (link_type IN ('node', 'group', 'site', 'country', 'global')),
    link_id    TEXT NOT NULL DEFAULT '',
    is_blocked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (policy_id, link_type, link_id)
);

CREATE INDEX IF NOT EXISTS idx_policy_links_policy
    ON workforce_org_policy_links (policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_links_scope
    ON workforce_org_policy_links (link_type, link_id);

-- ─── Country policies ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workforce_country_policies (
    country_code TEXT NOT NULL,
    policy_id    UUID NOT NULL REFERENCES workforce_org_policies(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (country_code, policy_id)
);

CREATE INDEX IF NOT EXISTS idx_country_policies_policy
    ON workforce_country_policies (policy_id);
