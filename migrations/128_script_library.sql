-- 128: Script library + scheduled scripts

CREATE TABLE IF NOT EXISTS it.script_library (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    category    VARCHAR(50),
    -- script_type: bash, powershell, python, batch
    script_type VARCHAR(20) NOT NULL DEFAULT 'bash',
    content     TEXT NOT NULL,
    -- parameters: [{"name":"timeout","type":"integer","default":"30"}]
    parameters  JSONB DEFAULT '[]',
    version     INTEGER DEFAULT 1,
    created_by  UUID,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS it.scheduled_scripts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id       UUID REFERENCES it.script_library(id) ON DELETE SET NULL,
    hardware_id     UUID REFERENCES it.hardware(id) ON DELETE CASCADE,
    group_id        UUID REFERENCES it.device_groups(id) ON DELETE CASCADE,
    cron_expression VARCHAR(100) NOT NULL,
    enabled         BOOLEAN DEFAULT true,
    last_run        TIMESTAMPTZ,
    next_run        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_script_library_category ON it.script_library(category);
CREATE INDEX IF NOT EXISTS idx_scheduled_scripts_next_run ON it.scheduled_scripts(next_run) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_scripts_hardware ON it.scheduled_scripts(hardware_id);
