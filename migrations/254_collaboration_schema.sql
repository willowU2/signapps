-- Collaboration schema: boards (mind maps, kanban, etc.)
CREATE SCHEMA IF NOT EXISTS collaboration;

CREATE TABLE collaboration.boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    board_type VARCHAR(30) DEFAULT 'mindmap',
    data JSONB DEFAULT '{}',
    owner_id UUID NOT NULL,
    tenant_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_boards_owner ON collaboration.boards(owner_id);
