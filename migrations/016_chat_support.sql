-- Add 'chat' to allowed document types
ALTER TABLE documents DROP CONSTRAINT documents_doc_type_check;
DO $$ BEGIN ALTER TABLE documents ADD CONSTRAINT documents_doc_type_check 
    CHECK (doc_type IN ('text', 'sheet', 'slide', 'board', 'chat')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create channels table for easier querying (optional, but good for listing channels)
-- Or just use documents with doc_type='chat'

-- Let's create a view for channels
CREATE OR REPLACE VIEW channels AS
SELECT 
    d.id,
    d.name,
    d.created_at,
    d.updated_at,
    d.created_by,
    dm.metadata ->> 'topic' as topic,
    (dm.metadata ->> 'is_private')::boolean as is_private
FROM documents d
LEFT JOIN document_metadata dm ON d.id = dm.doc_id
WHERE d.doc_type = 'chat';

-- Message table for history indexing (optional, if we want SQL search)
-- For now, we rely on Yjs persistence in document_updates
