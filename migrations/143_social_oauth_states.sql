-- OAuth CSRF state tokens for social platform authorization flows.
-- Rows are short-lived (10 min) and deleted on callback consumption.
CREATE TABLE IF NOT EXISTS social.oauth_states (
    state       VARCHAR(100) PRIMARY KEY,
    user_id     UUID        NOT NULL,
    platform    VARCHAR(20) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_created_at
    ON social.oauth_states (created_at);

-- Add unique constraint on (user_id, platform, platform_user_id) to support
-- upsert in oauth callback without duplicating accounts.
-- Guard: only add if the constraint does not already exist.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_social_accounts_user_platform_pid'
    ) THEN
        ALTER TABLE social.accounts
            ADD CONSTRAINT uq_social_accounts_user_platform_pid
            UNIQUE (user_id, platform, platform_user_id);
    END IF;
END $$;
