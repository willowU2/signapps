-- 235_drop_legacy_sharing_tables.sql
-- Phase 4 of unified sharing system: drop the legacy sharing tables.
--
-- All data has been migrated to sharing.grants in migration 233.
-- All Rust code has been refactored to use signapps-sharing engine
-- (commits in feat/sharing-legacy-cutover branch).
--
-- This migration is DESTRUCTIVE — the legacy tables and their data
-- are permanently removed. The data is preserved in sharing.grants
-- (migrated by 233_sharing_data_migration.sql).
--
-- Tables dropped:
--   - drive.acl                 (5-role ACL on drive nodes)
--   - calendar.calendar_members (calendar member list)
--   - document_permissions      (collaborative doc perms)
--
-- NOT dropped (kept for forensics / share links):
--   - drive.audit_log           (forensic chain, separate from sharing.audit_log)
--   - drive.share_links         (token-based public sharing)

-- ═══════════════════════════════════════════════════════════════
-- 1. Drop drive.acl
-- ═══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS drive.acl CASCADE;

-- Drop the ENUM types that only existed for drive.acl
DROP TYPE IF EXISTS drive.acl_role CASCADE;
DROP TYPE IF EXISTS drive.grantee_type CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- 2. Drop calendar.calendar_members
-- ═══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS calendar.calendar_members CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- 3. Drop document_permissions
-- ═══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS document_permissions CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- Verification queries (run manually after migration):
--
-- SELECT COUNT(*) FROM sharing.grants WHERE resource_type IN ('file', 'folder');
--   -- Should match the original drive.acl count
--
-- SELECT COUNT(*) FROM sharing.grants WHERE resource_type = 'calendar';
--   -- Should match the original calendar_members count
--
-- SELECT COUNT(*) FROM sharing.grants WHERE resource_type = 'document';
--   -- Should match the original document_permissions count
-- ═══════════════════════════════════════════════════════════════
