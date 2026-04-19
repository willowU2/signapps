-- S1 W1 / Task 4 — Canonical `org_assignments` table.
--
-- Each row attaches a person to a node along one of three axes
-- (structure, focus, group). `is_primary = true` marks the dominant
-- assignment per axis; the rule is enforced at the API layer in W2.
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS org_assignments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    person_id  UUID NOT NULL REFERENCES org_persons(id) ON DELETE CASCADE,
    node_id    UUID NOT NULL REFERENCES org_nodes(id) ON DELETE CASCADE,
    axis       TEXT NOT NULL,
    role       TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    start_date DATE,
    end_date   DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_assignments_person_axis ON org_assignments(person_id, axis);
CREATE INDEX IF NOT EXISTS idx_org_assignments_node ON org_assignments(node_id);
