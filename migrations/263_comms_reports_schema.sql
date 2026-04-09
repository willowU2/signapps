-- Comms: internal communication
CREATE SCHEMA IF NOT EXISTS comms;

CREATE TABLE IF NOT EXISTS comms.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL, -- markdown/HTML
    author_id UUID NOT NULL REFERENCES identity.users(id),
    pinned BOOLEAN DEFAULT false,
    published BOOLEAN DEFAULT true,
    target_audience TEXT DEFAULT 'all', -- 'all', group UUID, department name
    requires_ack BOOLEAN DEFAULT false,
    publish_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comms.announcement_reads (
    announcement_id UUID NOT NULL REFERENCES comms.announcements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES identity.users(id),
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged BOOLEAN DEFAULT false,
    PRIMARY KEY (announcement_id, user_id)
);

CREATE TABLE IF NOT EXISTS comms.polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- [{id: uuid, text: "Option A"}]
    multiple_choice BOOLEAN DEFAULT false,
    anonymous BOOLEAN DEFAULT false,
    author_id UUID NOT NULL REFERENCES identity.users(id),
    deadline TIMESTAMPTZ,
    status TEXT DEFAULT 'active', -- active, closed
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comms.poll_votes (
    poll_id UUID NOT NULL REFERENCES comms.polls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES identity.users(id),
    option_id UUID NOT NULL,
    voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (poll_id, user_id, option_id)
);

-- Reports: saved report definitions
CREATE SCHEMA IF NOT EXISTS reports;

CREATE TABLE IF NOT EXISTS reports.definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    source TEXT NOT NULL, -- 'activities', 'users', 'files', 'events', 'tasks', 'emails', 'forms', 'deals', 'tickets'
    columns JSONB NOT NULL DEFAULT '[]', -- [{field, label, aggregation, visible}]
    filters JSONB DEFAULT '[]', -- [{field, operator, value}]
    chart_type TEXT DEFAULT 'table', -- table, bar, line, pie, donut, area, scatter
    chart_config JSONB DEFAULT '{}',
    owner_id UUID NOT NULL REFERENCES identity.users(id),
    shared_with UUID[] DEFAULT '{}',
    schedule_cron TEXT, -- optional: auto-run schedule
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports.executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES reports.definitions(id) ON DELETE CASCADE,
    result_data JSONB NOT NULL,
    row_count INT NOT NULL DEFAULT 0,
    execution_ms INT,
    executed_by UUID REFERENCES identity.users(id),
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
