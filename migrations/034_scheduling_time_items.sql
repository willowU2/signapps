-- SignApps Platform - Unified Scheduling Time Items Schema
-- Version: 034
-- Date: 2026-03-19
-- Implements: Unified TimeItem model with MOI/EUX/NOUS scopes

-- Create scheduling schema
CREATE SCHEMA IF NOT EXISTS scheduling;

-- ============================================================================
-- Time Items (Unified: task/event/booking/shift/milestone/reminder/blocker)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scheduling.time_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Type
    item_type VARCHAR(32) NOT NULL CHECK (item_type IN ('task', 'event', 'booking', 'shift', 'milestone', 'reminder', 'blocker')),

    -- Content
    title VARCHAR(500) NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    color VARCHAR(7),  -- hex color

    -- Time
    start_time TIMESTAMPTZ,  -- nullable for unscheduled tasks
    end_time TIMESTAMPTZ,
    deadline TIMESTAMPTZ,
    duration_minutes INT,
    all_day BOOLEAN DEFAULT FALSE,
    timezone VARCHAR(64) DEFAULT 'UTC',

    -- Location
    location_name VARCHAR(255),
    location_address TEXT,
    location_coords POINT,  -- lat/lng
    location_url TEXT,

    -- Organization Hierarchy
    tenant_id UUID NOT NULL,
    business_unit_id UUID,
    service_id UUID,
    project_id UUID,

    -- Ownership & Sharing
    owner_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    scope VARCHAR(16) NOT NULL DEFAULT 'moi' CHECK (scope IN ('moi', 'eux', 'nous')),
    visibility VARCHAR(16) NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'group', 'service', 'bu', 'company', 'public')),

    -- Status & Priority
    status VARCHAR(32) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled', 'pending', 'confirmed')),
    priority VARCHAR(16) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

    -- Energy & Focus (Productivity)
    focus_level VARCHAR(16) CHECK (focus_level IN ('deep', 'medium', 'shallow', 'break')),
    energy_required VARCHAR(16) CHECK (energy_required IN ('high', 'medium', 'low')),
    value_score SMALLINT CHECK (value_score >= 1 AND value_score <= 10),
    estimated_pomodoros SMALLINT,
    actual_pomodoros SMALLINT DEFAULT 0,
    preferred_time_of_day VARCHAR(16) CHECK (preferred_time_of_day IN ('morning', 'midday', 'afternoon', 'evening')),
    min_block_duration_minutes INT,
    max_block_duration_minutes INT,

    -- Relations
    parent_id UUID REFERENCES scheduling.time_items(id) ON DELETE CASCADE,
    template_id UUID,

    -- Booking-specific
    resource_id UUID,
    booking_link VARCHAR(255),

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES identity.users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ  -- soft delete
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_time_items_owner_id ON scheduling.time_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_time_items_tenant_id ON scheduling.time_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_time_items_item_type ON scheduling.time_items(item_type);
CREATE INDEX IF NOT EXISTS idx_time_items_scope ON scheduling.time_items(scope);
CREATE INDEX IF NOT EXISTS idx_time_items_status ON scheduling.time_items(status);
CREATE INDEX IF NOT EXISTS idx_time_items_priority ON scheduling.time_items(priority);
CREATE INDEX IF NOT EXISTS idx_time_items_start_time ON scheduling.time_items(start_time);
CREATE INDEX IF NOT EXISTS idx_time_items_deadline ON scheduling.time_items(deadline);
CREATE INDEX IF NOT EXISTS idx_time_items_parent_id ON scheduling.time_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_time_items_project_id ON scheduling.time_items(project_id);
CREATE INDEX IF NOT EXISTS idx_time_items_resource_id ON scheduling.time_items(resource_id);
CREATE INDEX IF NOT EXISTS idx_time_items_deleted_at ON scheduling.time_items(deleted_at) WHERE deleted_at IS NULL;

-- Range query index (for calendar views)
CREATE INDEX IF NOT EXISTS idx_time_items_date_range ON scheduling.time_items(tenant_id, owner_id, start_time, end_time)
    WHERE deleted_at IS NULL;

-- GIN index for tags
CREATE INDEX IF NOT EXISTS idx_time_items_tags ON scheduling.time_items USING GIN(tags);

-- GIN index for metadata
CREATE INDEX IF NOT EXISTS idx_time_items_metadata ON scheduling.time_items USING GIN(metadata);

-- ============================================================================
-- Time Item Users (Participants)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scheduling.time_item_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    time_item_id UUID NOT NULL REFERENCES scheduling.time_items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL DEFAULT 'participant' CHECK (role IN ('owner', 'editor', 'participant', 'viewer')),
    rsvp_status VARCHAR(16) DEFAULT 'pending' CHECK (rsvp_status IN ('pending', 'accepted', 'declined', 'tentative')),
    rsvp_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(time_item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_time_item_users_time_item_id ON scheduling.time_item_users(time_item_id);
CREATE INDEX IF NOT EXISTS idx_time_item_users_user_id ON scheduling.time_item_users(user_id);

-- ============================================================================
-- Time Item Groups (Group Participants)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scheduling.time_item_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    time_item_id UUID NOT NULL REFERENCES scheduling.time_items(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES identity.groups(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL DEFAULT 'participant' CHECK (role IN ('editor', 'participant', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(time_item_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_time_item_groups_time_item_id ON scheduling.time_item_groups(time_item_id);
CREATE INDEX IF NOT EXISTS idx_time_item_groups_group_id ON scheduling.time_item_groups(group_id);

-- ============================================================================
-- Time Item Dependencies (Blocked By)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scheduling.time_item_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    time_item_id UUID NOT NULL REFERENCES scheduling.time_items(id) ON DELETE CASCADE,
    depends_on_id UUID NOT NULL REFERENCES scheduling.time_items(id) ON DELETE CASCADE,
    dependency_type VARCHAR(32) NOT NULL DEFAULT 'finish_to_start'
        CHECK (dependency_type IN ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish')),
    lag_minutes INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(time_item_id, depends_on_id),
    CHECK (time_item_id != depends_on_id)
);

CREATE INDEX IF NOT EXISTS idx_time_item_deps_time_item_id ON scheduling.time_item_dependencies(time_item_id);
CREATE INDEX IF NOT EXISTS idx_time_item_deps_depends_on_id ON scheduling.time_item_dependencies(depends_on_id);

-- ============================================================================
-- Recurrence Rules
-- ============================================================================
CREATE TABLE IF NOT EXISTS scheduling.recurrence_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    time_item_id UUID NOT NULL REFERENCES scheduling.time_items(id) ON DELETE CASCADE,
    frequency VARCHAR(16) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly', 'custom')),
    interval_value INT NOT NULL DEFAULT 1,
    days_of_week INT[] DEFAULT '{}',  -- 0=Sunday, 6=Saturday
    day_of_month INT,
    month_of_year INT,
    week_of_month INT,
    end_date TIMESTAMPTZ,
    occurrence_count INT,
    exceptions TIMESTAMPTZ[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(time_item_id)
);

CREATE INDEX IF NOT EXISTS idx_recurrence_rules_time_item_id ON scheduling.recurrence_rules(time_item_id);

-- ============================================================================
-- Scheduling Resources (Rooms, Equipment)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scheduling.resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    resource_type VARCHAR(64) NOT NULL CHECK (resource_type IN ('room', 'equipment', 'vehicle', 'desk', 'other')),
    description TEXT,
    capacity INT,
    location VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resources_tenant_id ON scheduling.resources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_resources_resource_type ON scheduling.resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_resources_is_active ON scheduling.resources(is_active);

-- ============================================================================
-- Booking Rules (for external booking pages)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scheduling.booking_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    time_item_id UUID REFERENCES scheduling.time_items(id) ON DELETE CASCADE,
    resource_id UUID REFERENCES scheduling.resources(id) ON DELETE CASCADE,
    user_id UUID REFERENCES identity.users(id) ON DELETE CASCADE,
    slug VARCHAR(100) NOT NULL UNIQUE,  -- for public booking URL
    min_notice_minutes INT DEFAULT 60,
    max_advance_days INT DEFAULT 30,
    buffer_before_minutes INT DEFAULT 0,
    buffer_after_minutes INT DEFAULT 0,
    max_per_day INT,
    slot_duration_minutes INT DEFAULT 30,
    allowed_times JSONB,  -- [{start: "09:00", end: "17:00", days: [1,2,3,4,5]}]
    blocked_times JSONB,  -- [{start: "2026-03-20T12:00", end: "2026-03-20T13:00"}]
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (
        (time_item_id IS NOT NULL AND resource_id IS NULL AND user_id IS NULL) OR
        (time_item_id IS NULL AND resource_id IS NOT NULL AND user_id IS NULL) OR
        (time_item_id IS NULL AND resource_id IS NULL AND user_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_booking_rules_slug ON scheduling.booking_rules(slug);
CREATE INDEX IF NOT EXISTS idx_booking_rules_user_id ON scheduling.booking_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_booking_rules_resource_id ON scheduling.booking_rules(resource_id);

-- ============================================================================
-- Templates (Reusable TimeItem templates)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scheduling.templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(64),
    items JSONB NOT NULL,  -- Array of CreateTimeItemInput
    created_by UUID NOT NULL REFERENCES identity.users(id) ON DELETE SET NULL,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_tenant_id ON scheduling.templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_templates_category ON scheduling.templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_is_public ON scheduling.templates(is_public);

-- ============================================================================
-- User Scheduling Preferences
-- ============================================================================
CREATE TABLE IF NOT EXISTS scheduling.user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES identity.users(id) ON DELETE CASCADE,

    -- Energy Settings
    peak_hours_start INT DEFAULT 9,
    peak_hours_end INT DEFAULT 12,

    -- Pomodoro Settings
    pomodoro_length INT DEFAULT 25,
    short_break_length INT DEFAULT 5,
    long_break_length INT DEFAULT 15,
    pomodoros_until_long_break INT DEFAULT 4,

    -- Display Preferences
    show_weekends BOOLEAN DEFAULT TRUE,
    show_24_hour BOOLEAN DEFAULT TRUE,
    default_view VARCHAR(32) DEFAULT 'week',
    default_scope VARCHAR(16) DEFAULT 'moi',
    week_starts_on INT DEFAULT 1,  -- 0=Sunday, 1=Monday

    -- Notification Settings
    reminder_defaults INT[] DEFAULT '{15, 60}',  -- minutes before
    enable_sound_notifications BOOLEAN DEFAULT TRUE,
    enable_desktop_notifications BOOLEAN DEFAULT TRUE,

    -- Energy Profile
    energy_profile JSONB DEFAULT '{"morning": "high", "midday": "medium", "afternoon": "low", "evening": "medium"}',
    preferred_deep_work_time VARCHAR(16) DEFAULT 'morning',

    -- Auto-Scheduling
    auto_schedule_enabled BOOLEAN DEFAULT FALSE,
    respect_blockers BOOLEAN DEFAULT TRUE,
    buffer_between_meetings INT DEFAULT 15,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON scheduling.user_preferences(user_id);

-- ============================================================================
-- Updated_at Trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION scheduling.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_time_items_updated_at
    BEFORE UPDATE ON scheduling.time_items
    FOR EACH ROW EXECUTE FUNCTION scheduling.update_updated_at_column();

CREATE TRIGGER update_recurrence_rules_updated_at
    BEFORE UPDATE ON scheduling.recurrence_rules
    FOR EACH ROW EXECUTE FUNCTION scheduling.update_updated_at_column();

CREATE TRIGGER update_resources_updated_at
    BEFORE UPDATE ON scheduling.resources
    FOR EACH ROW EXECUTE FUNCTION scheduling.update_updated_at_column();

CREATE TRIGGER update_booking_rules_updated_at
    BEFORE UPDATE ON scheduling.booking_rules
    FOR EACH ROW EXECUTE FUNCTION scheduling.update_updated_at_column();

CREATE TRIGGER update_templates_updated_at
    BEFORE UPDATE ON scheduling.templates
    FOR EACH ROW EXECUTE FUNCTION scheduling.update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON scheduling.user_preferences
    FOR EACH ROW EXECUTE FUNCTION scheduling.update_updated_at_column();
