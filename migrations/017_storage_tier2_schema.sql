-- SignApps Platform - Storage Tier 2 (Tags & Versioning) Migration
-- Version: 017
-- Date: 2026-02-22

-- ============================================================================
-- Table: storage.tags
-- ============================================================================
CREATE TABLE IF NOT EXISTS storage.tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(32) NOT NULL DEFAULT 'gray',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure a user cannot create two tags with the same name
    CONSTRAINT unique_user_tag_name UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_storage_tags_user_id ON storage.tags(user_id);

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_tags_updated_at ON storage.tags;

CREATE TRIGGER update_tags_updated_at
    BEFORE UPDATE ON storage.tags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Table: storage.file_tags
-- ============================================================================
CREATE TABLE IF NOT EXISTS storage.file_tags (
    file_id UUID NOT NULL REFERENCES storage.files(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES storage.tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (file_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_storage_file_tags_tag_id ON storage.file_tags(tag_id);

-- ============================================================================
-- Table: storage.file_versions
-- ============================================================================
CREATE TABLE IF NOT EXISTS storage.file_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES storage.files(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    size BIGINT NOT NULL,
    content_type TEXT,
    storage_key TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure a single file cannot have duplicate version numbers
    CONSTRAINT unique_file_version_number UNIQUE (file_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_storage_file_versions_file_id ON storage.file_versions(file_id);
