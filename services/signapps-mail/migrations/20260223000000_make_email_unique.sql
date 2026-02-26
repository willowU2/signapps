-- Make email_address unique per user so we can ON CONFLICT upsert OAuth tokens
ALTER TABLE mail_accounts ADD CONSTRAINT unique_user_email UNIQUE (user_id, email_address);
