-- 132: PSA/Ticketing webhook integrations
-- Allows forwarding ticket events to ConnectWise, Autotask, Jira, ServiceNow etc.

CREATE TABLE IF NOT EXISTS it.psa_integrations (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           VARCHAR(255) NOT NULL,
    type           VARCHAR(50) NOT NULL, -- connectwise, autotask, jira, servicenow, custom
    webhook_url    TEXT NOT NULL,
    api_key        TEXT,
    mapping_config JSONB NOT NULL DEFAULT '{}',
    -- mapping_config: {field_map: {priority: "urgency", ...}, on_create: bool, on_update: bool}
    enabled        BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_psa_integrations_type    ON it.psa_integrations(type);
CREATE INDEX IF NOT EXISTS idx_psa_integrations_enabled ON it.psa_integrations(enabled);
