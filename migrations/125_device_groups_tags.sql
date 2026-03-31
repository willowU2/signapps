-- 125: Device groups and tags
-- Groups allow hierarchical organization of hardware assets
-- Tags are flat labels with colors for quick filtering

CREATE TABLE IF NOT EXISTS it.device_groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    parent_id   UUID REFERENCES it.device_groups(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS it.device_group_members (
    group_id    UUID NOT NULL REFERENCES it.device_groups(id) ON DELETE CASCADE,
    hardware_id UUID NOT NULL REFERENCES it.hardware(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, hardware_id)
);

CREATE TABLE IF NOT EXISTS it.device_tags (
    id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name  VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7) DEFAULT '#3b82f6'
);

CREATE TABLE IF NOT EXISTS it.device_tag_assignments (
    tag_id      UUID NOT NULL REFERENCES it.device_tags(id) ON DELETE CASCADE,
    hardware_id UUID NOT NULL REFERENCES it.hardware(id) ON DELETE CASCADE,
    PRIMARY KEY (tag_id, hardware_id)
);

CREATE INDEX IF NOT EXISTS idx_device_group_members_hardware ON it.device_group_members(hardware_id);
CREATE INDEX IF NOT EXISTS idx_device_tag_assignments_hardware ON it.device_tag_assignments(hardware_id);
CREATE INDEX IF NOT EXISTS idx_device_groups_parent ON it.device_groups(parent_id);
