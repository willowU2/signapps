-- Migration 205: Reverse membership index (memberof) + auto-recompute trigger
-- Auto-computed table: for each person, which groups they belong to and why.
-- Supports direct membership, nested group membership, and node-derived membership.

-- ─── Memberof index ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workforce_org_memberof (
    person_id   UUID NOT NULL,
    group_id    UUID NOT NULL REFERENCES workforce_org_groups(id) ON DELETE CASCADE,
    source      TEXT NOT NULL CHECK (source IN ('direct', 'nested_group', 'node')),
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (person_id, group_id, source)
);

CREATE INDEX IF NOT EXISTS idx_memberof_person
    ON workforce_org_memberof (person_id);
CREATE INDEX IF NOT EXISTS idx_memberof_group
    ON workforce_org_memberof (group_id);

-- ─── Recompute function ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION recompute_group_memberof(p_group_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    -- 1. Delete existing memberof entries for this group
    DELETE FROM workforce_org_memberof
    WHERE group_id = p_group_id;

    -- 2. Insert direct person members
    INSERT INTO workforce_org_memberof (person_id, group_id, source, computed_at)
    SELECT m.member_id, p_group_id, 'direct', now()
    FROM workforce_org_group_members m
    WHERE m.group_id = p_group_id
      AND m.member_type = 'person'
    ON CONFLICT (person_id, group_id, source) DO UPDATE
        SET computed_at = now();

    -- 3. Insert nested group members (via existing memberof for nested groups)
    INSERT INTO workforce_org_memberof (person_id, group_id, source, computed_at)
    SELECT mo.person_id, p_group_id, 'nested_group', now()
    FROM workforce_org_group_members m
    JOIN workforce_org_memberof mo ON mo.group_id = m.member_id
    WHERE m.group_id = p_group_id
      AND m.member_type = 'group'
    ON CONFLICT (person_id, group_id, source) DO UPDATE
        SET computed_at = now();

    -- 4. Insert node members (via closure table + assignments)
    --    Persons who are assigned to any descendant of the group's node members
    INSERT INTO workforce_org_memberof (person_id, group_id, source, computed_at)
    SELECT DISTINCT wa.employee_id, p_group_id, 'node', now()
    FROM workforce_org_group_members m
    JOIN workforce_org_closure c  ON c.ancestor_id = m.member_id
    JOIN workforce_assignments  wa ON wa.org_node_id = c.descendant_id
    WHERE m.group_id = p_group_id
      AND m.member_type = 'node'
    ON CONFLICT (person_id, group_id, source) DO UPDATE
        SET computed_at = now();
END;
$$;

-- ─── Trigger: recompute on member changes ────────────────────────────────────

CREATE OR REPLACE FUNCTION trg_recompute_memberof()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_group_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_group_id := OLD.group_id;
    ELSE
        v_group_id := NEW.group_id;
    END IF;

    PERFORM recompute_group_memberof(v_group_id);
    RETURN NULL; -- AFTER trigger, return value ignored
END;
$$;

CREATE TRIGGER trg_group_members_recompute
    AFTER INSERT OR UPDATE OR DELETE ON workforce_org_group_members
    FOR EACH ROW EXECUTE FUNCTION trg_recompute_memberof();
