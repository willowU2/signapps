-- 133: Add recording columns to remote.sessions (Feature 26)
ALTER TABLE remote.sessions
    ADD COLUMN IF NOT EXISTS file_path  TEXT,
    ADD COLUMN IF NOT EXISTS size_bytes BIGINT;
