-- Migration 067: Password reset tokens table
CREATE TABLE IF NOT EXISTS identity.password_reset_tokens (
    token      TEXT PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
    ON identity.password_reset_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at
    ON identity.password_reset_tokens(expires_at);
