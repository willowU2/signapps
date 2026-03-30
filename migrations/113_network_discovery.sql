-- Migration 113: Network discovery — ensure tables exist (may be created by 110)
-- This migration is idempotent, tables use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS it.network_discoveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subnet VARCHAR(50) NOT NULL,
    ip_address INET NOT NULL,
    mac_address VARCHAR(17),
    hostname TEXT,
    os_guess TEXT,
    response_time_ms INTEGER,
    open_ports INTEGER[] DEFAULT '{}',
    first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
    hardware_id UUID REFERENCES it.hardware(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_net_discoveries_ip ON it.network_discoveries(ip_address);
CREATE INDEX IF NOT EXISTS idx_net_discoveries_subnet ON it.network_discoveries(subnet);

CREATE TABLE IF NOT EXISTS it.snmp_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL,
    oid VARCHAR(200) NOT NULL,
    oid_name VARCHAR(100),
    value TEXT,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_snmp_data_ip ON it.snmp_data(ip_address, collected_at DESC);
