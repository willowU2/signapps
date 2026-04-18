-- migrations/226_ad_sync_queue.sql
-- Event queue for org→AD synchronization

CREATE TABLE IF NOT EXISTS ad_sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    target_site_id UUID,
    target_dc_id UUID,
    priority INT DEFAULT 5,
    status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retry', 'dead')),
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 5,
    next_retry_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON ad_sync_queue(status, priority, next_retry_at)
    WHERE status IN ('pending', 'retry');
CREATE INDEX IF NOT EXISTS idx_sync_queue_domain ON ad_sync_queue(domain_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON ad_sync_queue(created_at DESC);

-- Notification function for real-time wakeup
CREATE OR REPLACE FUNCTION ad_sync_notify() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('ad_sync_events', NEW.id::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ad_sync_notify
    AFTER INSERT ON ad_sync_queue
    FOR EACH ROW
    EXECUTE FUNCTION ad_sync_notify();
