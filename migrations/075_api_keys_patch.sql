-- Migration 071: Add PATCH support columns to api_keys
-- Allows renaming a key and toggling is_active

-- updated_at column for PATCH tracking (created_at already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'identity' AND table_name = 'api_keys' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE identity.api_keys ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;
