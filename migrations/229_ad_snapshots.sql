-- migrations/229_ad_snapshots.sql
-- AD backup snapshots with manifest for granular restore

CREATE TABLE ad_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    dc_id UUID REFERENCES ad_dc_sites(id),
    snapshot_type TEXT NOT NULL
        CHECK (snapshot_type IN ('full', 'incremental', 'pre_migration', 'pre_restore')),
    storage_path TEXT NOT NULL,
    manifest JSONB DEFAULT '{}',
    tables_included TEXT[] DEFAULT '{}',
    size_bytes BIGINT DEFAULT 0,
    checksum_sha256 TEXT,
    status TEXT DEFAULT 'creating'
        CHECK (status IN ('creating', 'completed', 'restoring', 'expired', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_snapshots_domain ON ad_snapshots(domain_id);
CREATE INDEX idx_snapshots_type ON ad_snapshots(snapshot_type, created_at DESC);
CREATE INDEX idx_snapshots_status ON ad_snapshots(status) WHERE status IN ('creating', 'restoring');
