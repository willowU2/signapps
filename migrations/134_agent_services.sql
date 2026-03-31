-- 134: Agent service monitoring (Feature 24)
-- Stores per-endpoint running/stopped OS service list reported by agents.

CREATE TABLE IF NOT EXISTS it.agent_services (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hardware_id UUID NOT NULL REFERENCES it.hardware(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'unknown', -- running, stopped, paused, unknown
    description TEXT,
    pid         INTEGER,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_services_hardware ON it.agent_services(hardware_id);
CREATE INDEX IF NOT EXISTS idx_agent_services_status   ON it.agent_services(hardware_id, status);
