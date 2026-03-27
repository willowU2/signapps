-- Migration: 041_drive_nodes_sha256_hash
-- Adds sha256_hash column to drive.nodes for file deduplication.
-- Date: 2026-03-25

ALTER TABLE drive.nodes
    ADD COLUMN IF NOT EXISTS sha256_hash TEXT;

-- Partial index: only index non-NULL hashes on file nodes for fast dedup lookups.
CREATE INDEX IF NOT EXISTS idx_drive_nodes_sha256_hash
    ON drive.nodes (sha256_hash)
    WHERE node_type = 'file' AND sha256_hash IS NOT NULL AND deleted_at IS NULL;
