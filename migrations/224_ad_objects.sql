-- migrations/224_ad_objects.sql
-- AD object tables: OUs, User Accounts, Computer Accounts

CREATE TABLE IF NOT EXISTS ad_ous (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES core.org_nodes(id) ON DELETE CASCADE,
    distinguished_name TEXT NOT NULL,
    parent_ou_id UUID REFERENCES ad_ous(id),
    guid TEXT,
    mail_distribution_enabled BOOLEAN DEFAULT true,
    sync_status TEXT DEFAULT 'pending'
        CHECK (sync_status IN ('pending', 'synced', 'error', 'orphan')),
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_ad_ous_domain ON ad_ous(domain_id);
CREATE INDEX IF NOT EXISTS idx_ad_ous_node ON ad_ous(node_id);

CREATE TABLE IF NOT EXISTS ad_user_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES core.persons(id) ON DELETE CASCADE,
    ou_id UUID REFERENCES ad_ous(id),
    sam_account_name TEXT NOT NULL,
    user_principal_name TEXT NOT NULL,
    distinguished_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    title TEXT,
    department TEXT,
    mail TEXT,
    mail_domain_id UUID REFERENCES infrastructure.domains(id),
    account_flags INT DEFAULT 512,
    object_sid TEXT,
    password_must_change BOOLEAN DEFAULT true,
    is_enabled BOOLEAN DEFAULT true,
    sync_status TEXT DEFAULT 'pending'
        CHECK (sync_status IN ('pending', 'synced', 'error', 'disabled')),
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, sam_account_name),
    UNIQUE(domain_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_ad_users_domain ON ad_user_accounts(domain_id);
CREATE INDEX IF NOT EXISTS idx_ad_users_person ON ad_user_accounts(person_id);
CREATE INDEX IF NOT EXISTS idx_ad_users_ou ON ad_user_accounts(ou_id);

CREATE TABLE IF NOT EXISTS ad_computer_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    hardware_id UUID,
    sam_account_name TEXT NOT NULL,
    distinguished_name TEXT NOT NULL,
    dns_hostname TEXT,
    os_name TEXT,
    os_version TEXT,
    object_sid TEXT,
    is_enabled BOOLEAN DEFAULT true,
    sync_status TEXT DEFAULT 'pending'
        CHECK (sync_status IN ('pending', 'synced', 'error', 'disabled')),
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, sam_account_name)
);

CREATE INDEX IF NOT EXISTS idx_ad_computers_domain ON ad_computer_accounts(domain_id);
