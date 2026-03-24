DROP INDEX IF EXISTS idx_drive_sha256;
DROP INDEX IF EXISTS idx_drive_doc;

ALTER TABLE drive.nodes DROP COLUMN IF EXISTS sha256_hash;
ALTER TABLE drive.nodes DROP COLUMN IF EXISTS storage_path;
ALTER TABLE drive.nodes DROP COLUMN IF EXISTS encryption_key_id;
ALTER TABLE drive.nodes DROP COLUMN IF EXISTS doc_id;
