-- Add avatar_url column to users table
ALTER TABLE identity.users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255);
