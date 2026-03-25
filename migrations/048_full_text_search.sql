-- SignApps Platform - Full-Text Search Migration
-- Version: 048
-- Feature: AQ-FTS — tsvector columns + GIN indexes for fast full-text search

-- ============================================================================
-- Documents: add tsvector for title+body search
-- ============================================================================

ALTER TABLE docs.documents
    ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE docs.documents
SET search_vector = to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(body_text, ''))
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_docs_search_vector
    ON docs.documents USING GIN(search_vector);

-- Trigger to auto-update tsvector on insert/update
CREATE OR REPLACE FUNCTION docs.update_document_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english',
        COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.body_text, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_docs_search_vector ON docs.documents;
CREATE TRIGGER trg_docs_search_vector
    BEFORE INSERT OR UPDATE OF title, body_text ON docs.documents
    FOR EACH ROW
    EXECUTE FUNCTION docs.update_document_search_vector();

-- ============================================================================
-- Mail: add tsvector for subject+body search
-- ============================================================================

ALTER TABLE mail.emails
    ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE mail.emails
SET search_vector = to_tsvector('english',
    COALESCE(subject, '') || ' ' || COALESCE(body_text, ''))
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_mail_search_vector
    ON mail.emails USING GIN(search_vector);

CREATE OR REPLACE FUNCTION mail.update_email_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english',
        COALESCE(NEW.subject, '') || ' ' || COALESCE(NEW.body_text, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mail_search_vector ON mail.emails;
CREATE TRIGGER trg_mail_search_vector
    BEFORE INSERT OR UPDATE OF subject, body_text ON mail.emails
    FOR EACH ROW
    EXECUTE FUNCTION mail.update_email_search_vector();

-- ============================================================================
-- Contacts: add tsvector for name+email+notes search
-- ============================================================================

ALTER TABLE contacts.contacts
    ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE contacts.contacts
SET search_vector = to_tsvector('english',
    COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') || ' ' ||
    COALESCE(email, '') || ' ' || COALESCE(notes, ''))
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_search_vector
    ON contacts.contacts USING GIN(search_vector);

CREATE OR REPLACE FUNCTION contacts.update_contact_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english',
        COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '') || ' ' ||
        COALESCE(NEW.email, '') || ' ' || COALESCE(NEW.notes, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contacts_search_vector ON contacts.contacts;
CREATE TRIGGER trg_contacts_search_vector
    BEFORE INSERT OR UPDATE OF first_name, last_name, email, notes ON contacts.contacts
    FOR EACH ROW
    EXECUTE FUNCTION contacts.update_contact_search_vector();
