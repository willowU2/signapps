-- Drop retry index and columns
DROP INDEX IF EXISTS scheduler.idx_jobs_next_retry;
ALTER TABLE scheduler.jobs DROP COLUMN IF EXISTS next_retry_at;
ALTER TABLE scheduler.jobs DROP COLUMN IF EXISTS retry_count;
