-- Migration 221: Deployment profiles, assignments, and history.

CREATE TABLE infrastructure.deploy_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    os_type TEXT CHECK (os_type IN ('windows', 'linux', 'macos', 'custom')),
    os_version TEXT,
    os_image_url TEXT,
    os_config JSONB DEFAULT '{}',
    packages JSONB DEFAULT '[]',
    target_ou TEXT,
    gpo_ids UUID[] DEFAULT '{}',
    post_install_scripts TEXT[] DEFAULT '{}',
    pxe_boot_image TEXT,
    pxe_menu_label TEXT,
    dhcp_scope_id UUID REFERENCES infrastructure.dhcp_scopes(id),
    vlan_id INT,
    is_default BOOLEAN DEFAULT false,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_deploy_profiles_domain ON infrastructure.deploy_profiles(domain_id);

CREATE TABLE infrastructure.deploy_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES infrastructure.deploy_profiles(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL
        CHECK (target_type IN ('org_node', 'group', 'mac_address', 'ip_range')),
    target_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(profile_id, target_type, target_id)
);

CREATE TABLE infrastructure.deploy_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES infrastructure.deploy_profiles(id),
    computer_id UUID,
    mac_address TEXT,
    hostname TEXT,
    status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'booting', 'installing', 'configuring', 'completed', 'failed')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    log TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_deploy_history_profile ON infrastructure.deploy_history(profile_id);
CREATE INDEX idx_deploy_history_status ON infrastructure.deploy_history(status) WHERE status != 'completed';
