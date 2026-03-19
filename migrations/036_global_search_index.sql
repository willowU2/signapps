-- Migration: Global Search Index (Omni-Search)
-- Defines the unified search table and triggers across all microservices

CREATE TABLE IF NOT EXISTS global_search_index (
    id UUID PRIMARY KEY,                   
    entity_type VARCHAR(50) NOT NULL,      -- 'document', 'file', 'mail', etc.
    user_id UUID NOT NULL,                 -- for RBAC
    title TEXT NOT NULL,
    snippet TEXT,
    url TEXT NOT NULL,                     
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast filtering for queries
CREATE INDEX IF NOT EXISTS idx_gsi_user ON global_search_index (user_id);
CREATE INDEX IF NOT EXISTS idx_gsi_type ON global_search_index (entity_type);

-- GIN index for text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_gsi_title_trgm ON global_search_index USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_gsi_snippet_trgm ON global_search_index USING gin (snippet gin_trgm_ops);

-- =========================================================================
-- TRIGGER: documents
-- =========================================================================
CREATE OR REPLACE FUNCTION trigger_sync_document_to_gsi()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        INSERT INTO global_search_index (id, entity_type, user_id, title, snippet, url, updated_at)
        VALUES (
            NEW.id,
            'document',
            NEW.created_by,
            COALESCE(NEW.name, 'Untitled Document'),
            NEW.doc_type,
            '/docs/' || NEW.id::text,
            NEW.updated_at
        )
        ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            snippet = EXCLUDED.snippet,
            updated_at = EXCLUDED.updated_at;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM global_search_index WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_document_gsi ON documents;
CREATE TRIGGER trg_sync_document_gsi
AFTER INSERT OR UPDATE OR DELETE ON documents
FOR EACH ROW EXECUTE FUNCTION trigger_sync_document_to_gsi();

-- =========================================================================
-- TRIGGER: storage.files
-- =========================================================================
CREATE OR REPLACE FUNCTION trigger_sync_file_to_gsi()
RETURNS TRIGGER AS $$
DECLARE
    v_filename TEXT;
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Extract just the filename from the key (e.g. folder/sub/file.pdf -> file.pdf)
        v_filename := split_part(NEW.key, '/', -1);
        
        INSERT INTO global_search_index (id, entity_type, user_id, title, snippet, url, updated_at)
        VALUES (
            NEW.id,
            'file',
            NEW.user_id,
            v_filename,
            NEW.content_type,
            '/storage/files/' || NEW.id::text,
            NEW.updated_at
        )
        ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            snippet = EXCLUDED.snippet,
            updated_at = EXCLUDED.updated_at;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM global_search_index WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_file_gsi ON storage.files;
CREATE TRIGGER trg_sync_file_gsi
AFTER INSERT OR UPDATE OR DELETE ON storage.files
FOR EACH ROW EXECUTE FUNCTION trigger_sync_file_to_gsi();

-- =========================================================================
-- TRIGGER: mail.emails
-- =========================================================================
CREATE OR REPLACE FUNCTION trigger_sync_mail_to_gsi()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Lookup user_id from mail.accounts
        SELECT user_id INTO v_user_id FROM mail.accounts WHERE id = NEW.account_id;
        
        IF v_user_id IS NOT NULL THEN
            INSERT INTO global_search_index (id, entity_type, user_id, title, snippet, url, updated_at)
            VALUES (
                NEW.id,
                'mail',
                v_user_id,
                COALESCE(NEW.subject, '(No Subject)'),
                NEW.snippet,
                '/mail/message/' || NEW.id::text,
                NEW.updated_at
            )
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                snippet = EXCLUDED.snippet,
                updated_at = EXCLUDED.updated_at;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM global_search_index WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_mail_gsi ON mail.emails;
CREATE TRIGGER trg_sync_mail_gsi
AFTER INSERT OR UPDATE OR DELETE ON mail.emails
FOR EACH ROW EXECUTE FUNCTION trigger_sync_mail_to_gsi();

-- =========================================================================
-- INITIAL SEEDING FOR EXISTING DATA
-- =========================================================================
INSERT INTO global_search_index (id, entity_type, user_id, title, snippet, url, updated_at)
SELECT id, 'document', created_by, COALESCE(name, 'Untitled'), doc_type, '/docs/' || id::text, updated_at
FROM documents
WHERE created_by IS NOT NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO global_search_index (id, entity_type, user_id, title, snippet, url, updated_at)
SELECT id, 'file', user_id, split_part(key, '/', -1), content_type, '/storage/files/' || id::text, updated_at
FROM storage.files
ON CONFLICT (id) DO NOTHING;

INSERT INTO global_search_index (id, entity_type, user_id, title, snippet, url, updated_at)
SELECT e.id, 'mail', a.user_id, COALESCE(e.subject, '(No Subject)'), e.snippet, '/mail/message/' || e.id::text, e.updated_at
FROM mail.emails e
JOIN mail.accounts a ON e.account_id = a.id
ON CONFLICT (id) DO NOTHING;
