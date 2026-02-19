-- SignApps Platform - Calendar & Tasks Schema Migration
-- Version: 011
-- Date: 2026-02-16
-- Implements: Calendars, Events, Tasks, Resources, Sharing

-- Create calendar schema
CREATE SCHEMA IF NOT EXISTS calendar;

-- ============================================================================
-- Calendars table
-- ============================================================================
CREATE TABLE calendar.calendars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    color VARCHAR(7) DEFAULT '#3b82f6',  -- hex color
    is_shared BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendars_owner_id ON calendar.calendars(owner_id);
CREATE INDEX idx_calendars_is_shared ON calendar.calendars(is_shared);

-- ============================================================================
-- Calendar Members (sharing and permissions)
-- ============================================================================
CREATE TABLE calendar.calendar_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calendar_id UUID NOT NULL REFERENCES calendar.calendars(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL DEFAULT 'viewer',  -- owner|editor|viewer
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(calendar_id, user_id)
);

CREATE INDEX idx_calendar_members_calendar_id ON calendar.calendar_members(calendar_id);
CREATE INDEX idx_calendar_members_user_id ON calendar.calendar_members(user_id);

-- ============================================================================
-- Events table (supports recurring with RRULE RFC 5545)
-- ============================================================================
CREATE TABLE calendar.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calendar_id UUID NOT NULL REFERENCES calendar.calendars(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    -- Recurrence (RFC 5545 RRULE format)
    rrule TEXT,  -- e.g., 'FREQ=WEEKLY;BYDAY=MO,WE;COUNT=52'
    rrule_exceptions UUID[] DEFAULT '{}',  -- IDs of cancelled instances
    -- Timezone
    timezone VARCHAR(64) DEFAULT 'UTC',
    -- Creator and metadata
    created_by UUID NOT NULL REFERENCES identity.users(id) ON DELETE SET NULL,
    is_all_day BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_calendar_id ON calendar.events(calendar_id);
CREATE INDEX idx_events_start_time ON calendar.events(start_time);
CREATE INDEX idx_events_calendar_start_time ON calendar.events(calendar_id, start_time);
CREATE INDEX idx_events_created_by ON calendar.events(created_by);

-- ============================================================================
-- Event Attendees (RSVP tracking)
-- ============================================================================
CREATE TABLE calendar.event_attendees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES calendar.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    email VARCHAR(255),  -- For external attendees
    rsvp_status VARCHAR(32) NOT NULL DEFAULT 'pending',  -- pending|accepted|declined|tentative
    response_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

CREATE INDEX idx_event_attendees_event_id ON calendar.event_attendees(event_id);
CREATE INDEX idx_event_attendees_user_id ON calendar.event_attendees(user_id);

-- ============================================================================
-- Event Metadata (iCalendar extensions, custom properties)
-- ============================================================================
CREATE TABLE calendar.event_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES calendar.events(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, key)
);

CREATE INDEX idx_event_metadata_event_id ON calendar.event_metadata(event_id);

-- ============================================================================
-- Resources (rooms, equipment, vehicles)
-- ============================================================================
CREATE TABLE calendar.resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,  -- room|equipment|vehicle
    description TEXT,
    capacity INT,  -- For rooms: how many people
    location VARCHAR(255),
    is_available BOOLEAN DEFAULT TRUE,
    owner_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_resources_resource_type ON calendar.resources(resource_type);
CREATE INDEX idx_resources_is_available ON calendar.resources(is_available);

-- ============================================================================
-- Event Resources (booking: event ↔ resource)
-- ============================================================================
CREATE TABLE calendar.event_resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES calendar.events(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES calendar.resources(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, resource_id)
);

CREATE INDEX idx_event_resources_event_id ON calendar.event_resources(event_id);
CREATE INDEX idx_event_resources_resource_id ON calendar.event_resources(resource_id);

-- ============================================================================
-- Tasks (hierarchical with parent_id)
-- ============================================================================
CREATE TABLE calendar.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calendar_id UUID NOT NULL REFERENCES calendar.calendars(id) ON DELETE CASCADE,
    parent_task_id UUID REFERENCES calendar.tasks(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'open',  -- open|in_progress|completed|archived
    priority INT DEFAULT 0,  -- 0=low, 1=medium, 2=high, 3=urgent
    due_date DATE,
    assigned_to UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES identity.users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_calendar_id ON calendar.tasks(calendar_id);
CREATE INDEX idx_tasks_parent_task_id ON calendar.tasks(parent_task_id);
CREATE INDEX idx_tasks_assigned_to ON calendar.tasks(assigned_to);
CREATE INDEX idx_tasks_due_date ON calendar.tasks(due_date);
CREATE INDEX idx_tasks_status ON calendar.tasks(status);

-- ============================================================================
-- Task Attachments (file references)
-- ============================================================================
CREATE TABLE calendar.task_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES calendar.tasks(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name VARCHAR(255),
    file_size_bytes INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_attachments_task_id ON calendar.task_attachments(task_id);

-- ============================================================================
-- Reminders / Notifications
-- ============================================================================
CREATE TABLE calendar.reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES calendar.events(id) ON DELETE CASCADE,
    task_id UUID REFERENCES calendar.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    reminder_type VARCHAR(32) NOT NULL DEFAULT 'notification',  -- notification|email|sms
    minutes_before INT NOT NULL DEFAULT 15,  -- Send reminder N minutes before
    is_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK ((event_id IS NOT NULL AND task_id IS NULL) OR (event_id IS NULL AND task_id IS NOT NULL))
);

CREATE INDEX idx_reminders_event_id ON calendar.reminders(event_id);
CREATE INDEX idx_reminders_task_id ON calendar.reminders(task_id);
CREATE INDEX idx_reminders_user_id ON calendar.reminders(user_id);
CREATE INDEX idx_reminders_is_sent ON calendar.reminders(is_sent);

-- ============================================================================
-- Activity Log (audit trail)
-- ============================================================================
CREATE TABLE calendar.activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calendar_id UUID NOT NULL REFERENCES calendar.calendars(id) ON DELETE CASCADE,
    entity_type VARCHAR(64) NOT NULL,  -- 'event'|'task'|'calendar'|'resource'
    entity_id UUID NOT NULL,
    action VARCHAR(64) NOT NULL,  -- 'created'|'updated'|'deleted'|'shared'
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE SET NULL,
    changes JSONB,  -- Before/after changes
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_log_calendar_id ON calendar.activity_log(calendar_id);
CREATE INDEX idx_activity_log_entity_type_id ON calendar.activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_log_created_at ON calendar.activity_log(created_at);
