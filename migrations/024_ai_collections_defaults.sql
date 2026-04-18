-- Add collection_name string column to indexing rules

ALTER TABLE ai_indexing_rules ADD COLUMN IF NOT EXISTS collection_name VARCHAR(255);

-- Add collection_name string column to document vectors
ALTER TABLE ai.document_vectors ADD COLUMN IF NOT EXISTS collection_name VARCHAR(256) DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_document_vectors_collection ON ai.document_vectors(collection_name);

-- Pre-optimized default rules for standard applications
-- Note: 'folder_path' and 'bucket' have a UNIQUE index in 022_admin_storage_settings.sql

INSERT INTO ai_indexing_rules (folder_path, bucket, include_subfolders, collection_name)
VALUES 
    ('/apps/calendar/', 'system', true, 'calendar'),
    ('/apps/mail/', 'system', true, 'mail'),
    ('/apps/tasks/', 'system', true, 'tasks'),
    ('/apps/docs/', 'user', true, 'docs')
ON CONFLICT (folder_path, bucket) DO NOTHING;

-- Also seed default storage rules if needed
DO $$ BEGIN ALTER TABLE storage_rules ADD CONSTRAINT unique_file_type UNIQUE (file_type); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO storage_rules (file_type, mime_type_pattern, target_bucket, target_backend)
VALUES 
    ('document', 'application/vnd.openxmlformats-officedocument.%', 'user', 'fs'),
    ('spreadsheets', 'application/vnd.openxmlformats-officedocument.spreadsheetml.%', 'user', 'fs'),
    ('presentations', 'application/vnd.openxmlformats-officedocument.presentationml.%', 'user', 'fs'),
    ('pdf', 'application/pdf', 'user', 'fs'),
    ('images', 'image/%', 'user', 'fs'),
    ('system_calendar', 'application/calendar', 'system', 'fs'),
    ('system_mail', 'message/rfc822', 'system', 'fs')
ON CONFLICT (file_type) DO NOTHING;
