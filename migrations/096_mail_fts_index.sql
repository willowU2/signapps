-- Migration 096: Full-text search index for mail.emails (Idea 48)

ALTER TABLE mail.emails ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION mail.update_email_search_vector() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('french', coalesce(NEW.subject, '')), 'A') ||
        setweight(to_tsvector('french', coalesce(NEW.sender, '')), 'B') ||
        setweight(to_tsvector('french', coalesce(NEW.recipient, '')), 'B') ||
        setweight(to_tsvector('french', coalesce(NEW.body_text, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_search_vector ON mail.emails;

CREATE TRIGGER trg_email_search_vector
    BEFORE INSERT OR UPDATE OF subject, sender, recipient, body_text
    ON mail.emails
    FOR EACH ROW EXECUTE FUNCTION mail.update_email_search_vector();

CREATE INDEX IF NOT EXISTS idx_emails_fts ON mail.emails USING GIN(search_vector);

-- Backfill existing rows
UPDATE mail.emails SET search_vector =
    setweight(to_tsvector('french', coalesce(subject, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(sender, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(recipient, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(body_text, '')), 'C');
