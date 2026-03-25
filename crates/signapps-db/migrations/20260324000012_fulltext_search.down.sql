-- Drop triggers first
DROP TRIGGER IF EXISTS trg_email_search_vector ON mail.emails;
DROP TRIGGER IF EXISTS trg_node_search_vector ON drive.nodes;

-- Drop functions
DROP FUNCTION IF EXISTS mail.update_email_search_vector();
DROP FUNCTION IF EXISTS drive.update_node_search_vector();

-- Drop GIN indexes
DROP INDEX IF EXISTS mail.idx_emails_fts;
DROP INDEX IF EXISTS drive.idx_drive_fts;

-- Drop tsvector columns
ALTER TABLE mail.emails DROP COLUMN IF EXISTS search_vector;
ALTER TABLE drive.nodes DROP COLUMN IF EXISTS search_vector;
