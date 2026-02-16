-- Multi-type collaborative documents (Y.js/Yrs)
-- Supports: Text, Sheet, Slide, Board

-- Add type column to documents table (if migrating from 009_collab_documents.sql)
-- Or create fresh table with support for all types

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'Untitled',
    doc_type TEXT NOT NULL CHECK (doc_type IN ('text', 'sheet', 'slide', 'board')),
    doc_binary BYTEA NOT NULL,
    version INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(doc_type);

-- Audit trail for document updates
CREATE TABLE IF NOT EXISTS document_updates (
    id BIGSERIAL PRIMARY KEY,
    doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    update BYTEA NOT NULL,
    version INT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    client_id UUID
);

CREATE INDEX IF NOT EXISTS idx_document_updates_doc_id ON document_updates(doc_id);
CREATE INDEX IF NOT EXISTS idx_document_updates_timestamp ON document_updates(timestamp DESC);

-- Document permissions (share with users/groups)
CREATE TABLE IF NOT EXISTS document_permissions (
    id UUID PRIMARY KEY,
    doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    permission_level TEXT NOT NULL DEFAULT 'view', -- view, edit, admin
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_user_or_group CHECK ((user_id IS NOT NULL AND group_id IS NULL) OR (user_id IS NULL AND group_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_document_permissions_doc_id ON document_permissions(doc_id);
CREATE INDEX IF NOT EXISTS idx_document_permissions_user_id ON document_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_document_permissions_group_id ON document_permissions(group_id);

-- Presence/awareness (who is editing now)
CREATE TABLE IF NOT EXISTS document_presence (
    id UUID PRIMARY KEY,
    doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    cursor_position INT,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    awareness_state JSONB
);

CREATE INDEX IF NOT EXISTS idx_document_presence_doc_id ON document_presence(doc_id);
CREATE INDEX IF NOT EXISTS idx_document_presence_user_id ON document_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_document_presence_last_activity ON document_presence(last_activity DESC);

-- Type-specific metadata (for future expansion)
CREATE TABLE IF NOT EXISTS document_metadata (
    doc_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    -- For sheets: rows, cols, frozen_rows, frozen_cols
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_document_metadata_doc_id ON document_metadata(doc_id);

-- Cleanup old presence records
CREATE OR REPLACE FUNCTION cleanup_stale_presence()
RETURNS void AS $$
BEGIN
    DELETE FROM document_presence
    WHERE last_activity < CURRENT_TIMESTAMP - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;
