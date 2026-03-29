-- migrations/095_calendar_hr_tables.sql
-- HR tables: categories, presence rules, leave balances, timesheets, approval workflows

-- Categories (custom labels with rules)
CREATE TABLE IF NOT EXISTS calendar.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#6b7280',
    icon VARCHAR(64),
    owner_id UUID REFERENCES identity.users(id) ON DELETE CASCADE,
    org_id UUID,
    rules JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_owner ON calendar.categories(owner_id);
CREATE INDEX IF NOT EXISTS idx_categories_org ON calendar.categories(org_id) WHERE org_id IS NOT NULL;

-- Add FK from events.category_id to categories
DO $$ BEGIN
    ALTER TABLE calendar.events
        ADD CONSTRAINT fk_events_category FOREIGN KEY (category_id) REFERENCES calendar.categories(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Presence rules
DO $$ BEGIN
    CREATE TYPE calendar.rule_type AS ENUM ('min_onsite', 'mandatory_days', 'max_remote_same_day', 'min_coverage');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE calendar.enforcement_level AS ENUM ('soft', 'hard');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS calendar.presence_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    team_id UUID,
    rule_type calendar.rule_type NOT NULL,
    rule_config JSONB NOT NULL DEFAULT '{}',
    enforcement calendar.enforcement_level DEFAULT 'soft',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presence_rules_org ON calendar.presence_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_presence_rules_team ON calendar.presence_rules(team_id) WHERE team_id IS NOT NULL;

-- Leave balances
CREATE TABLE IF NOT EXISTS calendar.leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    leave_type calendar.leave_type NOT NULL,
    year INT NOT NULL,
    total_days DECIMAL(5,2) NOT NULL DEFAULT 0,
    used_days DECIMAL(5,2) NOT NULL DEFAULT 0,
    pending_days DECIMAL(5,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, leave_type, year)
);

CREATE INDEX IF NOT EXISTS idx_leave_balances_user_year ON calendar.leave_balances(user_id, year);

-- Timesheet entries
CREATE TABLE IF NOT EXISTS calendar.timesheet_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES calendar.events(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    hours DECIMAL(5,2) NOT NULL DEFAULT 0,
    category_id UUID REFERENCES calendar.categories(id) ON DELETE SET NULL,
    auto_generated BOOLEAN DEFAULT TRUE,
    validated BOOLEAN DEFAULT FALSE,
    validated_at TIMESTAMPTZ,
    exported_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timesheet_user_date ON calendar.timesheet_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_timesheet_event ON calendar.timesheet_entries(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_timesheet_validated ON calendar.timesheet_entries(validated) WHERE validated = FALSE;

-- Approval workflows
CREATE TABLE IF NOT EXISTS calendar.approval_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    trigger_type VARCHAR(64) NOT NULL,
    trigger_config JSONB NOT NULL DEFAULT '{}',
    approvers JSONB NOT NULL DEFAULT '[]',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_workflows_org ON calendar.approval_workflows(org_id);

-- Updated_at triggers for new tables
CREATE OR REPLACE FUNCTION calendar.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY['categories', 'presence_rules', 'leave_balances', 'timesheet_entries', 'approval_workflows'])
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON calendar.%s', t, t);
        EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON calendar.%s FOR EACH ROW EXECUTE FUNCTION calendar.update_updated_at()', t, t);
    END LOOP;
END $$;
