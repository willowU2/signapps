-- Drive SP3 Backup System: plans, snapshots, entries

DO $$ BEGIN CREATE TYPE storage.backup_type AS ENUM ('full', 'incremental', 'differential'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE storage.backup_status AS ENUM ('running', 'completed', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.backup_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    schedule TEXT NOT NULL DEFAULT '0 2 * * *',
    backup_type storage.backup_type DEFAULT 'incremental',
    retention_days INT DEFAULT 30,
    max_snapshots INT DEFAULT 10,
    include_paths TEXT[] DEFAULT '{}',
    exclude_paths TEXT[] DEFAULT '{}',
    enabled BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS storage.backup_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES storage.backup_plans(id) ON DELETE CASCADE,
    backup_type storage.backup_type NOT NULL,
    status storage.backup_status DEFAULT 'running',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    files_count INT DEFAULT 0,
    total_size BIGINT DEFAULT 0,
    storage_path TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS storage.backup_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES storage.backup_snapshots(id) ON DELETE CASCADE,
    node_id UUID,
    node_path TEXT NOT NULL,
    file_hash TEXT,
    file_size BIGINT DEFAULT 0,
    backup_key TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_snapshots_plan ON storage.backup_snapshots(plan_id);
CREATE INDEX IF NOT EXISTS idx_backup_entries_snapshot ON storage.backup_entries(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_backup_entries_node ON storage.backup_entries(node_id);
