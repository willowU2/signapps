-- S1 W1 / Task 2 — Canonical `org_nodes` table.
--
-- Top-level table of the canonical organization data model. Each row
-- represents a node in the org hierarchy (root entity, business unit,
-- position, role, ...) keyed by tenant.
--
-- The materialized path (`path` LTREE) makes subtree queries
-- ``WHERE path <@ 'acme.rd'`` O(log n) thanks to the GIST index.
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS org_nodes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    kind       TEXT NOT NULL,
    parent_id  UUID REFERENCES org_nodes(id) ON DELETE SET NULL,
    path       LTREE NOT NULL,
    name       TEXT NOT NULL,
    slug       TEXT,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    active     BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_nodes_tenant_kind     ON org_nodes(tenant_id, kind);
CREATE INDEX IF NOT EXISTS idx_org_nodes_path_gist       ON org_nodes USING GIST (path);
-- Note: index name is suffixed with `_canonical` so it does not collide
-- with the legacy `idx_org_nodes_parent` index that already exists on
-- the (to-be-dropped) public.workforce_org_nodes table. The legacy
-- index disappears with the table in migration 426.
CREATE INDEX IF NOT EXISTS idx_org_nodes_parent_canonical ON org_nodes(parent_id);
