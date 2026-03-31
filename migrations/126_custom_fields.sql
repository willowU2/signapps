-- 126: Custom fields per device
-- Allows admins to define arbitrary metadata fields and attach values to hardware

CREATE TABLE IF NOT EXISTS it.custom_field_definitions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100) NOT NULL,
    field_type VARCHAR(20) NOT NULL DEFAULT 'text', -- text, number, boolean, select, date
    options    JSONB DEFAULT '[]',                   -- for select type: ["opt1","opt2"]
    required   BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS it.custom_field_values (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    definition_id UUID NOT NULL REFERENCES it.custom_field_definitions(id) ON DELETE CASCADE,
    hardware_id   UUID NOT NULL REFERENCES it.hardware(id) ON DELETE CASCADE,
    value         TEXT,
    UNIQUE (definition_id, hardware_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_field_values_hardware ON it.custom_field_values(hardware_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_order ON it.custom_field_definitions(sort_order);
