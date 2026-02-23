-- SignApps Platform - Storage Tier 3 (Sharing)
-- Version: 018
-- Date: 2026-02-22

-- ============================================================================
-- Table: storage.shares
-- ============================================================================

CREATE TABLE IF NOT EXISTS storage.shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bucket VARCHAR(255) NOT NULL,
    key TEXT NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    created_by UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    password_hash VARCHAR(255),
    max_downloads INTEGER,
    download_count INTEGER DEFAULT 0,
    access_type VARCHAR(32) NOT NULL DEFAULT 'download',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- We verify if the file being shared actually exists using a compound foreign key approach.
    CONSTRAINT fk_storage_share_file FOREIGN KEY (created_by, bucket, key) REFERENCES storage.files(user_id, bucket, key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_storage_shares_token ON storage.shares(token);
CREATE INDEX IF NOT EXISTS idx_storage_shares_created_by ON storage.shares(created_by);
CREATE INDEX IF NOT EXISTS idx_storage_shares_file ON storage.shares(bucket, key);
