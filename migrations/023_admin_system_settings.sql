-- Global system configurations and key-value store for super admin overrides
CREATE TABLE IF NOT EXISTS admin_system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert the default value for global AI indexing (user requested 'index all files by default... but a choice to only index certain')
INSERT INTO admin_system_settings (setting_key, setting_value, description)
VALUES (
    'ai_index_all_default',
    'false',
    'When true, all file uploads will trigger AI extraction into vector indexing unless excluded by a specific path rule.'
)
ON CONFLICT (setting_key) DO NOTHING;
