-- Migration: AI Ingestion CDC Triggers
-- Fixes RAG inefficiencies by moving to a pure push-based CDC architecture
-- using Postgres triggers instead of expensive polling polling LEFT JOINs.

-- 1. Fix the ingestion queue schema constraint bug
ALTER TABLE ai.ingestion_queue DROP CONSTRAINT IF EXISTS unq_ai_ingestion_queue_record;
ALTER TABLE ai.ingestion_queue ADD CONSTRAINT unq_ai_ingestion_queue_record UNIQUE (source_table, record_id);

-- Helper function to queue ingestion jobs on INSERT/UPDATE/DELETE
CREATE OR REPLACE FUNCTION trigger_queue_ai_ingestion()
RETURNS TRIGGER AS $$
DECLARE
    v_record_id VARCHAR(255);
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_record_id := OLD.id::text;
    ELSE
        v_record_id := NEW.id::text;
    END IF;

    INSERT INTO ai.ingestion_queue (source_table, record_id, action, status)
    VALUES (TG_TABLE_NAME, v_record_id, 'UPSERT', 'PENDING')
    ON CONFLICT (source_table, record_id) DO UPDATE SET 
        status = 'PENDING',
        action = 'UPSERT',
        processed_at = NULL;
        
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach triggers to all tables relevant for RAG

-- Documents
DROP TRIGGER IF EXISTS trg_ai_ingest_documents ON documents;
CREATE TRIGGER trg_ai_ingest_documents
AFTER INSERT OR UPDATE OR DELETE ON documents
FOR EACH ROW EXECUTE FUNCTION trigger_queue_ai_ingestion();

-- Storage Files
DROP TRIGGER IF EXISTS trg_ai_ingest_storage_files ON storage.files;
CREATE TRIGGER trg_ai_ingest_storage_files
AFTER INSERT OR UPDATE OR DELETE ON storage.files
FOR EACH ROW EXECUTE FUNCTION trigger_queue_ai_ingestion();

-- Mail Emails
DROP TRIGGER IF EXISTS trg_ai_ingest_mail_emails ON mail.emails;
CREATE TRIGGER trg_ai_ingest_mail_emails
AFTER INSERT OR UPDATE OR DELETE ON mail.emails
FOR EACH ROW EXECUTE FUNCTION trigger_queue_ai_ingestion();

-- Chat Messages (table removed in previous PR)
-- DROP TRIGGER IF EXISTS trg_ai_ingest_chat_messages ON chat.messages;
-- CREATE TRIGGER trg_ai_ingest_chat_messages
-- AFTER INSERT OR UPDATE OR DELETE ON chat.messages
-- FOR EACH ROW EXECUTE FUNCTION trigger_queue_ai_ingestion();

-- Calendar Events
DROP TRIGGER IF EXISTS trg_ai_ingest_calendar_events ON calendar.events;
CREATE TRIGGER trg_ai_ingest_calendar_events
AFTER INSERT OR UPDATE OR DELETE ON calendar.events
FOR EACH ROW EXECUTE FUNCTION trigger_queue_ai_ingestion();

-- Projects (Entity Hub)
DROP TRIGGER IF EXISTS trg_ai_ingest_projects ON calendar.projects;
CREATE TRIGGER trg_ai_ingest_projects
AFTER INSERT OR UPDATE OR DELETE ON calendar.projects
FOR EACH ROW EXECUTE FUNCTION trigger_queue_ai_ingestion();

-- Tasks (Entity Hub Time Items)
DROP TRIGGER IF EXISTS trg_ai_ingest_time_items ON scheduling.time_items;
CREATE TRIGGER trg_ai_ingest_time_items
AFTER INSERT OR UPDATE OR DELETE ON scheduling.time_items
FOR EACH ROW EXECUTE FUNCTION trigger_queue_ai_ingestion();
