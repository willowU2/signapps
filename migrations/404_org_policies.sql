-- S1 W1 / Task 5 — Canonical `org_policies` + `org_policy_bindings`.
--
-- Policies bundle `(resource, actions[])` grants. Bindings attach
-- a policy to a node and propagate to descendants when
-- `inherit = true`.
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS org_policies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Note: index name suffixed `_canonical` to avoid collision with the
-- legacy `idx_org_policies_tenant` index on public.workforce_org_policies.
-- That legacy index disappears with the table in migration 426.
CREATE INDEX IF NOT EXISTS idx_org_policies_tenant_canonical ON org_policies(tenant_id);

CREATE TABLE IF NOT EXISTS org_policy_bindings (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id  UUID NOT NULL REFERENCES org_policies(id) ON DELETE CASCADE,
    node_id    UUID NOT NULL REFERENCES org_nodes(id) ON DELETE CASCADE,
    inherit    BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_policy_bindings_node ON org_policy_bindings(node_id);
CREATE INDEX IF NOT EXISTS idx_org_policy_bindings_policy ON org_policy_bindings(policy_id);
