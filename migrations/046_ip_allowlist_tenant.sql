-- AQ-IPWL: Add IP allowlist JSONB column to tenants table
ALTER TABLE identity.tenants ADD COLUMN IF NOT EXISTS ip_allowlist JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN identity.tenants.ip_allowlist IS 'Array of allowed IP/CIDR entries: [{"address":"10.0.0.0","cidr":"/8","enabled":true}]';
