-- 316_automations_extensions.sql
-- Visual automations (no-code) + Extension SDK infrastructure

-- Automation definitions
CREATE TABLE IF NOT EXISTS core.automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    trigger_type TEXT NOT NULL CHECK (trigger_type IN (
        'form_submitted', 'email_received', 'file_uploaded',
        'calendar_event_created', 'contact_updated', 'schedule',
        'webhook_received', 'manual'
    )),
    trigger_config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automations_tenant ON core.automations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automations_trigger ON core.automations(tenant_id, trigger_type) WHERE is_active = TRUE;

-- Automation steps (ordered pipeline)
CREATE TABLE IF NOT EXISTS core.automation_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES core.automations(id) ON DELETE CASCADE,
    step_order INT NOT NULL DEFAULT 0,
    step_type TEXT NOT NULL CHECK (step_type IN ('condition', 'action', 'delay', 'loop')),
    action_type TEXT,
    config JSONB NOT NULL DEFAULT '{}',
    condition JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_steps ON core.automation_steps(automation_id, step_order);

-- Automation execution history
CREATE TABLE IF NOT EXISTS core.automation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES core.automations(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    trigger_payload JSONB DEFAULT '{}',
    step_results JSONB DEFAULT '[]',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error TEXT,
    duration_ms INT
);

CREATE INDEX IF NOT EXISTS idx_automation_runs ON core.automation_runs(automation_id, started_at DESC);

-- Extension definitions
CREATE TABLE IF NOT EXISTS core.extensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    version TEXT NOT NULL DEFAULT '1.0.0',
    entry_point TEXT NOT NULL,
    permissions TEXT[] NOT NULL DEFAULT '{}',
    hooks JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT false,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    installed_by UUID NOT NULL,
    approved_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_extensions_tenant ON core.extensions(tenant_id);

-- Action registry (catalog of available actions for automations)
CREATE TABLE IF NOT EXISTS core.action_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT DEFAULT '',
    input_schema JSONB NOT NULL DEFAULT '{}',
    output_schema JSONB NOT NULL DEFAULT '{}',
    service TEXT NOT NULL,
    is_builtin BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed built-in actions
INSERT INTO core.action_catalog (name, display_name, category, description, input_schema, service) VALUES
    ('send_email', 'Send Email', 'communication', 'Send an email via signapps-mail', '{"to":"string","subject":"string","body":"string","attachments":"string[]"}', 'mail'),
    ('create_task', 'Create Task', 'productivity', 'Create a task in the task manager', '{"title":"string","assignee":"uuid","due_date":"date","priority":"string"}', 'identity'),
    ('create_event', 'Create Calendar Event', 'calendar', 'Create a calendar event', '{"title":"string","start":"datetime","end":"datetime","attendees":"uuid[]"}', 'calendar'),
    ('update_sheet', 'Update Spreadsheet Cell', 'data', 'Write a value to a spreadsheet cell', '{"document_id":"uuid","sheet":"int","cell":"string","value":"string"}', 'docs'),
    ('move_file', 'Move File', 'storage', 'Move a file to a different folder', '{"file_id":"uuid","target_folder_id":"uuid"}', 'storage'),
    ('create_contact', 'Create Contact', 'crm', 'Create a new contact record', '{"first_name":"string","last_name":"string","email":"string","company":"string"}', 'contacts'),
    ('send_notification', 'Send Notification', 'communication', 'Push notification to users', '{"user_ids":"uuid[]","title":"string","body":"string"}', 'notifications'),
    ('call_webhook', 'Call Webhook', 'integration', 'HTTP POST to an external URL', '{"url":"string","headers":"object","body":"object"}', 'integrations'),
    ('send_chat_message', 'Send Chat Message', 'communication', 'Post a message in a chat channel', '{"channel_id":"uuid","message":"string"}', 'chat'),
    ('generate_pdf', 'Generate PDF', 'documents', 'Export a document to PDF', '{"document_id":"uuid","output_folder":"uuid"}', 'docs')
ON CONFLICT (name) DO NOTHING;
