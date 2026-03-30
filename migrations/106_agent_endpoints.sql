-- Migration 106: Agent endpoints — extend hardware table and add agent metrics

ALTER TABLE it.hardware ADD COLUMN IF NOT EXISTS agent_id UUID UNIQUE;
ALTER TABLE it.hardware ADD COLUMN IF NOT EXISTS agent_version VARCHAR(20);
ALTER TABLE it.hardware ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ;
ALTER TABLE it.hardware ADD COLUMN IF NOT EXISTS os_type VARCHAR(20);
ALTER TABLE it.hardware ADD COLUMN IF NOT EXISTS os_version VARCHAR(50);
ALTER TABLE it.hardware ADD COLUMN IF NOT EXISTS enrollment_token VARCHAR(100);

CREATE TABLE IF NOT EXISTS it.agent_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hardware_id UUID NOT NULL REFERENCES it.hardware(id) ON DELETE CASCADE,
    cpu_usage REAL,
    memory_usage REAL,
    disk_usage REAL,
    uptime_seconds BIGINT,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_hw ON it.agent_metrics(hardware_id, collected_at DESC);
