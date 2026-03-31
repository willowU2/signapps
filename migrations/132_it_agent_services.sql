-- 132: Agent services monitoring
-- (Added to support services reporting endpoint: Feature 24)
-- Note: playbooks tables are in 131_playbooks.sql

-- Agent service monitoring
CREATE TABLE IF NOT EXISTS it.agent_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hardware_id UUID NOT NULL REFERENCES it.hardware(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    status VARCHAR(50),
    description TEXT,
    pid INTEGER,
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_services_hardware ON it.agent_services(hardware_id);
