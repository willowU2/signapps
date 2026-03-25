//! Scheduler service for managing and running jobs.

use crate::scheduler::executor::{ExecutionResult, JobExecutor};
use signapps_common::{Error, Result};
use signapps_db::models::{CreateJob, Job, JobRun, JobRunStatus, JobStats, UpdateJob};
use signapps_db::repositories::JobRepository;
use signapps_db::DatabasePool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{interval, Duration};
use uuid::Uuid;

/// Scheduler service for job management.
#[derive(Clone)]
pub struct SchedulerService {
    pool: DatabasePool,
    executor: JobExecutor,
    running_jobs: Arc<RwLock<HashMap<Uuid, RunningJob>>>,
}

/// Information about a running job.
#[derive(Debug, Clone, serde::Serialize)]
pub struct RunningJob {
    pub job_id: Uuid,
    pub run_id: Uuid,
    pub started_at: chrono::DateTime<chrono::Utc>,
}

impl SchedulerService {
    /// Create a new scheduler service.
    pub fn new(pool: DatabasePool, timeout_seconds: u64) -> Self {
        Self {
            pool,
            executor: JobExecutor::new(timeout_seconds),
            running_jobs: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Start the background scheduler loop.
    pub async fn start_scheduler(self: Arc<Self>) {
        let mut check_interval = interval(Duration::from_secs(60));
        const MAX_CONCURRENT_JOBS: usize = 10; // Guard against cascade execution

        loop {
            check_interval.tick().await;

            // Check if we're at capacity before attempting to check/run jobs
            let running_count = self.running_jobs.read().await.len();
            if running_count >= MAX_CONCURRENT_JOBS {
                tracing::warn!(
                    "Skipping job check: {} jobs already running (max: {})",
                    running_count,
                    MAX_CONCURRENT_JOBS
                );
                continue; // Skip this cycle to prevent cascade
            }

            if let Err(e) = self.check_and_run_jobs().await {
                tracing::error!("Error checking jobs: {}", e);
            }
        }
    }

    /// Check all enabled jobs and run those that are due (including retry-eligible jobs).
    async fn check_and_run_jobs(&self) -> Result<()> {
        let repo = JobRepository::new(&self.pool);
        // list_due() returns enabled jobs with next_retry_at IS NULL OR next_retry_at <= NOW()
        let jobs = repo.list_due().await?;

        for job in jobs {
            if self.should_run(&job) {
                let service = self.clone();
                let job_clone = job.clone();

                tokio::spawn(async move {
                    if let Err(e) = service.run_job(&job_clone).await {
                        tracing::error!("Error running job {}: {}", job_clone.name, e);
                    }
                });
            }
        }

        Ok(())
    }

    /// Check if a job should run based on its cron expression.
    fn should_run(&self, job: &Job) -> bool {
        // Simple check: if last_run is None or older than the cron interval
        // In production, use a proper cron parser library
        if let Some(last_run) = job.last_run {
            let elapsed = chrono::Utc::now() - last_run;
            // For now, use a simple interval check based on cron expression
            // This is a simplified implementation
            if let Some(minutes) = parse_simple_interval(&job.cron_expression) {
                elapsed.num_minutes() >= minutes
            } else {
                false
            }
        } else {
            true
        }
    }

    /// Run a job immediately, applying exponential-backoff retry on failure.
    pub async fn run_job(&self, job: &Job) -> Result<ExecutionResult> {
        let repo = JobRepository::new(&self.pool);

        // Create a run record
        let run = repo.create_run(job.id).await?;

        // Track running job
        {
            let mut running = self.running_jobs.write().await;
            running.insert(
                job.id,
                RunningJob {
                    job_id: job.id,
                    run_id: run.id,
                    started_at: chrono::Utc::now(),
                },
            );
        }

        let retry_attempt = job.retry_count;
        if retry_attempt > 0 {
            tracing::info!(
                "Starting job '{}' (run {}) — retry attempt {}/{}",
                job.name,
                run.id,
                retry_attempt,
                MAX_JOB_RETRIES
            );
        } else {
            tracing::info!("Starting job '{}' (run {})", job.name, run.id);
        }

        // Execute the job
        let result = self.executor.execute(job).await;

        let is_failure = matches!(result.status, JobRunStatus::Failed | JobRunStatus::Timeout);

        // Update run record with actual status (or failed_permanent on last attempt)
        let run_status = if is_failure && retry_attempt >= MAX_JOB_RETRIES as i32 {
            JobRunStatus::FailedPermanent
        } else {
            result.status
        };

        repo.complete_run(
            run.id,
            run_status,
            result.output.as_deref(),
            result.error.as_deref(),
        )
        .await?;

        // Handle retry state
        if is_failure {
            if retry_attempt >= MAX_JOB_RETRIES as i32 {
                // Exceeded max retries — disable the job permanently
                tracing::error!(
                    "Job '{}' has failed {} times (max retries exceeded). Marking as failed_permanent.",
                    job.name,
                    retry_attempt + 1
                );
                repo.mark_failed_permanent(job.id).await?;
            } else {
                // Schedule next retry with exponential backoff (base 30s, max 1h)
                let backoff_secs = compute_backoff_secs(retry_attempt);
                let next_retry_at =
                    chrono::Utc::now() + chrono::Duration::seconds(backoff_secs as i64);

                tracing::warn!(
                    "Job '{}' failed (attempt {}/{}). Scheduling retry in {}s at {}",
                    job.name,
                    retry_attempt + 1,
                    MAX_JOB_RETRIES,
                    backoff_secs,
                    next_retry_at.format("%H:%M:%S UTC")
                );

                repo.schedule_retry(job.id, next_retry_at, &result.status.to_string())
                    .await?;
            }
        } else {
            // Success — reset retry state and update last_run normally
            repo.reset_retry(job.id).await?;
            repo.update_last_run(job.id, &result.status.to_string())
                .await?;
        }

        // Remove from running jobs
        {
            let mut running = self.running_jobs.write().await;
            running.remove(&job.id);
        }

        tracing::info!(
            "Job '{}' completed with status: {:?} ({}ms)",
            job.name,
            result.status,
            result.duration_ms
        );

        Ok(result)
    }

    /// Run a job by ID.
    pub async fn run_job_by_id(&self, job_id: Uuid) -> Result<ExecutionResult> {
        let repo = JobRepository::new(&self.pool);
        let job = repo
            .find(job_id)
            .await?
            .ok_or_else(|| Error::NotFound(format!("Job {}", job_id)))?;

        self.run_job(&job).await
    }

    /// Get a job by ID.
    pub async fn get_job(&self, id: Uuid) -> Result<Option<Job>> {
        let repo = JobRepository::new(&self.pool);
        repo.find(id).await
    }

    /// List all jobs.
    pub async fn list_jobs(&self) -> Result<Vec<Job>> {
        let repo = JobRepository::new(&self.pool);
        repo.list().await
    }

    /// Create a new job.
    pub async fn create_job(&self, create: &CreateJob) -> Result<Job> {
        // Validate cron expression
        if !is_valid_cron(&create.cron_expression) {
            return Err(Error::Validation("Invalid cron expression".to_string()));
        }

        let repo = JobRepository::new(&self.pool);
        repo.create(create).await
    }

    /// Update a job.
    pub async fn update_job(&self, id: Uuid, update: &UpdateJob) -> Result<Job> {
        // Validate cron expression if provided
        if let Some(ref cron) = update.cron_expression {
            if !is_valid_cron(cron) {
                return Err(Error::Validation("Invalid cron expression".to_string()));
            }
        }

        let repo = JobRepository::new(&self.pool);
        repo.update(id, update).await
    }

    /// Delete a job.
    pub async fn delete_job(&self, id: Uuid) -> Result<()> {
        let repo = JobRepository::new(&self.pool);
        repo.delete(id).await
    }

    /// Enable a job.
    pub async fn enable_job(&self, id: Uuid) -> Result<Job> {
        let repo = JobRepository::new(&self.pool);
        repo.enable(id).await
    }

    /// Disable a job.
    pub async fn disable_job(&self, id: Uuid) -> Result<Job> {
        let repo = JobRepository::new(&self.pool);
        repo.disable(id).await
    }

    /// Get job runs.
    pub async fn get_job_runs(&self, job_id: Uuid, limit: i64) -> Result<Vec<JobRun>> {
        let repo = JobRepository::new(&self.pool);
        repo.list_runs(job_id, limit).await
    }

    /// Get a specific run.
    pub async fn get_run(&self, run_id: Uuid) -> Result<Option<JobRun>> {
        let repo = JobRepository::new(&self.pool);
        repo.get_run(run_id).await
    }

    /// Get job statistics.
    pub async fn get_stats(&self) -> Result<JobStats> {
        let repo = JobRepository::new(&self.pool);
        repo.get_stats().await
    }

    /// Get currently running jobs.
    pub async fn get_running_jobs(&self) -> Vec<RunningJob> {
        let running = self.running_jobs.read().await;
        running.values().cloned().collect()
    }

    /// Clean up old job runs.
    pub async fn cleanup_old_runs(&self, days: i32) -> Result<i64> {
        let repo = JobRepository::new(&self.pool);
        repo.cleanup_old_runs(days).await
    }
}

/// Parse a simple interval from cron-like expression.
/// Returns the interval in minutes between expected runs.
fn parse_simple_interval(cron: &str) -> Option<i64> {
    let parts: Vec<&str> = cron.split_whitespace().collect();
    if parts.len() < 5 {
        return None;
    }

    // Handle common patterns
    match (parts[0], parts[1], parts[2], parts[3], parts[4]) {
        // Every N minutes: */N * * * *
        (min, "*", "*", "*", "*") if min.starts_with("*/") => min[2..].parse::<i64>().ok(),
        // Every N hours: 0 */N * * *
        ("0", hour, "*", "*", "*") if hour.starts_with("*/") => {
            hour[2..].parse::<i64>().ok().map(|h| h * 60)
        },
        // Every minute: * * * * *
        ("*", "*", "*", "*", "*") => Some(1),
        // Every hour: 0 * * * *
        ("0", "*", "*", "*", "*") => Some(60),
        // Every day at specific time: M H * * *
        (_, _, "*", "*", "*") => Some(60 * 24),
        // Every week: M H * * D
        (_, _, "*", "*", _) => Some(60 * 24 * 7),
        // Default: 1 hour
        _ => Some(60),
    }
}

/// Validate a cron expression (simplified).
fn is_valid_cron(cron: &str) -> bool {
    let parts: Vec<&str> = cron.split_whitespace().collect();
    parts.len() == 5 || parts.len() == 6
}

// ---------------------------------------------------------------------------
// Retry / backoff constants and helpers
// ---------------------------------------------------------------------------

/// Maximum number of retry attempts before a job is marked `failed_permanent`.
const MAX_JOB_RETRIES: usize = 5;

/// Base delay in seconds for exponential backoff (30 seconds).
const RETRY_BASE_DELAY_SECS: u64 = 30;

/// Maximum backoff delay: 1 hour.
const RETRY_MAX_DELAY_SECS: u64 = 3_600;

/// Compute the next retry delay using `base_delay * 2^retry_count`, capped at 1 hour.
///
/// | retry_count | delay        |
/// |-------------|--------------|
/// | 0           | 30 s         |
/// | 1           | 60 s         |
/// | 2           | 2 min        |
/// | 3           | 4 min        |
/// | 4           | 8 min        |
fn compute_backoff_secs(retry_count: i32) -> u64 {
    let exponent = retry_count.max(0) as u32;
    // Use saturating_pow to avoid overflow on absurd retry counts.
    let delay = RETRY_BASE_DELAY_SECS.saturating_mul(2_u64.saturating_pow(exponent));
    delay.min(RETRY_MAX_DELAY_SECS)
}
