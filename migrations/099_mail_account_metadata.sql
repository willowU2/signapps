-- Migration 099: Add metadata JSONB column to mail.accounts
-- Used by AI inbox categorization settings (Ideas #31 / #33)

ALTER TABLE mail.accounts
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
