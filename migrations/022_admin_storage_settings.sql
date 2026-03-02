-- Add storage rules mapping
CREATE TABLE storage_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_type VARCHAR NOT NULL, -- e.g. "image", "document", "system", "video"
    mime_type_pattern VARCHAR, -- e.g. "image/*", "application/pdf"
    target_bucket VARCHAR NOT NULL,
    target_backend VARCHAR NOT NULL DEFAULT 'fs', -- e.g. 'fs' or 's3'
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by file type or mime pattern
CREATE INDEX idx_storage_rules_type ON storage_rules(file_type, is_active);

-- Add AI vector DB indexing targets
CREATE TABLE ai_indexing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folder_path VARCHAR NOT NULL, -- e.g. "/shared/company_policies"
    bucket VARCHAR NOT NULL,
    include_subfolders BOOLEAN NOT NULL DEFAULT true,
    file_types_allowed TEXT[], -- e.g. ["pdf", "docx", "txt", "md"], NULL means all
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_indexed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure a folder isn't configured multiple times for the same bucket
CREATE UNIQUE INDEX idx_indexing_rules_path_bucket ON ai_indexing_rules(folder_path, bucket);
