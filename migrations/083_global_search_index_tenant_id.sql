-- Migration: Add tenant_id to global_search_index
-- Enables tenant-scoped search queries with efficient filtering

-- 1. Add nullable tenant_id column for backwards compatibility
ALTER TABLE public.global_search_index
    ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- 2. Index on (tenant_id, user_id) to accelerate tenant-scoped search queries
CREATE INDEX IF NOT EXISTS idx_gsi_tenant_user
    ON public.global_search_index (tenant_id, user_id);

-- 3. Update trigger functions to populate tenant_id

-- Documents trigger: documents.created_by → users.tenant_id
CREATE OR REPLACE FUNCTION trigger_sync_document_to_gsi()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        SELECT tenant_id INTO v_tenant_id FROM users WHERE id = NEW.created_by;

        INSERT INTO global_search_index (id, entity_type, user_id, tenant_id, title, snippet, url, updated_at)
        VALUES (
            NEW.id,
            'document',
            NEW.created_by,
            v_tenant_id,
            COALESCE(NEW.name, 'Untitled Document'),
            NEW.doc_type,
            '/docs/' || NEW.id::text,
            NEW.updated_at
        )
        ON CONFLICT (id) DO UPDATE SET
            title       = EXCLUDED.title,
            snippet     = EXCLUDED.snippet,
            tenant_id   = EXCLUDED.tenant_id,
            updated_at  = EXCLUDED.updated_at;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM global_search_index WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- storage.files trigger: files.user_id → users.tenant_id
CREATE OR REPLACE FUNCTION trigger_sync_file_to_gsi()
RETURNS TRIGGER AS $$
DECLARE
    v_filename  TEXT;
    v_tenant_id UUID;
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        v_filename  := split_part(NEW.key, '/', -1);
        SELECT tenant_id INTO v_tenant_id FROM users WHERE id = NEW.user_id;

        INSERT INTO global_search_index (id, entity_type, user_id, tenant_id, title, snippet, url, updated_at)
        VALUES (
            NEW.id,
            'file',
            NEW.user_id,
            v_tenant_id,
            v_filename,
            NEW.content_type,
            '/storage/files/' || NEW.id::text,
            NEW.updated_at
        )
        ON CONFLICT (id) DO UPDATE SET
            title       = EXCLUDED.title,
            snippet     = EXCLUDED.snippet,
            tenant_id   = EXCLUDED.tenant_id,
            updated_at  = EXCLUDED.updated_at;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM global_search_index WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- mail.emails trigger: account_id → mail.accounts.user_id → users.tenant_id
CREATE OR REPLACE FUNCTION trigger_sync_mail_to_gsi()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id   UUID;
    v_tenant_id UUID;
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        SELECT a.user_id, u.tenant_id
        INTO   v_user_id, v_tenant_id
        FROM   mail.accounts a
        JOIN   users u ON u.id = a.user_id
        WHERE  a.id = NEW.account_id;

        IF v_user_id IS NOT NULL THEN
            INSERT INTO global_search_index (id, entity_type, user_id, tenant_id, title, snippet, url, updated_at)
            VALUES (
                NEW.id,
                'mail',
                v_user_id,
                v_tenant_id,
                COALESCE(NEW.subject, '(No Subject)'),
                NEW.snippet,
                '/mail/message/' || NEW.id::text,
                NEW.updated_at
            )
            ON CONFLICT (id) DO UPDATE SET
                title       = EXCLUDED.title,
                snippet     = EXCLUDED.snippet,
                tenant_id   = EXCLUDED.tenant_id,
                updated_at  = EXCLUDED.updated_at;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM global_search_index WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Back-fill tenant_id for existing rows where possible
UPDATE public.global_search_index gsi
SET    tenant_id = u.tenant_id
FROM   users u
WHERE  gsi.user_id = u.id
  AND  gsi.tenant_id IS NULL;
