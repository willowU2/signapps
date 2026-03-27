CREATE SCHEMA IF NOT EXISTS platform;

CREATE TABLE IF NOT EXISTS platform.activities (
    id UUID PRIMARY KEY,
    actor_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(255) NOT NULL,
    entity_id UUID NOT NULL,
    entity_title VARCHAR(255),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    workspace_id UUID REFERENCES identity.workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_activities_workspace_id ON platform.activities(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activities_entity ON platform.activities(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activities_actor_id ON platform.activities(actor_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON platform.activities(created_at DESC);
