-- SignApps Platform - Performance Indexes Migration
-- Version: 276
-- Date: 2026-04-14
-- Purpose: Add missing performance indexes to critical tables.

DO $$
BEGIN
    -- 1. Documents (tenant_id, updated_at)
    -- Check if tenant_id exists in documents (just in case)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'tenant_id') THEN
        -- Since we're inside a DO block we can't use CONCURRENTLY, so we use IF NOT EXISTS.
        IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_documents_tenant_updated_at') THEN
            CREATE INDEX idx_documents_tenant_updated_at ON documents(tenant_id, updated_at DESC);
        END IF;
    END IF;

    -- 2. Workforce (workforce_employees tenant_id, org_node_id (team_id))
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workforce_employees') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_workforce_employees_tenant_org') THEN
            CREATE INDEX idx_workforce_employees_tenant_org ON workforce_employees(tenant_id, org_node_id);
        END IF;
    END IF;

END $$;

-- 3. Calendar Events (tenant_id, start_time)
-- We use a regular CREATE INDEX IF NOT EXISTS outside the DO block
CREATE INDEX IF NOT EXISTS idx_calendar_events_tenant_start_time ON calendar.events(tenant_id, start_time DESC);
