-- Migration 215: AD-integrated DNS zones and records
-- Extends securelink DNS with authoritative zones for AD domains.
-- Dynamic records have a timestamp for scavenging; static records have NULL timestamp.

CREATE TABLE IF NOT EXISTS ad_dns_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES ad_domains(id) ON DELETE CASCADE,
    zone_name TEXT NOT NULL,
    zone_type TEXT DEFAULT 'primary'
        CHECK (zone_type IN ('primary', 'stub', 'forwarder')),
    soa_serial BIGINT DEFAULT 1,
    soa_refresh INT DEFAULT 900,
    soa_retry INT DEFAULT 600,
    soa_expire INT DEFAULT 86400,
    soa_minimum INT DEFAULT 3600,
    allow_dynamic_update BOOLEAN DEFAULT true,
    scavenge_interval_hours INT DEFAULT 168,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, zone_name)
);

CREATE INDEX IF NOT EXISTS idx_ad_dns_zones_domain ON ad_dns_zones(domain_id);

CREATE TABLE IF NOT EXISTS ad_dns_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID NOT NULL REFERENCES ad_dns_zones(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    record_type TEXT NOT NULL
        CHECK (record_type IN ('A', 'AAAA', 'SRV', 'CNAME', 'PTR', 'NS', 'TXT', 'MX', 'SOA')),
    rdata JSONB NOT NULL,
    ttl INT DEFAULT 3600,
    is_static BOOLEAN DEFAULT false,
    timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dns_records_lookup ON ad_dns_records(zone_id, name, record_type);
CREATE INDEX IF NOT EXISTS idx_dns_records_scavenge ON ad_dns_records(timestamp)
    WHERE timestamp IS NOT NULL;
