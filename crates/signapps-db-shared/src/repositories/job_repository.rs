//! Job repository for scheduler service.

use crate::models::{CreateJob, Job, JobRun, JobRunStatus, JobStats, UpdateJob};
use crate::pool::DatabasePool;
use signapps_common::Result;
use uuid::Uuid;

/// Repository for job operations.
pub struct JobRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> JobRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Find job by ID.
    pub async fn find(&self, id: Uuid) -> Result<Option<Job>> {
        let job = sqlx::query_as::<_, Job>("SELECT * FROM scheduler.jobs WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool.inner())
            .await?;

        Ok(job)
    }

    /// Find job by name.
    pub async fn find_by_name(&self, name: &str) -> Result<Option<Job>> {
        let job = sqlx::query_as::<_, Job>("SELECT * FROM scheduler.jobs WHERE name = $1")
            .bind(name)
            .fetch_optional(self.pool.inner())
            .await?;

        Ok(job)
    }

    /// List all jobs.
    pub async fn list(&self) -> Result<Vec<Job>> {
        let jobs = sqlx::query_as::<_, Job>("SELECT * FROM scheduler.jobs ORDER BY name")
            .fetch_all(self.pool.inner())
            .await?;

        Ok(jobs)
    }

    /// List enabled jobs.
    pub async fn list_enabled(&self) -> Result<Vec<Job>> {
        let jobs = sqlx::query_as::<_, Job>(
            "SELECT * FROM scheduler.jobs WHERE enabled = true ORDER BY name",
        )
        .fetch_all(self.pool.inner())
        .await?;

        Ok(jobs)
    }

    /// Create a new job.
    pub async fn create(&self, job: &CreateJob) -> Result<Job> {
        let created = sqlx::query_as::<_, Job>(
            r#"
            INSERT INTO scheduler.jobs (name, description, cron_expression, command, target_type, target_id, enabled)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            "#
        )
        .bind(&job.name)
        .bind(&job.description)
        .bind(&job.cron_expression)
        .bind(&job.command)
        .bind(job.target_type.to_string())
        .bind(&job.target_id)
        .bind(job.enabled)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(created)
    }

    /// Update a job.
    pub async fn update(&self, id: Uuid, update: &UpdateJob) -> Result<Job> {
        let mut sets = Vec::new();
        let mut param_count = 1;

        if update.name.is_some() {
            param_count += 1;
            sets.push(format!("name = ${}", param_count));
        }
        if update.description.is_some() {
            param_count += 1;
            sets.push(format!("description = ${}", param_count));
        }
        if update.cron_expression.is_some() {
            param_count += 1;
            sets.push(format!("cron_expression = ${}", param_count));
        }
        if update.command.is_some() {
            param_count += 1;
            sets.push(format!("command = ${}", param_count));
        }
        if update.target_type.is_some() {
            param_count += 1;
            sets.push(format!("target_type = ${}", param_count));
        }
        if update.target_id.is_some() {
            param_count += 1;
            sets.push(format!("target_id = ${}", param_count));
        }
        if update.enabled.is_some() {
            param_count += 1;
            sets.push(format!("enabled = ${}", param_count));
        }

        sets.push("updated_at = NOW()".to_string());

        if sets.len() == 1 {
            return self
                .find(id)
                .await?
                .ok_or_else(|| signapps_common::Error::NotFound(format!("Job {}", id)));
        }

        let query = format!(
            "UPDATE scheduler.jobs SET {} WHERE id = $1 RETURNING *",
            sets.join(", ")
        );

        let mut q = sqlx::query_as::<_, Job>(&query).bind(id);

        if let Some(ref name) = update.name {
            q = q.bind(name);
        }
        if let Some(ref description) = update.description {
            q = q.bind(description);
        }
        if let Some(ref cron_expression) = update.cron_expression {
            q = q.bind(cron_expression);
        }
        if let Some(ref command) = update.command {
            q = q.bind(command);
        }
        if let Some(ref target_type) = update.target_type {
            q = q.bind(target_type.to_string());
        }
        if let Some(ref target_id) = update.target_id {
            q = q.bind(target_id);
        }
        if let Some(enabled) = update.enabled {
            q = q.bind(enabled);
        }

        let updated = q.fetch_one(self.pool.inner()).await?;

        Ok(updated)
    }

    /// Delete a job.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM scheduler.jobs WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }

    /// Enable a job.
    pub async fn enable(&self, id: Uuid) -> Result<Job> {
        let job = sqlx::query_as::<_, Job>(
            "UPDATE scheduler.jobs SET enabled = true, updated_at = NOW() WHERE id = $1 RETURNING *"
        )
        .bind(id)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(job)
    }

    /// Disable a job.
    pub async fn disable(&self, id: Uuid) -> Result<Job> {
        let job = sqlx::query_as::<_, Job>(
            "UPDATE scheduler.jobs SET enabled = false, updated_at = NOW() WHERE id = $1 RETURNING *"
        )
        .bind(id)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(job)
    }

    /// Update job last run info.
    pub async fn update_last_run(&self, id: Uuid, status: &str) -> Result<()> {
        sqlx::query(
            "UPDATE scheduler.jobs SET last_run = NOW(), last_status = $2, updated_at = NOW() WHERE id = $1"
        )
        .bind(id)
        .bind(status)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }

    /// Create a job run record.
    pub async fn create_run(&self, job_id: Uuid) -> Result<JobRun> {
        let run = sqlx::query_as::<_, JobRun>(
            r#"
            INSERT INTO scheduler.job_runs (job_id, status)
            VALUES ($1, $2)
            RETURNING *
            "#,
        )
        .bind(job_id)
        .bind(JobRunStatus::Running.to_string())
        .fetch_one(self.pool.inner())
        .await?;

        Ok(run)
    }

    /// Complete a job run.
    pub async fn complete_run(
        &self,
        run_id: Uuid,
        status: JobRunStatus,
        output: Option<&str>,
        error: Option<&str>,
    ) -> Result<JobRun> {
        let run = sqlx::query_as::<_, JobRun>(
            r#"
            UPDATE scheduler.job_runs
            SET finished_at = NOW(), status = $2, output = $3, error = $4
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(run_id)
        .bind(status.to_string())
        .bind(output)
        .bind(error)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(run)
    }

    /// Get job runs for a job.
    pub async fn list_runs(&self, job_id: Uuid, limit: i64) -> Result<Vec<JobRun>> {
        let runs = sqlx::query_as::<_, JobRun>(
            "SELECT * FROM scheduler.job_runs WHERE job_id = $1 ORDER BY started_at DESC LIMIT $2",
        )
        .bind(job_id)
        .bind(limit)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(runs)
    }

    /// Get job run by ID.
    pub async fn get_run(&self, run_id: Uuid) -> Result<Option<JobRun>> {
        let run = sqlx::query_as::<_, JobRun>("SELECT * FROM scheduler.job_runs WHERE id = $1")
            .bind(run_id)
            .fetch_optional(self.pool.inner())
            .await?;

        Ok(run)
    }

    /// Get job statistics.
    pub async fn get_stats(&self) -> Result<JobStats> {
        let total_jobs: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM scheduler.jobs")
            .fetch_one(self.pool.inner())
            .await?;

        let enabled_jobs: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM scheduler.jobs WHERE enabled = true")
                .fetch_one(self.pool.inner())
                .await?;

        let total_runs: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM scheduler.job_runs")
            .fetch_one(self.pool.inner())
            .await?;

        let successful_runs: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM scheduler.job_runs WHERE status = 'success'")
                .fetch_one(self.pool.inner())
                .await?;

        let failed_runs: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM scheduler.job_runs WHERE status = 'failed'")
                .fetch_one(self.pool.inner())
                .await?;

        Ok(JobStats {
            total_jobs: total_jobs.0,
            enabled_jobs: enabled_jobs.0,
            disabled_jobs: total_jobs.0 - enabled_jobs.0,
            total_runs: total_runs.0,
            successful_runs: successful_runs.0,
            failed_runs: failed_runs.0,
        })
    }

    /// Clean up old job runs.
    pub async fn cleanup_old_runs(&self, days: i32) -> Result<i64> {
        let result = sqlx::query(
            "DELETE FROM scheduler.job_runs WHERE started_at < NOW() - INTERVAL '1 day' * $1",
        )
        .bind(days)
        .execute(self.pool.inner())
        .await?;

        Ok(result.rows_affected() as i64)
    }

    /// Increment retry_count and schedule next retry at `next_retry_at`.
    pub async fn schedule_retry(
        &self,
        id: Uuid,
        next_retry_at: chrono::DateTime<chrono::Utc>,
        status: &str,
    ) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE scheduler.jobs
            SET retry_count  = retry_count + 1,
                next_retry_at = $2,
                last_status   = $3,
                last_run      = NOW(),
                updated_at    = NOW()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(next_retry_at)
        .bind(status)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }

    /// Mark a job as permanently failed (exceeded max retries).
    /// Disables the job so it won't be picked up again.
    pub async fn mark_failed_permanent(&self, id: Uuid) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE scheduler.jobs
            SET last_status   = 'failed_permanent',
                next_retry_at = NULL,
                enabled       = false,
                last_run      = NOW(),
                updated_at    = NOW()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }

    /// Reset retry state after a successful run.
    pub async fn reset_retry(&self, id: Uuid) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE scheduler.jobs
            SET retry_count   = 0,
                next_retry_at = NULL,
                updated_at    = NOW()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }

    /// List enabled jobs that are ready to run, including those due for retry.
    pub async fn list_due(&self) -> Result<Vec<Job>> {
        let jobs = sqlx::query_as::<_, Job>(
            r#"
            SELECT * FROM scheduler.jobs
            WHERE enabled = true
              AND (next_retry_at IS NULL OR next_retry_at <= NOW())
            ORDER BY name
            "#,
        )
        .fetch_all(self.pool.inner())
        .await?;

        Ok(jobs)
    }
}
