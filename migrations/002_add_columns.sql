-- Sprint 3: Add missing columns for scheduler jobs and proxy routes

-- Scheduler: add description and updated_at columns
ALTER TABLE scheduler.jobs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE scheduler.jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Proxy: add dns_records and tls_config JSONB columns
ALTER TABLE proxy.routes ADD COLUMN IF NOT EXISTS dns_records JSONB;
ALTER TABLE proxy.routes ADD COLUMN IF NOT EXISTS tls_config JSONB;
