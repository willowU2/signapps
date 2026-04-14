-- Migration 303: add BYTEA encrypted-token columns alongside existing TEXT.
--
-- Plan 4 introduces encrypted token storage. Existing TEXT columns are
-- preserved during the transition so callers can be migrated one at a
-- time. A follow-up plan drops the TEXT columns once all consumers
-- have switched to *_enc.
--
-- Encrypted format: signapps-common::crypto::EncryptedField
--   = version(1) || nonce(12) || aes_gcm(plaintext, dek) || tag(16)
--   under DEK "oauth-tokens-v1"

-- ── mail.accounts ────────────────────────────────────────────────────────────
-- Existing: oauth_refresh_token TEXT
-- (Note: mail.accounts has no access_token column today — IMAP/SMTP use
--  different auth. We add both for future OAuth-mail consumers.)
ALTER TABLE mail.accounts ADD COLUMN IF NOT EXISTS oauth_access_token_enc  BYTEA;
ALTER TABLE mail.accounts ADD COLUMN IF NOT EXISTS oauth_refresh_token_enc BYTEA;
ALTER TABLE mail.accounts ADD COLUMN IF NOT EXISTS oauth_expires_at        TIMESTAMPTZ;
ALTER TABLE mail.accounts ADD COLUMN IF NOT EXISTS oauth_provider_key      TEXT;

-- ── calendar.provider_connections ────────────────────────────────────────────
-- Existing: access_token TEXT NOT NULL, refresh_token TEXT
ALTER TABLE calendar.provider_connections ADD COLUMN IF NOT EXISTS access_token_enc  BYTEA;
ALTER TABLE calendar.provider_connections ADD COLUMN IF NOT EXISTS refresh_token_enc BYTEA;

-- ── social.accounts ──────────────────────────────────────────────────────────
-- Existing: access_token TEXT, refresh_token TEXT
ALTER TABLE social.accounts ADD COLUMN IF NOT EXISTS access_token_enc  BYTEA;
ALTER TABLE social.accounts ADD COLUMN IF NOT EXISTS refresh_token_enc BYTEA;

-- ── Indexes for refresh-job lookup (Plan 5) ──────────────────────────────────
-- Partial index on mail.accounts to accelerate the upcoming refresh-queue
-- scanner that selects rows whose token is about to expire. Calendar +
-- social refresh-queue indexes are added in Plan 5 alongside the queue table.
CREATE INDEX IF NOT EXISTS idx_mail_accounts_oauth_expires_at
    ON mail.accounts (oauth_expires_at)
    WHERE oauth_access_token_enc IS NOT NULL;
