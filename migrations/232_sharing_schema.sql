-- 232_sharing_schema.sql
-- Unified sharing & permissions system

CREATE SCHEMA IF NOT EXISTS sharing;

-- 1. GRANTS
CREATE TABLE IF NOT EXISTS sharing.grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL,
    resource_id UUID NOT NULL,
    grantee_type TEXT NOT NULL,
    grantee_id UUID,
    role TEXT NOT NULL,
    can_reshare BOOLEAN NOT NULL DEFAULT false,
    inherit BOOLEAN NOT NULL DEFAULT true,
    granted_by UUID NOT NULL REFERENCES identity.users(id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_resource_type CHECK (resource_type IN (
        'file', 'folder', 'calendar', 'event', 'document',
        'form', 'contact_book', 'channel', 'asset', 'vault_entry'
    )),
    CONSTRAINT chk_grantee_type CHECK (grantee_type IN (
        'user', 'group', 'org_node', 'everyone'
    )),
    CONSTRAINT chk_role CHECK (role IN ('viewer', 'editor', 'manager', 'deny')),
    CONSTRAINT chk_everyone_no_id CHECK (
        (grantee_type = 'everyone' AND grantee_id IS NULL) OR
        (grantee_type != 'everyone' AND grantee_id IS NOT NULL)
    ),
    CONSTRAINT chk_vault_no_everyone CHECK (
        NOT (resource_type = 'vault_entry' AND grantee_type = 'everyone')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_grants_unique
    ON sharing.grants (tenant_id, resource_type, resource_id, grantee_type, COALESCE(grantee_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_grants_resource
    ON sharing.grants (tenant_id, resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_grants_grantee
    ON sharing.grants (tenant_id, grantee_type, grantee_id)
    WHERE grantee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_grants_expires
    ON sharing.grants (expires_at)
    WHERE expires_at IS NOT NULL;

-- 2. POLICIES
CREATE TABLE IF NOT EXISTS sharing.policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    container_type TEXT NOT NULL,
    container_id UUID NOT NULL,
    grantee_type TEXT NOT NULL,
    grantee_id UUID,
    default_role TEXT NOT NULL,
    can_reshare BOOLEAN NOT NULL DEFAULT false,
    apply_to_existing BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES identity.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_policy_container_type CHECK (container_type IN (
        'folder', 'calendar', 'form_space', 'channel_group'
    )),
    CONSTRAINT chk_policy_grantee_type CHECK (grantee_type IN (
        'user', 'group', 'org_node', 'everyone'
    )),
    CONSTRAINT chk_policy_role CHECK (default_role IN ('viewer', 'editor', 'manager'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_policies_unique
    ON sharing.policies (tenant_id, container_type, container_id, grantee_type, COALESCE(grantee_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_policies_container
    ON sharing.policies (tenant_id, container_type, container_id);

-- 3. TEMPLATES
CREATE TABLE IF NOT EXISTS sharing.templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    grants JSONB NOT NULL DEFAULT '[]',
    created_by UUID NOT NULL REFERENCES identity.users(id),
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_name
    ON sharing.templates (tenant_id, name);

-- 4. CAPABILITIES
CREATE TABLE IF NOT EXISTS sharing.capabilities (
    resource_type TEXT NOT NULL,
    role TEXT NOT NULL,
    actions TEXT[] NOT NULL DEFAULT '{}',
    PRIMARY KEY (resource_type, role),
    CONSTRAINT chk_cap_role CHECK (role IN ('viewer', 'editor', 'manager'))
);

INSERT INTO sharing.capabilities (resource_type, role, actions) VALUES
    ('file', 'viewer',  ARRAY['read', 'preview', 'download']),
    ('file', 'editor',  ARRAY['read', 'preview', 'download', 'write', 'upload', 'rename', 'move', 'version']),
    ('file', 'manager', ARRAY['read', 'preview', 'download', 'write', 'upload', 'rename', 'move', 'version', 'delete', 'share', 'set_policy', 'trash', 'restore']),
    ('folder', 'viewer',  ARRAY['list', 'read_children']),
    ('folder', 'editor',  ARRAY['list', 'read_children', 'create_child', 'upload', 'rename']),
    ('folder', 'manager', ARRAY['list', 'read_children', 'create_child', 'upload', 'rename', 'delete', 'share', 'set_policy', 'move']),
    ('calendar', 'viewer',  ARRAY['read', 'export']),
    ('calendar', 'editor',  ARRAY['read', 'export', 'create_event', 'edit_event', 'rsvp']),
    ('calendar', 'manager', ARRAY['read', 'export', 'create_event', 'edit_event', 'rsvp', 'delete_event', 'share', 'configure', 'delete_calendar']),
    ('event', 'viewer',  ARRAY['read', 'export']),
    ('event', 'editor',  ARRAY['read', 'export', 'edit', 'rsvp', 'add_attachment']),
    ('event', 'manager', ARRAY['read', 'export', 'edit', 'rsvp', 'add_attachment', 'delete', 'share', 'invite']),
    ('document', 'viewer',  ARRAY['read', 'export', 'comment']),
    ('document', 'editor',  ARRAY['read', 'export', 'comment', 'write', 'suggest', 'history']),
    ('document', 'manager', ARRAY['read', 'export', 'comment', 'write', 'suggest', 'history', 'delete', 'share', 'lock', 'template']),
    ('form', 'viewer',  ARRAY['read', 'submit', 'view_own_responses']),
    ('form', 'editor',  ARRAY['read', 'submit', 'view_own_responses', 'edit_fields', 'view_all_responses', 'export']),
    ('form', 'manager', ARRAY['read', 'submit', 'view_own_responses', 'edit_fields', 'view_all_responses', 'export', 'delete', 'share', 'configure', 'archive']),
    ('contact_book', 'viewer',  ARRAY['read', 'search', 'export_vcard']),
    ('contact_book', 'editor',  ARRAY['read', 'search', 'export_vcard', 'create', 'edit', 'import', 'merge']),
    ('contact_book', 'manager', ARRAY['read', 'search', 'export_vcard', 'create', 'edit', 'import', 'merge', 'delete', 'share', 'bulk_ops']),
    ('channel', 'viewer',  ARRAY['read', 'search_history']),
    ('channel', 'editor',  ARRAY['read', 'search_history', 'post', 'react', 'thread', 'pin']),
    ('channel', 'manager', ARRAY['read', 'search_history', 'post', 'react', 'thread', 'pin', 'delete_msg', 'share', 'configure', 'archive', 'kick']),
    ('asset', 'viewer',  ARRAY['read', 'view_history']),
    ('asset', 'editor',  ARRAY['read', 'view_history', 'edit', 'assign', 'add_note', 'check_out']),
    ('asset', 'manager', ARRAY['read', 'view_history', 'edit', 'assign', 'add_note', 'check_out', 'delete', 'share', 'decommission', 'transfer']),
    ('vault_entry', 'viewer',  ARRAY['read_metadata']),
    ('vault_entry', 'editor',  ARRAY['read_metadata', 'read_secret', 'edit', 'rotate']),
    ('vault_entry', 'manager', ARRAY['read_metadata', 'read_secret', 'edit', 'rotate', 'delete', 'share', 'audit']);

-- 5. DEFAULTS
CREATE TABLE IF NOT EXISTS sharing.defaults (
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL,
    default_visibility TEXT NOT NULL DEFAULT 'private',
    PRIMARY KEY (tenant_id, resource_type),
    CONSTRAINT chk_default_visibility CHECK (default_visibility IN (
        'private', 'workspace', 'org_node', 'tenant'
    ))
);

-- 6. AUDIT LOG
CREATE TABLE IF NOT EXISTS sharing.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID NOT NULL,
    actor_id UUID NOT NULL,
    action TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_resource
    ON sharing.audit_log (tenant_id, resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor
    ON sharing.audit_log (tenant_id, actor_id, created_at DESC);

CREATE OR REPLACE FUNCTION sharing.prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'sharing.audit_log is immutable — UPDATE and DELETE are forbidden';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_no_update
    BEFORE UPDATE ON sharing.audit_log
    FOR EACH ROW EXECUTE FUNCTION sharing.prevent_audit_mutation();

CREATE TRIGGER trg_audit_no_delete
    BEFORE DELETE ON sharing.audit_log
    FOR EACH ROW EXECUTE FUNCTION sharing.prevent_audit_mutation();
