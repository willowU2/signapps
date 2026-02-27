-- Schema: PXE Deployment and Asset Management
-- Defines boot scripts (Profiles) and hardware tracking (Assets)

CREATE SCHEMA IF NOT EXISTS pxe;

-- Deployment Profiles (e.g., Ubuntu 24.04, Windows PE)
CREATE TABLE pxe.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    boot_script TEXT NOT NULL, -- The raw iPXE script (e.g., kernel, initrd, boot parameters)
    os_type VARCHAR(64),
    os_version VARCHAR(64),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pxe_profiles_name ON pxe.profiles(name);

-- Hardware Assets tracked by MAC Address
CREATE TABLE pxe.assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mac_address VARCHAR(17) UNIQUE NOT NULL, -- Format: 00:1A:2B:3C:4D:5E
    hostname VARCHAR(255),
    ip_address INET,
    status VARCHAR(32) NOT NULL DEFAULT 'discovered', -- discovered, provisioning, deployed, offline
    profile_id UUID REFERENCES pxe.profiles(id) ON DELETE SET NULL,
    assigned_user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pxe_assets_mac ON pxe.assets(mac_address);
CREATE INDEX idx_pxe_assets_status ON pxe.assets(status);

-- Seed an empty default profile so undocumented MAC addresses don't crash the boot sequence
INSERT INTO pxe.profiles (name, description, boot_script, is_default)
VALUES (
    'Boot Local Disk',
    'Default fall-through profile to boot from local hard drive.',
    '#!ipxe\necho No deployment profile assigned. Booting from local disk...\nexit',
    TRUE
) ON CONFLICT (name) DO NOTHING;
