-- SignApps Platform - Multi-Tenant Calendar System Migration
-- Version: 031
-- Date: 2026-03-13
-- Implements: Multi-tenant architecture, Projects, Templates, Enhanced Resources

-- ============================================================================
-- PHASE 1: TENANTS (Enterprises/Organizations)
-- ============================================================================

-- Tenants table (each enterprise/organization is a tenant)
CREATE TABLE IF NOT EXISTS identity.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,  -- URL-friendly identifier
    domain VARCHAR(255),  -- Custom domain (optional)
    logo_url TEXT,
    settings JSONB DEFAULT '{}',  -- Tenant-specific configuration
    plan VARCHAR(50) DEFAULT 'free',  -- 'free', 'pro', 'enterprise'
    max_users INTEGER DEFAULT 5,
    max_resources INTEGER DEFAULT 10,
    max_workspaces INTEGER DEFAULT 3,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON identity.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON identity.tenants(domain) WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_is_active ON identity.tenants(is_active);

-- Add tenant_id to users (using IF NOT EXISTS for idempotency)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'identity' AND table_name = 'users' AND column_name = 'tenant_id') THEN
        ALTER TABLE identity.users ADD COLUMN tenant_id UUID REFERENCES identity.tenants(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'identity' AND table_name = 'users' AND column_name = 'department') THEN
        ALTER TABLE identity.users ADD COLUMN department VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'identity' AND table_name = 'users' AND column_name = 'job_title') THEN
        ALTER TABLE identity.users ADD COLUMN job_title VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'identity' AND table_name = 'users' AND column_name = 'phone') THEN
        ALTER TABLE identity.users ADD COLUMN phone VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'identity' AND table_name = 'users' AND column_name = 'timezone') THEN
        ALTER TABLE identity.users ADD COLUMN timezone VARCHAR(50) DEFAULT 'Europe/Paris';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'identity' AND table_name = 'users' AND column_name = 'locale') THEN
        ALTER TABLE identity.users ADD COLUMN locale VARCHAR(10) DEFAULT 'fr';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'identity' AND table_name = 'users' AND column_name = 'avatar_url') THEN
        ALTER TABLE identity.users ADD COLUMN avatar_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'identity' AND table_name = 'users' AND column_name = 'user_settings') THEN
        ALTER TABLE identity.users ADD COLUMN user_settings JSONB DEFAULT '{}';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON identity.users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON identity.users(tenant_id, email);

-- ============================================================================
-- PHASE 2: WORKSPACES (Groups within a tenant)
-- ============================================================================

-- Workspaces table (groups/teams within a tenant)
CREATE TABLE IF NOT EXISTS identity.workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#6366F1',
    icon VARCHAR(50),
    is_default BOOLEAN DEFAULT FALSE,
    settings JSONB DEFAULT '{}',
    created_by UUID REFERENCES identity.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_tenant_id ON identity.workspaces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_is_default ON identity.workspaces(tenant_id, is_default);

-- Workspace members (users can belong to multiple workspaces)
CREATE TABLE IF NOT EXISTS identity.workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES identity.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',  -- 'owner', 'admin', 'member', 'viewer'
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON identity.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON identity.workspace_members(user_id);

-- ============================================================================
-- PHASE 3: ENHANCED CALENDAR SCHEMA (Multi-tenant)
-- ============================================================================

-- Calendar types enum
DO $$ BEGIN
    CREATE TYPE calendar.calendar_type AS ENUM (
        'personal',
        'group',
        'enterprise',
        'resource_room',
        'resource_equipment'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add tenant_id and new columns to calendars (using IF NOT EXISTS for idempotency)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'calendar' AND table_name = 'calendars' AND column_name = 'tenant_id') THEN
        ALTER TABLE calendar.calendars ADD COLUMN tenant_id UUID REFERENCES identity.tenants(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'calendar' AND table_name = 'calendars' AND column_name = 'workspace_id') THEN
        ALTER TABLE calendar.calendars ADD COLUMN workspace_id UUID REFERENCES identity.workspaces(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'calendar' AND table_name = 'calendars' AND column_name = 'calendar_type') THEN
        ALTER TABLE calendar.calendars ADD COLUMN calendar_type VARCHAR(30) DEFAULT 'personal';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'calendar' AND table_name = 'calendars' AND column_name = 'resource_id') THEN
        ALTER TABLE calendar.calendars ADD COLUMN resource_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'calendar' AND table_name = 'calendars' AND column_name = 'is_default') THEN
        ALTER TABLE calendar.calendars ADD COLUMN is_default BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_calendars_tenant_id ON calendar.calendars(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calendars_workspace_id ON calendar.calendars(workspace_id);
CREATE INDEX IF NOT EXISTS idx_calendars_calendar_type ON calendar.calendars(calendar_type);

-- Add tenant_id to events (denormalized for efficient queries)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'calendar' AND table_name = 'events' AND column_name = 'tenant_id') THEN
        ALTER TABLE calendar.events ADD COLUMN tenant_id UUID REFERENCES identity.tenants(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_events_tenant_id ON calendar.events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_tenant_calendar_date ON calendar.events(tenant_id, calendar_id, start_time, end_time);

-- ============================================================================
-- PHASE 4: ENHANCED RESOURCES (Rooms, Equipment with tenant isolation)
-- ============================================================================

-- Resource types (configurable per tenant)
CREATE TABLE IF NOT EXISTS calendar.resource_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,  -- 'room', 'equipment', 'vehicle', 'desk'
    icon VARCHAR(50),
    color VARCHAR(7),
    requires_approval BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_resource_types_tenant ON calendar.resource_types(tenant_id);

-- Add tenant_id and enhance resources table (using IF NOT EXISTS for idempotency)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'calendar' AND table_name = 'resources' AND column_name = 'tenant_id') THEN
        ALTER TABLE calendar.resources ADD COLUMN tenant_id UUID REFERENCES identity.tenants(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'calendar' AND table_name = 'resources' AND column_name = 'resource_type_id') THEN
        ALTER TABLE calendar.resources ADD COLUMN resource_type_id UUID REFERENCES calendar.resource_types(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'calendar' AND table_name = 'resources' AND column_name = 'floor') THEN
        ALTER TABLE calendar.resources ADD COLUMN floor VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'calendar' AND table_name = 'resources' AND column_name = 'building') THEN
        ALTER TABLE calendar.resources ADD COLUMN building VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'calendar' AND table_name = 'resources' AND column_name = 'amenities') THEN
        ALTER TABLE calendar.resources ADD COLUMN amenities TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'calendar' AND table_name = 'resources' AND column_name = 'photo_urls') THEN
        ALTER TABLE calendar.resources ADD COLUMN photo_urls TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'calendar' AND table_name = 'resources' AND column_name = 'calendar_id') THEN
        ALTER TABLE calendar.resources ADD COLUMN calendar_id UUID REFERENCES calendar.calendars(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'calendar' AND table_name = 'resources' AND column_name = 'availability_rules') THEN
        ALTER TABLE calendar.resources ADD COLUMN availability_rules JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'calendar' AND table_name = 'resources' AND column_name = 'booking_rules') THEN
        ALTER TABLE calendar.resources ADD COLUMN booking_rules JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'calendar' AND table_name = 'resources' AND column_name = 'requires_approval') THEN
        ALTER TABLE calendar.resources ADD COLUMN requires_approval BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'calendar' AND table_name = 'resources' AND column_name = 'approver_ids') THEN
        ALTER TABLE calendar.resources ADD COLUMN approver_ids UUID[];
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_resources_tenant_id ON calendar.resources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_resources_resource_type_id ON calendar.resources(resource_type_id);
CREATE INDEX IF NOT EXISTS idx_resources_tenant_type ON calendar.resources(tenant_id, resource_type);

-- Now add foreign key for calendar.calendars.resource_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_calendars_resource') THEN
        ALTER TABLE calendar.calendars ADD CONSTRAINT fk_calendars_resource FOREIGN KEY (resource_id) REFERENCES calendar.resources(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Reservations (booking system with approval workflow)
CREATE TABLE IF NOT EXISTS calendar.reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES calendar.resources(id) ON DELETE CASCADE,
    event_id UUID REFERENCES calendar.events(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES identity.users(id),
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'cancelled'
    approved_by UUID REFERENCES identity.users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_tenant ON calendar.reservations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reservations_resource ON calendar.reservations(tenant_id, resource_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON calendar.reservations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_reservations_requested_by ON calendar.reservations(requested_by);

-- ============================================================================
-- PHASE 5: PROJECTS
-- ============================================================================

-- Project status enum
DO $$ BEGIN
    CREATE TYPE calendar.project_status AS ENUM (
        'planning',
        'active',
        'on_hold',
        'completed',
        'archived'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Projects table
CREATE TABLE IF NOT EXISTS calendar.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES identity.workspaces(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#10B981',
    icon VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    start_date DATE,
    due_date DATE,
    calendar_id UUID REFERENCES calendar.calendars(id) ON DELETE SET NULL,
    template_id UUID,  -- Will reference templates table
    owner_id UUID REFERENCES identity.users(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_projects_tenant ON calendar.projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON calendar.projects(tenant_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON calendar.projects(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON calendar.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_deleted ON calendar.projects(tenant_id) WHERE deleted_at IS NULL;

-- Project members
CREATE TABLE IF NOT EXISTS calendar.project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES calendar.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',  -- 'owner', 'admin', 'member', 'viewer'
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON calendar.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON calendar.project_members(user_id);

-- ============================================================================
-- PHASE 6: ENHANCED TASKS (with project support)
-- ============================================================================

-- Task status enum
DO $$ BEGIN
    CREATE TYPE calendar.task_status AS ENUM (
        'todo',
        'in_progress',
        'done',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Task priority enum
DO $$ BEGIN
    CREATE TYPE calendar.task_priority AS ENUM (
        'none',
        'low',
        'medium',
        'high',
        'urgent'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add tenant_id, project_id and enhance tasks table (using IF NOT EXISTS for idempotency)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'calendar' AND table_name = 'tasks' AND column_name = 'tenant_id') THEN
        ALTER TABLE calendar.tasks ADD COLUMN tenant_id UUID REFERENCES identity.tenants(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'calendar' AND table_name = 'tasks' AND column_name = 'project_id') THEN
        ALTER TABLE calendar.tasks ADD COLUMN project_id UUID REFERENCES calendar.projects(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'calendar' AND table_name = 'tasks' AND column_name = 'event_id') THEN
        ALTER TABLE calendar.tasks ADD COLUMN event_id UUID REFERENCES calendar.events(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'calendar' AND table_name = 'tasks' AND column_name = 'position') THEN
        ALTER TABLE calendar.tasks ADD COLUMN position INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'calendar' AND table_name = 'tasks' AND column_name = 'estimated_hours') THEN
        ALTER TABLE calendar.tasks ADD COLUMN estimated_hours DECIMAL(5,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'calendar' AND table_name = 'tasks' AND column_name = 'template_id') THEN
        ALTER TABLE calendar.tasks ADD COLUMN template_id UUID;
    END IF;
END $$;

-- Update indexes for tasks
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_id ON calendar.tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_project ON calendar.tasks(tenant_id, project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_calendar ON calendar.tasks(tenant_id, calendar_id);
CREATE INDEX IF NOT EXISTS idx_tasks_position ON calendar.tasks(project_id, position);
CREATE INDEX IF NOT EXISTS idx_tasks_event ON calendar.tasks(event_id) WHERE event_id IS NOT NULL;

-- ============================================================================
-- PHASE 7: TEMPLATES
-- ============================================================================

-- Template types enum
DO $$ BEGIN
    CREATE TYPE calendar.template_type AS ENUM (
        'project',
        'task',
        'event',
        'checklist'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Templates table
CREATE TABLE IF NOT EXISTS calendar.templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES identity.tenants(id) ON DELETE CASCADE,  -- NULL = global template
    workspace_id UUID REFERENCES identity.workspaces(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_type VARCHAR(20) NOT NULL,
    content JSONB NOT NULL,  -- Template structure with placeholders
    icon VARCHAR(50),
    color VARCHAR(7),
    is_public BOOLEAN DEFAULT FALSE,  -- Visible to all tenants
    usage_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES identity.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_templates_tenant ON calendar.templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_templates_type ON calendar.templates(tenant_id, template_type);
CREATE INDEX IF NOT EXISTS idx_templates_public ON calendar.templates(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_templates_deleted ON calendar.templates(tenant_id) WHERE deleted_at IS NULL;

-- Add foreign keys for template references
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_projects_template') THEN
        ALTER TABLE calendar.projects ADD CONSTRAINT fk_projects_template FOREIGN KEY (template_id) REFERENCES calendar.templates(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_tasks_template') THEN
        ALTER TABLE calendar.tasks ADD CONSTRAINT fk_tasks_template FOREIGN KEY (template_id) REFERENCES calendar.templates(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- PHASE 8: LABELS (for categorization)
-- ============================================================================

-- Labels table
CREATE TABLE IF NOT EXISTS calendar.labels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES identity.workspaces(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_labels_tenant ON calendar.labels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_labels_workspace ON calendar.labels(tenant_id, workspace_id);

-- Entity labels (polymorphic junction table)
CREATE TABLE IF NOT EXISTS calendar.entity_labels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label_id UUID NOT NULL REFERENCES calendar.labels(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,  -- 'event', 'task', 'project'
    entity_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(label_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_labels_label ON calendar.entity_labels(label_id);
CREATE INDEX IF NOT EXISTS idx_entity_labels_entity ON calendar.entity_labels(entity_type, entity_id);

-- ============================================================================
-- PHASE 9: ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on tenant-scoped tables
ALTER TABLE calendar.calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar.labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.workspaces ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant isolation
-- Note: Policies require app.current_tenant_id to be set via SET LOCAL

CREATE POLICY tenant_isolation_calendars ON calendar.calendars
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_events ON calendar.events
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_tasks ON calendar.tasks
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_resources ON calendar.resources
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_projects ON calendar.projects
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_templates ON calendar.templates
    FOR ALL USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
        OR is_public = TRUE
    );

CREATE POLICY tenant_isolation_labels ON calendar.labels
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_reservations ON calendar.reservations
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_workspaces ON identity.workspaces
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================================
-- PHASE 10: DEFAULT DATA
-- ============================================================================

-- Insert default resource types (will be copied per tenant)
-- This is a reference for what to create when a new tenant is created

-- Function to create default data for new tenant
CREATE OR REPLACE FUNCTION calendar.setup_tenant_defaults(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
    -- Create default resource types
    INSERT INTO calendar.resource_types (tenant_id, name, icon, color, requires_approval)
    VALUES
        (p_tenant_id, 'room', 'door-open', '#3B82F6', false),
        (p_tenant_id, 'equipment', 'wrench', '#10B981', false),
        (p_tenant_id, 'vehicle', 'car', '#F59E0B', true),
        (p_tenant_id, 'desk', 'monitor', '#8B5CF6', false);
END;
$$ LANGUAGE plpgsql;

-- Trigger to setup defaults on new tenant creation
CREATE OR REPLACE FUNCTION calendar.on_tenant_created()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM calendar.setup_tenant_defaults(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenant_created_setup
    AFTER INSERT ON identity.tenants
    FOR EACH ROW
    EXECUTE FUNCTION calendar.on_tenant_created();

-- ============================================================================
-- PHASE 11: HELPFUL VIEWS
-- ============================================================================

-- View: Upcoming events with calendar info
CREATE OR REPLACE VIEW calendar.upcoming_events AS
SELECT
    e.id,
    e.tenant_id,
    e.calendar_id,
    c.name as calendar_name,
    c.color as calendar_color,
    e.title,
    e.description,
    e.location,
    e.start_time,
    e.end_time,
    e.is_all_day,
    e.rrule,
    e.created_by
FROM calendar.events e
JOIN calendar.calendars c ON e.calendar_id = c.id
WHERE e.is_deleted = FALSE
  AND e.start_time >= NOW()
ORDER BY e.start_time;

-- View: Tasks with project info
CREATE OR REPLACE VIEW calendar.tasks_with_project AS
SELECT
    t.id,
    t.tenant_id,
    t.project_id,
    p.name as project_name,
    p.color as project_color,
    t.calendar_id,
    t.parent_task_id,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.due_date,
    t.assigned_to,
    t.position,
    t.estimated_hours,
    t.completed_at,
    t.created_at
FROM calendar.tasks t
LEFT JOIN calendar.projects p ON t.project_id = p.id;

-- View: Resource availability
CREATE OR REPLACE VIEW calendar.resource_availability AS
SELECT
    r.id as resource_id,
    r.tenant_id,
    r.name as resource_name,
    r.resource_type,
    r.capacity,
    r.location,
    r.is_available,
    COUNT(DISTINCT ev.id) as total_events_today,
    ARRAY_AGG(
        DISTINCT jsonb_build_object(
            'start', ev.start_time,
            'end', ev.end_time,
            'title', ev.title
        )
    ) FILTER (WHERE ev.id IS NOT NULL) as events_today
FROM calendar.resources r
LEFT JOIN calendar.event_resources er ON r.id = er.resource_id
LEFT JOIN calendar.events ev ON er.event_id = ev.id
    AND ev.start_time::date = CURRENT_DATE
    AND ev.is_deleted = FALSE
WHERE r.is_available = TRUE
GROUP BY r.id;
