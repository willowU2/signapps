CREATE TABLE platform.activities (
    id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
    actor_id UUID NOT NULL,
    action VARCHAR(32) NOT NULL,
    entity_type VARCHAR(32) NOT NULL,
    entity_id UUID NOT NULL,
    entity_title TEXT,
    metadata JSONB DEFAULT '{}',
    workspace_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activities_actor ON platform.activities(actor_id, created_at DESC);
CREATE INDEX idx_activities_workspace ON platform.activities(workspace_id, created_at DESC);
CREATE INDEX idx_activities_entity ON platform.activities(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_activities_metadata ON platform.activities USING GIN(metadata);
