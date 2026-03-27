-- SignApps Platform - Full-Text Search Migration
-- Version: 048
-- Feature: AQ-FTS — tsvector columns + GIN indexes for fast full-text search

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
