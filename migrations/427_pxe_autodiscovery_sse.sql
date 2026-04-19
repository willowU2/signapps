-- Migration 427: PXE auto-discovery, DHCP request tracking, SSE NOTIFY trigger
--
-- Extends pxe.assets with discovery/boot tracking columns, adds pxe.dhcp_requests
-- audit table, and installs a LISTEN/NOTIFY trigger on pxe.deployments so that
-- the signapps-pxe SSE endpoint can stream live deployment progress updates
-- without polling.

ALTER TABLE pxe.assets
    ADD COLUMN IF NOT EXISTS discovered_via VARCHAR(20) NOT NULL DEFAULT 'manual'
        CHECK (discovered_via IN ('manual', 'dhcp', 'api', 'import')),
    ADD COLUMN IF NOT EXISTS boot_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_boot_profile_id UUID REFERENCES pxe.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS dhcp_vendor_class VARCHAR(255),
    ADD COLUMN IF NOT EXISTS arch_detected VARCHAR(20);

CREATE TABLE IF NOT EXISTS pxe.dhcp_requests (
    id BIGSERIAL PRIMARY KEY,
    mac_address VARCHAR(17) NOT NULL,
    client_ip INET,
    xid BYTEA,
    msg_type VARCHAR(16),
    vendor_class VARCHAR(255),
    arch VARCHAR(20),
    responded BOOLEAN NOT NULL DEFAULT FALSE,
    response_boot_file TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pxe_dhcp_requests_mac ON pxe.dhcp_requests(mac_address);
CREATE INDEX IF NOT EXISTS idx_pxe_dhcp_requests_received_at ON pxe.dhcp_requests(received_at DESC);

CREATE OR REPLACE FUNCTION pxe_deployment_notify() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'pxe_deployment_progress',
        json_build_object(
            'mac', NEW.asset_mac,
            'progress', NEW.progress,
            'status', NEW.status,
            'step', NEW.current_step
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pxe_deployment_progress_notify ON pxe.deployments;
CREATE TRIGGER pxe_deployment_progress_notify
    AFTER UPDATE ON pxe.deployments
    FOR EACH ROW
    WHEN (OLD.progress IS DISTINCT FROM NEW.progress OR OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION pxe_deployment_notify();
