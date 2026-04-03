-- SignApps Platform - Mail Mailing List Detection
-- Version: 149
-- Date: 2026-04-03

-- Add List-Unsubscribe and List-Id headers to emails for mailing list detection
ALTER TABLE mail.emails ADD COLUMN IF NOT EXISTS list_unsubscribe TEXT;
ALTER TABLE mail.emails ADD COLUMN IF NOT EXISTS list_id TEXT;

-- Index for efficient mailing list queries
CREATE INDEX IF NOT EXISTS idx_mail_emails_list_unsubscribe
    ON mail.emails(account_id)
    WHERE list_unsubscribe IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mail_emails_list_id
    ON mail.emails(list_id)
    WHERE list_id IS NOT NULL;
