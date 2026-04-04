-- Migration 210: Fix delegation scope_node_id to NOT NULL
-- The spec requires every delegation to be scoped to a specific org node subtree.

ALTER TABLE workforce_org_delegations
    ALTER COLUMN scope_node_id SET NOT NULL;
