-- Migration 208: Scoped delegation chains
-- Allows a delegator to grant permissions to a delegate (person or group)
-- scoped to a specific org node subtree, with optional expiry and parent chain.

CREATE TABLE IF NOT EXISTS workforce_org_delegations (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    delegator_id         UUID NOT NULL,
    delegate_type        TEXT NOT NULL CHECK (delegate_type IN ('person', 'group')),
    delegate_id          UUID NOT NULL,
    scope_node_id        UUID REFERENCES workforce_org_nodes(id) ON DELETE CASCADE,
    permissions          JSONB NOT NULL DEFAULT '{}',
    delegated_by         UUID,
    depth                INT NOT NULL DEFAULT 0 CHECK (depth >= 0),
    parent_delegation_id UUID REFERENCES workforce_org_delegations(id) ON DELETE CASCADE,
    expires_at           TIMESTAMPTZ,
    is_active            BOOLEAN NOT NULL DEFAULT true,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tenant-level overview
CREATE INDEX IF NOT EXISTS idx_delegations_tenant
    ON workforce_org_delegations (tenant_id, is_active)
    WHERE is_active = true;

-- Delegator lookups (what has this person delegated?)
CREATE INDEX IF NOT EXISTS idx_delegations_delegator
    ON workforce_org_delegations (tenant_id, delegator_id);

-- Delegate lookups (what permissions has this person/group received?)
CREATE INDEX IF NOT EXISTS idx_delegations_delegate
    ON workforce_org_delegations (tenant_id, delegate_id, delegate_type);

-- Scope lookups (what delegations apply to this node?)
CREATE INDEX IF NOT EXISTS idx_delegations_scope
    ON workforce_org_delegations (scope_node_id)
    WHERE scope_node_id IS NOT NULL;

-- Active delegations with expiry (for scheduled cleanup)
CREATE INDEX IF NOT EXISTS idx_delegations_expiry
    ON workforce_org_delegations (expires_at)
    WHERE expires_at IS NOT NULL AND is_active = true;

CREATE TRIGGER trg_delegations_updated
    BEFORE UPDATE ON workforce_org_delegations
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
