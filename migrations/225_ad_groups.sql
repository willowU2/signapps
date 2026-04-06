-- migrations/225_ad_groups.sql
-- AD Security Groups and group membership

CREATE TABLE ad_security_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL
        CHECK (source_type IN ('org_group', 'team', 'position')),
    source_id UUID NOT NULL,
    sam_account_name TEXT NOT NULL,
    distinguished_name TEXT NOT NULL,
    display_name TEXT,
    group_scope TEXT DEFAULT 'global'
        CHECK (group_scope IN ('domain_local', 'global', 'universal')),
    group_type TEXT DEFAULT 'security'
        CHECK (group_type IN ('security', 'distribution')),
    object_sid TEXT,
    sync_status TEXT DEFAULT 'pending'
        CHECK (sync_status IN ('pending', 'synced', 'error', 'orphan')),
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, sam_account_name)
);

CREATE INDEX idx_ad_groups_domain ON ad_security_groups(domain_id);
CREATE INDEX idx_ad_groups_source ON ad_security_groups(source_type, source_id);

CREATE TABLE ad_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES ad_security_groups(id) ON DELETE CASCADE,
    member_type TEXT NOT NULL
        CHECK (member_type IN ('user', 'computer', 'group')),
    member_id UUID NOT NULL,
    sync_status TEXT DEFAULT 'pending',
    UNIQUE(group_id, member_type, member_id)
);

CREATE INDEX idx_ad_gm_group ON ad_group_members(group_id);
