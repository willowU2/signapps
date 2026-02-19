-- SignApps Platform - Storage Files Tracking Migration
-- Version: 014
-- Date: 2026-02-19

-- ============================================================================
-- Table: storage.files
-- ============================================================================

CREATE TABLE IF NOT EXISTS storage.files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    bucket VARCHAR(255) NOT NULL,
    key TEXT NOT NULL,
    size BIGINT NOT NULL,
    content_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique key per user/bucket
    CONSTRAINT unique_user_file UNIQUE (user_id, bucket, key)
);

-- Create index for quick lookup by user (for recalculate_usage)
CREATE INDEX IF NOT EXISTS idx_storage_files_user_id ON storage.files(user_id);

-- Create index for quick lookup by bucket/key (for deletions)
CREATE INDEX IF NOT EXISTS idx_storage_files_location ON storage.files(bucket, key);

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_files_updated_at ON storage.files;

CREATE TRIGGER update_files_updated_at
    BEFORE UPDATE ON storage.files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
