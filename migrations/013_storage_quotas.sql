-- SignApps Platform - Storage Quotas Migration
-- Version: 013
-- Date: 2026-02-16

-- ============================================================================
-- Schema: Storage Quotas
-- ============================================================================

-- Create quotas table if not exists (in case of re-run)
CREATE TABLE IF NOT EXISTS storage.quotas (
    user_id UUID PRIMARY KEY REFERENCES identity.users(id) ON DELETE CASCADE,
    
    -- Limits (NULL means unlimited)
    max_storage_bytes BIGINT,
    max_files BIGINT,
    max_file_size_bytes BIGINT,
    allowed_buckets TEXT[], -- NULL means all allowed
    
    -- Current Usage
    used_storage_bytes BIGINT NOT NULL DEFAULT 0,
    file_count BIGINT NOT NULL DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for quick lookup
CREATE INDEX IF NOT EXISTS idx_quotas_user_id ON storage.quotas(user_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_quotas_updated_at ON storage.quotas;

CREATE TRIGGER update_quotas_updated_at
    BEFORE UPDATE ON storage.quotas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default quotas for existing users (if any)
INSERT INTO storage.quotas (user_id, max_storage_bytes, max_files)
SELECT id, 10737418240, 1000 -- Default: 10GB, 1000 files
FROM identity.users
ON CONFLICT (user_id) DO NOTHING;
