-- Help: FAQ articles and support tickets
CREATE SCHEMA IF NOT EXISTS help;

CREATE TABLE IF NOT EXISTS help.faq_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL, -- 'account', 'documents', 'mail', 'calendar', 'storage', 'ai', 'security', 'admin', 'navigation'
    question TEXT NOT NULL,
    answer TEXT NOT NULL, -- markdown
    sort_order INT DEFAULT 0,
    published BOOLEAN DEFAULT true,
    view_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS help.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id),
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    status TEXT DEFAULT 'open', -- open, in_progress, resolved, closed
    priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Status: service health history
CREATE SCHEMA IF NOT EXISTS status;

CREATE TABLE IF NOT EXISTS status.health_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT NOT NULL,
    port INT NOT NULL,
    status TEXT NOT NULL, -- 'up', 'down', 'degraded'
    latency_ms INT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_health_checks_service ON status.health_checks(service_name, checked_at DESC);

CREATE TABLE IF NOT EXISTS status.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'minor', -- minor, major, critical
    status TEXT NOT NULL DEFAULT 'investigating', -- investigating, identified, monitoring, resolved
    description TEXT,
    affected_services TEXT[] DEFAULT '{}',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    created_by UUID REFERENCES identity.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
