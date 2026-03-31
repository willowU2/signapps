-- Migration 136: WebDAV configuration
-- Adds a per-user flag to enable/disable WebDAV access.
-- The global on/off toggle is stored in admin_system_settings (key = 'webdav_enabled').

ALTER TABLE identity.users
    ADD COLUMN IF NOT EXISTS webdav_enabled BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN identity.users.webdav_enabled
    IS 'Whether this user is allowed to connect via WebDAV (Basic Auth).';
