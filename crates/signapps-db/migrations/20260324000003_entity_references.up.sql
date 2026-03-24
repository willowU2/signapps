CREATE TABLE platform.entity_references (
    id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
    source_type VARCHAR(32) NOT NULL,
    source_id UUID NOT NULL,
    target_type VARCHAR(32) NOT NULL,
    target_id UUID NOT NULL,
    relation VARCHAR(32) NOT NULL DEFAULT 'related',
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_entity_ref_unique_active
    ON platform.entity_references(source_type, source_id, target_type, target_id, relation)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_entity_ref_source ON platform.entity_references(source_type, source_id);
CREATE INDEX idx_entity_ref_target ON platform.entity_references(target_type, target_id);
