-- Schema: IT Asset Management and Remote Connections

CREATE SCHEMA IF NOT EXISTS it;

-- IT Hardware Assets (Computers, Servers, Switches)
CREATE TABLE IF NOT EXISTS it.hardware (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(64) NOT NULL, -- e.g., 'server', 'desktop', 'switch', 'router'
    manufacturer VARCHAR(128),
    model VARCHAR(128),
    serial_number VARCHAR(128) UNIQUE,
    purchase_date DATE,
    warranty_expires DATE,
    status VARCHAR(32) DEFAULT 'active', -- active, maintenance, retired
    location VARCHAR(255),
    assigned_user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_it_hardware_type ON it.hardware(type);
CREATE INDEX IF NOT EXISTS idx_it_hardware_status ON it.hardware(status);

-- IT Components (CPU, RAM, Disks)
CREATE TABLE IF NOT EXISTS it.components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hardware_id UUID REFERENCES it.hardware(id) ON DELETE CASCADE,
    type VARCHAR(64) NOT NULL, -- 'cpu', 'ram', 'disk', 'gpu'
    model VARCHAR(128) NOT NULL,
    capacity VARCHAR(64), -- e.g., '16GB', '1TB'
    serial_number VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- IT Software Licenses
CREATE TABLE IF NOT EXISTS it.software_licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    software_name VARCHAR(255) NOT NULL,
    license_key TEXT,
    seats INTEGER,
    seats_used INTEGER DEFAULT 0,
    expires_at DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hardware Network Interfaces (MAC mappings)
CREATE TABLE IF NOT EXISTS it.network_interfaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hardware_id UUID REFERENCES it.hardware(id) ON DELETE CASCADE,
    mac_address VARCHAR(17) UNIQUE NOT NULL,
    ip_address INET,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_it_interfaces_mac ON it.network_interfaces(mac_address);


CREATE SCHEMA IF NOT EXISTS remote;

-- Remote Desktop Connections (Guacamole configurations)
CREATE TABLE IF NOT EXISTS remote.connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hardware_id UUID REFERENCES it.hardware(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    protocol VARCHAR(16) NOT NULL, -- 'rdp', 'vnc', 'ssh', 'telnet'
    hostname VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    username VARCHAR(128),
    password_encrypted TEXT,
    private_key_encrypted TEXT,
    parameters JSONB DEFAULT '{}', -- Guacamole specific connection parameters
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_remote_conn_hardware ON remote.connections(hardware_id);
