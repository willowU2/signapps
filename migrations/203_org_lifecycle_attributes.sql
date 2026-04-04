-- Migration 203: Lifecycle state + attributes JSONB on org nodes and employees
-- Adds lifecycle_state (live/recycled/tombstone) and attributes JSONB for
-- flexible extensibility. Partial indexes on lifecycle_state='live' for
-- efficient active-record queries.

-- ─── workforce_org_nodes ─────────────────────────────────────────────────────

ALTER TABLE workforce_org_nodes
    ADD COLUMN IF NOT EXISTS lifecycle_state TEXT NOT NULL DEFAULT 'live'
        CHECK (lifecycle_state IN ('live', 'recycled', 'tombstone')),
    ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}';

-- Note: description TEXT already exists on workforce_org_nodes (migration 035)

-- Partial index: only live nodes (most frequent query pattern)
CREATE INDEX IF NOT EXISTS idx_org_nodes_live
    ON workforce_org_nodes (tenant_id, node_type)
    WHERE lifecycle_state = 'live';

-- GIN index for attribute queries
CREATE INDEX IF NOT EXISTS idx_org_nodes_attributes
    ON workforce_org_nodes USING gin (attributes);

-- ─── workforce_employees ─────────────────────────────────────────────────────

ALTER TABLE workforce_employees
    ADD COLUMN IF NOT EXISTS lifecycle_state TEXT NOT NULL DEFAULT 'live'
        CHECK (lifecycle_state IN ('live', 'recycled', 'tombstone')),
    ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}';

-- Partial index: only live employees
CREATE INDEX IF NOT EXISTS idx_employees_live
    ON workforce_employees (tenant_id, org_node_id)
    WHERE lifecycle_state = 'live';

-- GIN index for attribute queries
CREATE INDEX IF NOT EXISTS idx_employees_attributes
    ON workforce_employees USING gin (attributes);
