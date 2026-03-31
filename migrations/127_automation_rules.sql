-- 127: Automation engine (condition → action)
-- Rules define trigger conditions and actions to take automatically

CREATE TABLE IF NOT EXISTS it.automation_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    enabled         BOOLEAN DEFAULT true,
    -- trigger_types: alert_fired, device_offline, patch_available, software_detected,
    --                disk_usage_high, cpu_high, memory_high
    trigger_type    VARCHAR(50) NOT NULL,
    trigger_config  JSONB NOT NULL DEFAULT '{}',
    -- action_types: run_script, send_notification, create_ticket, reboot_device,
    --               send_webhook, deploy_package
    action_type     VARCHAR(50) NOT NULL,
    action_config   JSONB NOT NULL DEFAULT '{}',
    cooldown_minutes INTEGER DEFAULT 60,
    last_triggered  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS it.automation_executions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id     UUID NOT NULL REFERENCES it.automation_rules(id) ON DELETE CASCADE,
    hardware_id UUID REFERENCES it.hardware(id) ON DELETE SET NULL,
    triggered_at TIMESTAMPTZ DEFAULT now(),
    status      VARCHAR(20) DEFAULT 'pending', -- pending, running, success, failed
    result      JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_automation_executions_rule ON it.automation_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_hardware ON it.automation_executions(hardware_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_enabled ON it.automation_rules(enabled);
