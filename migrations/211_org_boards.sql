-- Migration 211: Governance Boards for org nodes
--
-- Each org node can have a board of governance: a set of persons responsible
-- for that node. If a node has no board, it inherits from its parent.
-- Exactly one member must be the decision maker (enforced at application level).

-- ── Board entity (one per node maximum) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS workforce_org_boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL UNIQUE REFERENCES workforce_org_nodes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Board members ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workforce_org_board_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID NOT NULL REFERENCES workforce_org_boards(id) ON DELETE CASCADE,
    person_id UUID NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    is_decision_maker BOOLEAN DEFAULT false,
    sort_order INT DEFAULT 0,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (board_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_board_members_board ON workforce_org_board_members(board_id);
CREATE INDEX IF NOT EXISTS idx_board_members_person ON workforce_org_board_members(person_id);

-- ── Update allowed_children to match spec hierarchy ─────────────────────────

UPDATE workforce_org_node_types
SET allowed_children = '["subsidiary","bu","department"]'::jsonb,
    allowed_children_arr = ARRAY['subsidiary','bu','department']
WHERE name = 'group' AND tenant_id = '00000000-0000-0000-0000-000000000000';

UPDATE workforce_org_node_types
SET allowed_children = '["bu","department","service"]'::jsonb,
    allowed_children_arr = ARRAY['bu','department','service']
WHERE name = 'subsidiary' AND tenant_id = '00000000-0000-0000-0000-000000000000';

UPDATE workforce_org_node_types
SET allowed_children = '["department","service","team"]'::jsonb,
    allowed_children_arr = ARRAY['department','service','team']
WHERE name = 'bu' AND tenant_id = '00000000-0000-0000-0000-000000000000';

UPDATE workforce_org_node_types
SET allowed_children = '["service","team","position"]'::jsonb,
    allowed_children_arr = ARRAY['service','team','position']
WHERE name = 'department' AND tenant_id = '00000000-0000-0000-0000-000000000000';

UPDATE workforce_org_node_types
SET allowed_children = '["team","position"]'::jsonb,
    allowed_children_arr = ARRAY['team','position']
WHERE name = 'service' AND tenant_id = '00000000-0000-0000-0000-000000000000';

UPDATE workforce_org_node_types
SET allowed_children = '["position"]'::jsonb,
    allowed_children_arr = ARRAY['position']
WHERE name = 'team' AND tenant_id = '00000000-0000-0000-0000-000000000000';

UPDATE workforce_org_node_types
SET allowed_children = '[]'::jsonb,
    allowed_children_arr = ARRAY[]::TEXT[]
WHERE name = 'position' AND tenant_id = '00000000-0000-0000-0000-000000000000';
