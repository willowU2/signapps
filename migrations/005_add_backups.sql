-- Backup profiles: configuration for backup jobs
CREATE TABLE IF NOT EXISTS containers.backup_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    container_ids UUID[] NOT NULL,
    schedule VARCHAR(100),
    destination_type VARCHAR(50) NOT NULL,
    destination_config JSONB NOT NULL DEFAULT '{}',
    retention_policy JSONB,
    password_encrypted TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMPTZ,
    owner_id UUID REFERENCES identity.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backup runs: history of backup executions
CREATE TABLE IF NOT EXISTS containers.backup_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES containers.backup_profiles(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    snapshot_id VARCHAR(255),
    size_bytes BIGINT,
    files_new INT,
    files_changed INT,
    duration_seconds INT,
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_backup_runs_profile ON containers.backup_runs(profile_id);
CREATE INDEX IF NOT EXISTS idx_backup_runs_status ON containers.backup_runs(status);
