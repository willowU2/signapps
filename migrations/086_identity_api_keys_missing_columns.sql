-- Migration 086: Fix identity.api_keys missing columns
-- Adds key_prefix, last_used and is_active columns that the application
-- layer expects but were absent from the original table definition.

ALTER TABLE identity.api_keys ADD COLUMN IF NOT EXISTS key_prefix TEXT        NOT NULL DEFAULT '';
ALTER TABLE identity.api_keys ADD COLUMN IF NOT EXISTS last_used  TIMESTAMPTZ;
ALTER TABLE identity.api_keys ADD COLUMN IF NOT EXISTS is_active  BOOLEAN     NOT NULL DEFAULT TRUE;
