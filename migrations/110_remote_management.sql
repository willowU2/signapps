-- Migration 110: Remote management — WoL, agent commands, file transfer, session recording

-- Agent command queue (reboot, shutdown, lock, custom)
CREATE TABLE IF NOT EXISTS it.agent_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hardware_id UUID NOT NULL REFERENCES it.hardware(id) ON DELETE CASCADE,
    agent_id UUID,
    command VARCHAR(50) NOT NULL,   -- 'reboot', 'shutdown', 'lock', 'run_script'
    parameters JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, sent, acknowledged, done, failed
    created_by UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    result JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_agent_commands_hw ON it.agent_commands(hardware_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_commands_agent ON it.agent_commands(agent_id, status);

-- File transfer staging (admin → machine or machine → server)
CREATE TABLE IF NOT EXISTS it.file_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hardware_id UUID NOT NULL REFERENCES it.hardware(id) ON DELETE CASCADE,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('push', 'pull')),
    filename VARCHAR(500) NOT NULL,
    size_bytes BIGINT,
    mime_type VARCHAR(100),
    storage_path TEXT,           -- path on server storage
    target_path TEXT,            -- path on remote machine (for push)
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, transferring, done, failed
    created_by UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_file_transfers_hw ON it.file_transfers(hardware_id, status);

-- Session recording toggle on remote.connections
ALTER TABLE remote.connections ADD COLUMN IF NOT EXISTS recording_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE remote.connections ADD COLUMN IF NOT EXISTS recording_path TEXT;

-- Remote session recordings log
CREATE TABLE IF NOT EXISTS remote.session_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES remote.connections(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    recording_file TEXT,          -- path to the recording file
    size_bytes BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'recording' CHECK (status IN ('recording', 'done', 'error'))
);
CREATE INDEX IF NOT EXISTS idx_session_recordings_conn ON remote.session_recordings(connection_id);

-- Network discovery results
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

-- SNMP data store
CREATE TABLE IF NOT EXISTS it.snmp_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL,
    oid VARCHAR(200) NOT NULL,
    oid_name VARCHAR(100),
    value TEXT,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_snmp_data_ip ON it.snmp_data(ip_address, collected_at DESC);
