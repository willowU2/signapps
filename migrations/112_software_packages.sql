-- Migration 112: Software deployment system
-- SD1-SD4

CREATE TABLE IF NOT EXISTS it.software_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    version VARCHAR(100) NOT NULL,
    publisher VARCHAR(255),
    platform VARCHAR(20) NOT NULL,
    installer_type VARCHAR(20) NOT NULL,
    silent_args VARCHAR(500),
    file_path TEXT,
    file_hash VARCHAR(64),
    file_size BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS it.deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES it.software_packages(id),
    hardware_id UUID NOT NULL REFERENCES it.hardware(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    exit_code INTEGER,
    output TEXT
);

CREATE INDEX IF NOT EXISTS idx_software_packages_platform ON it.software_packages(platform);
CREATE INDEX IF NOT EXISTS idx_deployments_package_id ON it.deployments(package_id);
CREATE INDEX IF NOT EXISTS idx_deployments_hardware_id ON it.deployments(hardware_id);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON it.deployments(status);
