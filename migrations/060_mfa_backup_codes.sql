-- AQ-FIX-MFABACKUP: Hashed MFA backup codes table
-- Backup codes are stored as SHA-256 hashes, never in plaintext.
CREATE TABLE IF NOT EXISTS identity.mfa_backup_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    code_hash   VARCHAR(64) NOT NULL,   -- SHA-256 hex digest
    is_used     BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_user_id
    ON identity.mfa_backup_codes(user_id)
    WHERE is_used = false;
