-- Migration 100: email read-tracking
-- One row per tracking pixel served (i.e. per open event).

CREATE TABLE IF NOT EXISTS mail.email_opens (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_id  UUID        NOT NULL UNIQUE,  -- embedded in the pixel URL
    email_id     UUID        NOT NULL REFERENCES mail.emails(id) ON DELETE CASCADE,
    account_id   UUID        NOT NULL,
    user_id      UUID        NOT NULL,          -- owner of the sending account
    -- open events (multiple rows with the same tracking_id are NOT expected;
    -- each email gets one pixel / one tracking_id)
    open_count   INT         NOT NULL DEFAULT 0,
    first_open   TIMESTAMPTZ,
    last_open    TIMESTAMPTZ,
    -- optional metadata captured when pixel is loaded
    user_agent   TEXT,
    ip_address   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_opens_email_id    ON mail.email_opens(email_id);
CREATE INDEX IF NOT EXISTS idx_email_opens_user_id     ON mail.email_opens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_opens_tracking_id ON mail.email_opens(tracking_id);
