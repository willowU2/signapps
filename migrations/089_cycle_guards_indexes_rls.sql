-- Migration 089: Self-referential cycle guards + missing indexes + RLS
-- Adds CHECK constraints to prevent self-parent cycles, plugs missing indexes,
-- and enables row-level security on scheduling tables.

-- ============================================================
-- 1. Self-referential cycle guards
-- ============================================================

DO $$
BEGIN
    ALTER TABLE identity.groups
        ADD CONSTRAINT chk_groups_no_self_parent CHECK (id != parent_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE scheduling.time_items
        ADD CONSTRAINT chk_time_items_no_self_parent CHECK (id != parent_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. Missing indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_it_components_hardware       ON it.components(hardware_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_user         ON social.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_post_targets_account  ON social.post_targets(account_id);
CREATE INDEX IF NOT EXISTS idx_social_post_targets_status   ON social.post_targets(status);
CREATE INDEX IF NOT EXISTS idx_mail_emails_is_deleted       ON mail.emails(is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_mail_emails_is_draft         ON mail.emails(is_draft)   WHERE is_draft   = true;

-- ============================================================
-- 3. Row-Level Security on scheduling tables
-- ============================================================

ALTER TABLE scheduling.time_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling.resources  ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling.templates  ENABLE ROW LEVEL SECURITY;

-- Tenant-isolation policies: allow rows whose tenant_id matches the
-- session-local setting "app.current_tenant_id".
-- Use CREATE POLICY ... IF NOT EXISTS (PG 15+); fall back to DO block for
-- older versions.

DO $$
BEGIN
    CREATE POLICY tenant_isolation ON scheduling.time_items
        FOR ALL USING (
            tenant_id = current_setting('app.current_tenant_id', true)::uuid
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE POLICY tenant_isolation ON scheduling.resources
        FOR ALL USING (
            tenant_id = current_setting('app.current_tenant_id', true)::uuid
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE POLICY tenant_isolation ON scheduling.templates
        FOR ALL USING (
            tenant_id = current_setting('app.current_tenant_id', true)::uuid
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
