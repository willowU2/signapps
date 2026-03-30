-- Migration 113: Distributed monitoring & endpoint security tables
-- MD2, MD3, SE1, SE2

-- MD2: Machine alert rules and alerts
CREATE TABLE IF NOT EXISTS it.alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hardware_id UUID REFERENCES it.hardware(id) ON DELETE CASCADE,
    metric VARCHAR(50) NOT NULL,
    operator VARCHAR(5) NOT NULL DEFAULT '>',
    threshold REAL NOT NULL,
    duration_seconds INTEGER DEFAULT 300,
    severity VARCHAR(20) DEFAULT 'warning',
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alert_rules_hw ON it.alert_rules(hardware_id);

CREATE TABLE IF NOT EXISTS it.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES it.alert_rules(id) ON DELETE CASCADE,
    hardware_id UUID NOT NULL REFERENCES it.hardware(id) ON DELETE CASCADE,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    value REAL
);
CREATE INDEX IF NOT EXISTS idx_alerts_hw ON it.alerts(hardware_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_rule ON it.alerts(rule_id);

-- MD3: Event logs
CREATE TABLE IF NOT EXISTS it.event_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hardware_id UUID NOT NULL REFERENCES it.hardware(id) ON DELETE CASCADE,
    level VARCHAR(20) NOT NULL DEFAULT 'info',
    source VARCHAR(100),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_logs_hw ON it.event_logs(hardware_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_logs_level ON it.event_logs(level);

-- SE1: AV/EDR status
CREATE TABLE IF NOT EXISTS it.antivirus_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hardware_id UUID NOT NULL REFERENCES it.hardware(id) ON DELETE CASCADE,
    av_name VARCHAR(100),
    av_version VARCHAR(50),
    definitions_date DATE,
    last_scan TIMESTAMPTZ,
    threats_found INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'unknown',
    reported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_av_status_hw ON it.antivirus_status(hardware_id);

-- SE2: Disk encryption status
CREATE TABLE IF NOT EXISTS it.encryption_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hardware_id UUID NOT NULL REFERENCES it.hardware(id) ON DELETE CASCADE,
    drive VARCHAR(10) NOT NULL DEFAULT 'C:',
    encrypted BOOLEAN NOT NULL DEFAULT false,
    method VARCHAR(20),
    reported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_encryption_status_hw ON it.encryption_status(hardware_id);
