-- Migration 097: Add last_synced_uid to mail.folders for incremental IMAP sync (Idea 50)

ALTER TABLE mail.folders
    ADD COLUMN IF NOT EXISTS last_synced_uid BIGINT;
