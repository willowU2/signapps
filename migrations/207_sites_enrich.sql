-- Migration 207: Enrich workforce_sites + add site_assignments
-- Creates workforce_sites if not present (new table), enriches with code,
-- country_code, legal_entity, and attributes. Adds workforce_site_assignments
-- for flexible person/node-to-site assignments with scheduling support.

-- ─── Create workforce_sites (new table, not previously defined) ───────────────

CREATE TABLE IF NOT EXISTS workforce_sites (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    code         TEXT,
    country_code TEXT,
    legal_entity TEXT,
    address      JSONB DEFAULT '{}',
    attributes   JSONB NOT NULL DEFAULT '{}',
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

-- If the table already exists from a prior migration, add columns idempotently
ALTER TABLE workforce_sites
    ADD COLUMN IF NOT EXISTS code         TEXT,
    ADD COLUMN IF NOT EXISTS country_code TEXT,
    ADD COLUMN IF NOT EXISTS legal_entity TEXT,
    ADD COLUMN IF NOT EXISTS attributes   JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_sites_tenant
    ON workforce_sites (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sites_country
    ON workforce_sites (tenant_id, country_code);
CREATE INDEX IF NOT EXISTS idx_sites_active
    ON workforce_sites (tenant_id, is_active)
    WHERE is_active = true;

CREATE TRIGGER trg_sites_updated
    BEFORE UPDATE ON workforce_sites
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ─── Site assignments ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workforce_site_assignments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id       UUID NOT NULL REFERENCES workforce_sites(id) ON DELETE CASCADE,
    assignee_type TEXT NOT NULL CHECK (assignee_type IN ('person', 'node')),
    assignee_id   UUID NOT NULL,
    is_primary    BOOLEAN NOT NULL DEFAULT false,
    schedule      JSONB DEFAULT '{}',
    valid_from    TIMESTAMPTZ,
    valid_until   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (site_id, assignee_type, assignee_id),
    CONSTRAINT chk_site_assign_range CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_site_assignments_site
    ON workforce_site_assignments (site_id);
CREATE INDEX IF NOT EXISTS idx_site_assignments_assignee
    ON workforce_site_assignments (assignee_id, assignee_type);
CREATE INDEX IF NOT EXISTS idx_site_assignments_primary
    ON workforce_site_assignments (site_id, assignee_type)
    WHERE is_primary = true;
