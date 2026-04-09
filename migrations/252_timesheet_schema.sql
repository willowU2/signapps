-- Timesheet schema: time tracking entries with timer support
CREATE SCHEMA IF NOT EXISTS timesheet;

CREATE TABLE timesheet.entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_name VARCHAR(200),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    is_billable BOOLEAN DEFAULT false,
    project_id UUID,
    owner_id UUID NOT NULL,
    tenant_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_timesheet_owner ON timesheet.entries(owner_id);
CREATE INDEX idx_timesheet_date ON timesheet.entries(start_time);
