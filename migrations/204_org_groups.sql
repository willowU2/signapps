-- Migration 204: Cross-functional groups + group members
-- Groups can be static (explicit membership), dynamic (filter-based),
-- derived (from org structure), or hybrid. Temporal scope via valid_from/valid_until.

-- ─── Cross-functional groups ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workforce_org_groups (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    description   TEXT,
    group_type    TEXT NOT NULL DEFAULT 'static'
        CHECK (group_type IN ('static', 'dynamic', 'derived', 'hybrid')),
    filter        JSONB DEFAULT '{}',
    managed_by    UUID REFERENCES workforce_org_groups(id) ON DELETE SET NULL,
    valid_from    TIMESTAMPTZ,
    valid_until   TIMESTAMPTZ,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    attributes    JSONB NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_valid_range CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_org_groups_tenant
    ON workforce_org_groups (tenant_id);
CREATE INDEX IF NOT EXISTS idx_org_groups_type
    ON workforce_org_groups (tenant_id, group_type);
CREATE INDEX IF NOT EXISTS idx_org_groups_active
    ON workforce_org_groups (tenant_id, is_active)
    WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_org_groups_managed_by
    ON workforce_org_groups (managed_by)
    WHERE managed_by IS NOT NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_org_groups_updated
    BEFORE UPDATE ON workforce_org_groups
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ─── Group members ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workforce_org_group_members (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id           UUID NOT NULL REFERENCES workforce_org_groups(id) ON DELETE CASCADE,
    member_type        TEXT NOT NULL
        CHECK (member_type IN ('person', 'group', 'node')),
    member_id          UUID NOT NULL,
    is_manual_override BOOLEAN NOT NULL DEFAULT false,
    added_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    added_by           UUID,
    UNIQUE (group_id, member_type, member_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group
    ON workforce_org_group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_person
    ON workforce_org_group_members (member_id, member_type);
