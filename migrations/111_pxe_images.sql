-- Migration 111: PXE images and deployment tracking
-- PX2, PX4

CREATE SCHEMA IF NOT EXISTS pxe;

CREATE TABLE IF NOT EXISTS pxe.images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    os_type VARCHAR(50) NOT NULL,
    os_version VARCHAR(50),
    image_type VARCHAR(20) NOT NULL DEFAULT 'kernel',
    file_path TEXT NOT NULL,
    file_size BIGINT,
    file_hash VARCHAR(64),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pxe.deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_mac VARCHAR(17) NOT NULL UNIQUE,
    profile_id UUID REFERENCES pxe.profiles(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    current_step VARCHAR(255),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pxe_images_os_type ON pxe.images(os_type);
CREATE INDEX IF NOT EXISTS idx_pxe_deployments_mac ON pxe.deployments(asset_mac);
CREATE INDEX IF NOT EXISTS idx_pxe_deployments_status ON pxe.deployments(status);
