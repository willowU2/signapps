-- 315_document_versioning.sql
-- Event sourcing: command log + snapshots for document versioning

CREATE TABLE IF NOT EXISTS content.document_commands (
    id BIGSERIAL PRIMARY KEY,
    document_id UUID NOT NULL,
    user_id UUID NOT NULL,
    command_type TEXT NOT NULL,
    target_path TEXT,
    before_value JSONB,
    after_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_commands_doc ON content.document_commands(document_id, id);
CREATE INDEX IF NOT EXISTS idx_doc_commands_user ON content.document_commands(document_id, user_id);

CREATE TABLE IF NOT EXISTS content.document_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    version INT NOT NULL,
    content JSONB NOT NULL,
    label TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(document_id, version)
);

CREATE INDEX IF NOT EXISTS idx_doc_snapshots_doc ON content.document_snapshots(document_id, version);
