-- migrations/228_ad_dc_management.sql
-- DC site topology and FSMO role tracking

CREATE TABLE ad_dc_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    site_id UUID,
    dc_hostname TEXT NOT NULL,
    dc_ip TEXT NOT NULL,
    dc_role TEXT DEFAULT 'rwdc'
        CHECK (dc_role IN ('primary_rwdc', 'rwdc', 'rodc')),
    dc_status TEXT DEFAULT 'provisioning'
        CHECK (dc_status IN ('provisioning', 'online', 'degraded', 'offline', 'decommissioning')),
    is_writable BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false,
    replication_partner_id UUID REFERENCES ad_dc_sites(id),
    promoted_at TIMESTAMPTZ,
    demoted_at TIMESTAMPTZ,
    last_heartbeat_at TIMESTAMPTZ,
    last_replication_at TIMESTAMPTZ,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, dc_hostname)
);

CREATE INDEX idx_dc_sites_domain ON ad_dc_sites(domain_id);
CREATE INDEX idx_dc_sites_site ON ad_dc_sites(site_id);
CREATE INDEX idx_dc_sites_status ON ad_dc_sites(dc_status) WHERE dc_status = 'online';

CREATE TABLE ad_fsmo_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    role TEXT NOT NULL
        CHECK (role IN ('schema_master', 'domain_naming', 'rid_master', 'pdc_emulator', 'infrastructure_master')),
    dc_id UUID NOT NULL REFERENCES ad_dc_sites(id),
    transferred_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, role)
);
