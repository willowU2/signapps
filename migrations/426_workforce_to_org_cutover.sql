-- S1 org+RBAC refonte — Wave 2, Task 13.
-- Hard-cut: copy any lingering workforce_org_* rows into the canonical
-- org_* tables, then drop the legacy tables.
-- Idempotent: ON CONFLICT DO NOTHING protects against re-runs and the
-- DROP IF EXISTS / pg_tables guards let the migration apply cleanly on
-- databases where the legacy tables never existed.

-- 1) Copy workforce org_nodes → org_nodes (if the legacy table exists)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'workforce_org_nodes') THEN
        INSERT INTO org_nodes (id, tenant_id, kind, parent_id, path, name, slug, attributes, active, created_at, updated_at)
        SELECT id, tenant_id,
               COALESCE(kind::text, 'unit')::text AS kind,
               parent_id,
               COALESCE(path::text, slug)::ltree AS path,
               name, slug, COALESCE(attributes, '{}'::jsonb), COALESCE(active, true),
               COALESCE(created_at, now()), COALESCE(updated_at, now())
        FROM workforce_org_nodes
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- 2) Copy workforce boards → org_boards + members
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'workforce_org_boards') THEN
        INSERT INTO org_boards (id, node_id, created_at)
        SELECT id, node_id, COALESCE(created_at, now())
        FROM workforce_org_boards
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO org_board_members (id, board_id, person_id, role, is_decision_maker, sort_order)
        SELECT id, board_id, person_id, role, COALESCE(is_decision_maker, false), COALESCE(sort_order, 0)
        FROM workforce_org_board_members
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- 3) Copy workforce_employees → org_persons (map as person rows)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'workforce_employees') THEN
        INSERT INTO org_persons (id, tenant_id, user_id, email, first_name, last_name, attributes, active, created_at, updated_at)
        SELECT id, tenant_id, user_id, email, first_name, last_name, COALESCE(attributes, '{}'::jsonb), COALESCE(active, true),
               COALESCE(created_at, now()), COALESCE(updated_at, now())
        FROM workforce_employees
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- 4) Drop legacy tables (CASCADE so foreign keys are cleaned).
DROP TABLE IF EXISTS workforce_org_board_members CASCADE;
DROP TABLE IF EXISTS workforce_org_boards CASCADE;
DROP TABLE IF EXISTS workforce_org_nodes CASCADE;
DROP TABLE IF EXISTS workforce_ad_sync_log CASCADE;
DROP TABLE IF EXISTS workforce_ad_config CASCADE;
DROP TABLE IF EXISTS workforce_groups CASCADE;
DROP TABLE IF EXISTS workforce_policies CASCADE;
DROP TABLE IF EXISTS workforce_policy_bindings CASCADE;
DROP TABLE IF EXISTS workforce_delegations CASCADE;
-- workforce_employees kept if still referenced by HR (attendance/payroll);
-- otherwise drop as well:
-- DROP TABLE IF EXISTS workforce_employees CASCADE;
