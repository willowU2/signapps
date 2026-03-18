-- SignApps Platform - User Preferences Schema
-- Version: 033
-- Date: 2026-03-18
-- Description: Adds user preferences table for theme, language, UI settings

-- ============================================================================
-- User Preferences Table
-- ============================================================================
-- Stores user preferences as JSONB for flexibility
-- Each user has one preferences record that syncs across devices

CREATE TABLE IF NOT EXISTS identity.user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES identity.users(id) ON DELETE CASCADE,

    -- Versioning for conflict resolution
    version INTEGER NOT NULL DEFAULT 1,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    device_id VARCHAR(64),

    -- Appearance
    theme VARCHAR(32) NOT NULL DEFAULT 'system',  -- 'light', 'dark', 'system'
    accent_color VARCHAR(32) DEFAULT 'blue',
    font_size VARCHAR(16) DEFAULT 'medium',  -- 'small', 'medium', 'large'
    compact_mode BOOLEAN DEFAULT FALSE,

    -- Regional
    language VARCHAR(8) NOT NULL DEFAULT 'fr',  -- ISO 639-1
    timezone VARCHAR(64) DEFAULT 'Europe/Paris',
    date_format VARCHAR(32) DEFAULT 'dd/MM/yyyy',
    time_format VARCHAR(16) DEFAULT '24h',  -- '12h', '24h'
    first_day_of_week SMALLINT DEFAULT 1,  -- 0=Sunday, 1=Monday

    -- Notifications
    notification_sound BOOLEAN DEFAULT TRUE,
    notification_desktop BOOLEAN DEFAULT TRUE,
    notification_email_digest VARCHAR(16) DEFAULT 'daily',  -- 'never', 'instant', 'daily', 'weekly'

    -- Editor
    editor_autosave BOOLEAN DEFAULT TRUE,
    editor_autosave_interval INTEGER DEFAULT 30,  -- seconds
    editor_spell_check BOOLEAN DEFAULT TRUE,
    editor_word_wrap BOOLEAN DEFAULT TRUE,

    -- Calendar
    calendar_default_view VARCHAR(16) DEFAULT 'week',  -- 'day', 'week', 'month', 'agenda'
    calendar_working_hours_start VARCHAR(5) DEFAULT '09:00',
    calendar_working_hours_end VARCHAR(5) DEFAULT '18:00',
    calendar_show_weekends BOOLEAN DEFAULT TRUE,

    -- Drive/Storage
    drive_default_view VARCHAR(16) DEFAULT 'grid',  -- 'grid', 'list'
    drive_sort_by VARCHAR(32) DEFAULT 'name',
    drive_sort_order VARCHAR(8) DEFAULT 'asc',

    -- Keyboard shortcuts
    keyboard_shortcuts_enabled BOOLEAN DEFAULT TRUE,

    -- Accessibility
    reduce_motion BOOLEAN DEFAULT FALSE,
    high_contrast BOOLEAN DEFAULT FALSE,

    -- Extended preferences as JSONB (for future additions)
    extra JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id
    ON identity.user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_updated_at
    ON identity.user_preferences(updated_at);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION identity.update_user_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_preferences_updated
    BEFORE UPDATE ON identity.user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION identity.update_user_preferences_timestamp();

-- Comments
COMMENT ON TABLE identity.user_preferences IS 'User preferences for theme, language, and UI settings';
COMMENT ON COLUMN identity.user_preferences.version IS 'Incremented on each update for conflict resolution';
COMMENT ON COLUMN identity.user_preferences.device_id IS 'Last device that synced preferences';
COMMENT ON COLUMN identity.user_preferences.extra IS 'Extended preferences as JSONB for future additions';
