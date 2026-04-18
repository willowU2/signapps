-- Migration 220: DHCP scopes, leases, and reservations.

CREATE TABLE IF NOT EXISTS infrastructure.dhcp_scopes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    site_id UUID,
    name TEXT NOT NULL,
    subnet TEXT NOT NULL,
    range_start TEXT NOT NULL,
    range_end TEXT NOT NULL,
    gateway TEXT,
    dns_servers TEXT[] DEFAULT '{}',
    ntp_servers TEXT[] DEFAULT '{}',
    domain_name TEXT,
    lease_duration_hours INT DEFAULT 8,
    pxe_server TEXT,
    pxe_bootfile TEXT,
    options JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dhcp_scopes_domain ON infrastructure.dhcp_scopes(domain_id);

CREATE TABLE IF NOT EXISTS infrastructure.dhcp_leases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_id UUID NOT NULL REFERENCES infrastructure.dhcp_scopes(id) ON DELETE CASCADE,
    ip_address TEXT NOT NULL,
    mac_address TEXT NOT NULL,
    hostname TEXT,
    computer_id UUID,
    lease_start TIMESTAMPTZ NOT NULL,
    lease_end TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(scope_id, ip_address)
);

CREATE INDEX IF NOT EXISTS idx_leases_scope ON infrastructure.dhcp_leases(scope_id);
CREATE INDEX IF NOT EXISTS idx_leases_mac ON infrastructure.dhcp_leases(mac_address);
CREATE INDEX IF NOT EXISTS idx_leases_active ON infrastructure.dhcp_leases(lease_end) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS infrastructure.dhcp_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_id UUID NOT NULL REFERENCES infrastructure.dhcp_scopes(id) ON DELETE CASCADE,
    mac_address TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    hostname TEXT,
    description TEXT,
    computer_id UUID,
    UNIQUE(scope_id, mac_address)
);
