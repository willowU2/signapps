-- 129: Internal PSA/ticketing system (ConnectWise/Autotask style)

CREATE TABLE IF NOT EXISTS it.tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number SERIAL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    category VARCHAR(50),
    hardware_id UUID REFERENCES it.hardware(id),
    requester_id UUID,
    requester_name VARCHAR(200),
    requester_email VARCHAR(200),
    assigned_to UUID,
    assigned_group UUID REFERENCES it.device_groups(id),
    sla_response_due TIMESTAMPTZ,
    sla_resolution_due TIMESTAMPTZ,
    first_response_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON it.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON it.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_hardware ON it.tickets(hardware_id);

CREATE TABLE IF NOT EXISTS it.ticket_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES it.tickets(id) ON DELETE CASCADE,
    author_id UUID,
    author_name VARCHAR(200),
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_comments ON it.ticket_comments(ticket_id);

CREATE TABLE IF NOT EXISTS it.ticket_time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES it.tickets(id) ON DELETE CASCADE,
    user_id UUID,
    duration_minutes INTEGER NOT NULL,
    description TEXT,
    billable BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS it.sla_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    response_hours INTEGER NOT NULL,
    resolution_hours INTEGER NOT NULL,
    business_hours_only BOOLEAN DEFAULT true
);
INSERT INTO it.sla_policies (name, priority, response_hours, resolution_hours) VALUES
    ('Critique', 'critical', 1, 4),
    ('Haute', 'high', 4, 8),
    ('Moyenne', 'medium', 8, 24),
    ('Basse', 'low', 24, 72)
ON CONFLICT DO NOTHING;
