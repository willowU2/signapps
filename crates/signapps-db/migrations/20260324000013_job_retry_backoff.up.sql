-- Add retry tracking columns to scheduler.jobs
ALTER TABLE scheduler.jobs ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scheduler.jobs ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

-- Index for efficient retry scheduling: find jobs due for retry
CREATE INDEX IF NOT EXISTS idx_jobs_next_retry ON scheduler.jobs (next_retry_at)
    WHERE next_retry_at IS NOT NULL AND enabled = true;

-- Extend job_runs status to include failed_permanent
-- (status column is VARCHAR(32) so no constraint change needed)
