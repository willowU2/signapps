DROP TRIGGER IF EXISTS audit_immutable ON platform.audit_log;
DROP FUNCTION IF EXISTS platform.prevent_audit_mutation();
DROP TABLE IF EXISTS platform.audit_log;
