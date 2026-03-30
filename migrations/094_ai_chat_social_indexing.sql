-- 094_ai_chat_social_indexing.sql
-- Enable AI ingestion for chat messages and social posts
-- Uses the existing ai.ingestion_queue CDC pattern from migration 038

-- Social posts → AI ingestion queue
-- (Chat messages support via conditional check if chat.messages table exists)

CREATE OR REPLACE FUNCTION trg_ai_ingest_social_fn() RETURNS trigger AS $$
BEGIN
    INSERT INTO ai.ingestion_queue (source_table, record_id, action, status)
    VALUES ('social.posts', NEW.id::text, 'UPSERT', 'PENDING')
    ON CONFLICT (source_table, record_id) DO UPDATE SET
        status = 'PENDING',
        action = 'UPSERT',
        processed_at = NULL;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_ai_ingest_social_posts ON social.posts;
    CREATE TRIGGER trg_ai_ingest_social_posts
        AFTER INSERT OR UPDATE ON social.posts
        FOR EACH ROW EXECUTE FUNCTION trg_ai_ingest_social_fn();
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Chat messages → AI ingestion queue (conditional on table existence)
-- Note: chat.messages may not exist in all environments; this is defensive
CREATE OR REPLACE FUNCTION trg_ai_ingest_chat_fn() RETURNS trigger AS $$
BEGIN
    INSERT INTO ai.ingestion_queue (source_table, record_id, action, status)
    VALUES ('chat.messages', NEW.id::text, 'UPSERT', 'PENDING')
    ON CONFLICT (source_table, record_id) DO UPDATE SET
        status = 'PENDING',
        action = 'UPSERT',
        processed_at = NULL;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'chat' AND table_name = 'messages') THEN
        DROP TRIGGER IF EXISTS trg_ai_ingest_chat_messages ON chat.messages;
        CREATE TRIGGER trg_ai_ingest_chat_messages
            AFTER INSERT OR UPDATE ON chat.messages
            FOR EACH ROW EXECUTE FUNCTION trg_ai_ingest_chat_fn();
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
