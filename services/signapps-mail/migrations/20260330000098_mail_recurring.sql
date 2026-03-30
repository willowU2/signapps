-- Migration 098: recurring email schedules
-- Stores recurring send rules scoped to a mail account.

CREATE TABLE IF NOT EXISTS mail.recurring_emails (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id    UUID        NOT NULL REFERENCES mail.accounts(id) ON DELETE CASCADE,
    user_id       UUID        NOT NULL,
    recipient     TEXT        NOT NULL,
    cc            TEXT,
    bcc           TEXT,
    subject       TEXT        NOT NULL,
    body_text     TEXT,
    body_html     TEXT,
    -- cron expression, e.g. "0 9 * * 1" (every Monday 09:00)
    cron_expr     TEXT        NOT NULL,
    -- optional end date; NULL = runs forever
    ends_at       TIMESTAMPTZ,
    -- track last and next send
    last_sent_at  TIMESTAMPTZ,
    next_send_at  TIMESTAMPTZ,
    is_active     BOOLEAN     NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_emails_account_id ON mail.recurring_emails(account_id);
CREATE INDEX IF NOT EXISTS idx_recurring_emails_user_id    ON mail.recurring_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_emails_next_send  ON mail.recurring_emails(next_send_at)
    WHERE is_active = true;
