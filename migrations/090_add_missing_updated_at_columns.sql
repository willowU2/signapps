-- Migration 090: Add missing updated_at (and created_at) columns
-- Adds timestamp bookkeeping columns to tables that lack them.
-- All additions use IF NOT EXISTS for idempotency.

-- document_updates (migration 009: public schema)
ALTER TABLE document_updates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- document_presence (migration 009: public schema)
ALTER TABLE document_presence ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- calendar.task_attachments (migration 011)
ALTER TABLE calendar.task_attachments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- it.components (migration 020)
ALTER TABLE it.components ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- it.network_interfaces (migration 020)
ALTER TABLE it.network_interfaces ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- meet.meeting_history (migration 027)
ALTER TABLE meet.meeting_history ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE meet.meeting_history ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- admin_system_settings (migration 023: public schema)
ALTER TABLE admin_system_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- ai.ingestion_queue (migration 021)
ALTER TABLE ai.ingestion_queue ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
