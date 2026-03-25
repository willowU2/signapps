-- Add tsvector columns for full-text search
ALTER TABLE mail.emails ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE drive.nodes ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- GIN indexes for fast full-text search
CREATE INDEX IF NOT EXISTS idx_emails_fts ON mail.emails USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_drive_fts ON drive.nodes USING GIN(search_vector);

-- Auto-update tsvector on mail.emails
CREATE OR REPLACE FUNCTION mail.update_email_search_vector() RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('french',
        coalesce(NEW.subject, '') || ' ' ||
        coalesce(NEW.body_text, '') || ' ' ||
        coalesce(NEW.from_address, '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_email_search_vector
    BEFORE INSERT OR UPDATE ON mail.emails
    FOR EACH ROW EXECUTE FUNCTION mail.update_email_search_vector();

-- Auto-update tsvector on drive.nodes
CREATE OR REPLACE FUNCTION drive.update_node_search_vector() RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('french', coalesce(NEW.name, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_node_search_vector
    BEFORE INSERT OR UPDATE ON drive.nodes
    FOR EACH ROW EXECUTE FUNCTION drive.update_node_search_vector();
