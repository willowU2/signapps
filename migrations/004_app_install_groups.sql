-- Install groups: track multi-service app installations
CREATE TABLE IF NOT EXISTS containers.app_install_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id VARCHAR(255) NOT NULL,
    app_name VARCHAR(255) NOT NULL,
    source_id UUID REFERENCES containers.app_sources(id) ON DELETE SET NULL,
    network_name VARCHAR(255),
    owner_id UUID REFERENCES identity.users(id),
    status VARCHAR(32) NOT NULL DEFAULT 'installing',
    service_count INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE containers.managed
    ADD COLUMN IF NOT EXISTS install_group_id UUID
    REFERENCES containers.app_install_groups(id) ON DELETE SET NULL;
