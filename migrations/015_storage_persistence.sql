-- SignApps Platform - Storage Persistence Migration
-- Version: 015
-- Date: 2026-02-19

-- ============================================================================
-- Table: storage.trash
-- ============================================================================

CREATE TABLE IF NOT EXISTS storage.trash (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    original_bucket VARCHAR(255) NOT NULL,
    original_key TEXT NOT NULL,
    trash_key TEXT NOT NULL UNIQUE,
    size BIGINT NOT NULL,
    content_type TEXT,
    deleted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

CREATE INDEX IF NOT EXISTS idx_storage_trash_user_id ON storage.trash(user_id);

-- ============================================================================
-- Table: storage.favorites
-- ============================================================================

CREATE TABLE IF NOT EXISTS storage.favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    bucket VARCHAR(255) NOT NULL,
    key TEXT NOT NULL,
    is_folder BOOLEAN NOT NULL DEFAULT FALSE,
    display_name TEXT,
    color VARCHAR(32),
    sort_order INTEGER DEFAULT 0,
    added_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_favorite UNIQUE (user_id, bucket, key)
);

CREATE INDEX IF NOT EXISTS idx_storage_favorites_user_id ON storage.favorites(user_id);
