-- Migration 212: Add 'governance' to the policy domain CHECK constraint
-- and seed a default governance policy for board composition rules.

-- ── Step 1: Update the CHECK constraint to include 'governance' ────────────

ALTER TABLE workforce_org_policies
    DROP CONSTRAINT IF EXISTS workforce_org_policies_domain_check;

DO $$ BEGIN ALTER TABLE workforce_org_policies
    ADD CONSTRAINT workforce_org_policies_domain_check
    CHECK (domain IN ('security', 'modules', 'naming', 'delegation', 'compliance', 'governance', 'custom')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Step 2: Seed default governance policy ─────────────────────────────────

INSERT INTO workforce_org_policies (tenant_id, name, domain, priority, is_enforced, is_disabled, settings, version)
SELECT
    '00000000-0000-0000-0000-000000000000'::uuid,
    'Default Governance Rules',
    'governance',
    50,
    false,
    false,
    '{"board_required": true, "min_members": 1, "required_roles": ["president"], "optional_roles": ["vice_president", "treasurer", "secretary", "dpo", "cfo", "cto"], "max_members": 15}'::jsonb,
    1
WHERE NOT EXISTS (
    SELECT 1 FROM workforce_org_policies
    WHERE tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    AND domain = 'governance'
);
