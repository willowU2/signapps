-- AQ-2FA: Add TOTP columns to users table (if not already present via mfa_secret)
-- The mfa_secret and mfa_enabled columns already exist; add backup_codes for recovery.
ALTER TABLE identity.users ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT[] DEFAULT '{}';

-- AQ-SESSMGT: Create sessions table for concurrent session tracking
CREATE TABLE IF NOT EXISTS identity.sessions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    ip_address  TEXT,
    user_agent  TEXT,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON identity.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON identity.sessions(expires_at);
