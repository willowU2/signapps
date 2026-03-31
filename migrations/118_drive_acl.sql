-- migrations/118_drive_acl.sql
-- Drive SP1: ACL, Audit, Alert Config, Group extensions

-- ═══ ACL ═══

DO $$ BEGIN
    CREATE TYPE drive.acl_role AS ENUM ('viewer', 'downloader', 'editor', 'contributor', 'manager');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE drive.grantee_type AS ENUM ('user', 'group', 'everyone');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE drive.nodes
    ADD COLUMN IF NOT EXISTS inherit_permissions BOOLEAN DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS drive.acl (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES drive.nodes(id) ON DELETE CASCADE,
    grantee_type drive.grantee_type NOT NULL,
    grantee_id UUID,
    role drive.acl_role NOT NULL,
    inherit BOOLEAN DEFAULT TRUE,
    granted_by UUID NOT NULL REFERENCES identity.users(id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(node_id, grantee_type, grantee_id)
);

CREATE INDEX IF NOT EXISTS idx_acl_node ON drive.acl(node_id);
CREATE INDEX IF NOT EXISTS idx_acl_grantee ON drive.acl(grantee_type, grantee_id);
CREATE INDEX IF NOT EXISTS idx_acl_expires ON drive.acl(expires_at) WHERE expires_at IS NOT NULL;

-- ═══ AUDIT ═══

DO $$ BEGIN
    CREATE TYPE drive.audit_action AS ENUM (
        'view', 'download', 'create', 'update', 'delete', 'restore',
        'share', 'unshare', 'permission_change', 'access_denied',
        'move', 'rename', 'copy', 'trash', 'untrash', 'version_restore'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS drive.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID,
    node_path TEXT NOT NULL,
    action drive.audit_action NOT NULL,
    actor_id UUID NOT NULL REFERENCES identity.users(id),
    actor_ip INET,
    actor_geo TEXT,
    file_hash TEXT,
    details JSONB DEFAULT '{}',
    prev_log_hash TEXT,
    log_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_node ON drive.audit_log(node_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON drive.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON drive.audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON drive.audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_hash ON drive.audit_log(log_hash);

-- ═══ ALERT CONFIG ═══

CREATE TABLE IF NOT EXISTS drive.audit_alert_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    alert_type TEXT NOT NULL,
    threshold JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN DEFAULT TRUE,
    notify_emails TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ GROUP EXTENSIONS ═══

ALTER TABLE identity.groups
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'local',
    ADD COLUMN IF NOT EXISTS external_id TEXT,
    ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_groups_source ON identity.groups(source);
CREATE INDEX IF NOT EXISTS idx_groups_external ON identity.groups(external_id) WHERE external_id IS NOT NULL;

-- ═══ MIGRATE OLD PERMISSIONS ═══

DO $$ BEGIN
    INSERT INTO drive.acl (node_id, grantee_type, grantee_id, role, granted_by, created_at)
    SELECT
        node_id,
        CASE WHEN group_id IS NOT NULL THEN 'group'::drive.grantee_type ELSE 'user'::drive.grantee_type END,
        COALESCE(user_id, group_id),
        role::text::drive.acl_role,
        granted_by,
        created_at
    FROM drive.permissions
    ON CONFLICT DO NOTHING;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Default alert configs
INSERT INTO drive.audit_alert_config (org_id, alert_type, threshold) VALUES
    ('00000000-0000-0000-0000-000000000000', 'mass_download', '{"count": 50, "window_minutes": 10}'),
    ('00000000-0000-0000-0000-000000000000', 'off_hours', '{"start_hour": 22, "end_hour": 6}'),
    ('00000000-0000-0000-0000-000000000000', 'access_denied_burst', '{"count": 5, "window_minutes": 5}'),
    ('00000000-0000-0000-0000-000000000000', 'mass_delete', '{"count": 20, "window_minutes": 5}')
ON CONFLICT DO NOTHING;

-- Updated_at triggers
CREATE OR REPLACE FUNCTION drive.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY['acl', 'audit_alert_config'])
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_drive_%s_updated ON drive.%s', t, t);
        EXECUTE format('CREATE TRIGGER trg_drive_%s_updated BEFORE UPDATE ON drive.%s FOR EACH ROW EXECUTE FUNCTION drive.update_updated_at()', t, t);
    END LOOP;
END $$;
