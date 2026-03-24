ALTER TABLE drive.nodes ADD COLUMN IF NOT EXISTS sha256_hash CHAR(64);
ALTER TABLE drive.nodes ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE drive.nodes ADD COLUMN IF NOT EXISTS encryption_key_id UUID;
ALTER TABLE drive.nodes ADD COLUMN IF NOT EXISTS doc_id UUID;

CREATE INDEX IF NOT EXISTS idx_drive_sha256 ON drive.nodes(sha256_hash) WHERE sha256_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_drive_doc ON drive.nodes(doc_id) WHERE doc_id IS NOT NULL;
