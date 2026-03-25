//! Job models for scheduler service.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Scheduled job entity.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Job {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub cron_expression: String,
    pub command: String,
    pub target_type: String,
    pub target_id: Option<String>,
    pub enabled: bool,
    pub last_run: Option<DateTime<Utc>>,
    pub last_status: Option<String>,
    /// Number of consecutive failures since last success (reset on success).
    pub retry_count: i32,
    /// When the job is next eligible for a retry attempt (None = not pending retry).
    pub next_retry_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Create job request.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateJob {
    pub name: String,
    pub description: Option<String>,
    pub cron_expression: String,
    pub command: String,
    pub target_type: JobTargetType,
    pub target_id: Option<String>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

fn default_enabled() -> bool {
    true
}

/// Update job request.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateJob {
    pub name: Option<String>,
    pub description: Option<String>,
    pub cron_expression: Option<String>,
    pub command: Option<String>,
    pub target_type: Option<JobTargetType>,
    pub target_id: Option<String>,
    pub enabled: Option<bool>,
}

/// Job target type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobTargetType {
    /// Execute on host system.
    Host,
    /// Execute inside a container.
    Container,
}

impl std::fmt::Display for JobTargetType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            JobTargetType::Host => write!(f, "host"),
            JobTargetType::Container => write!(f, "container"),
        }
    }
}

impl std::str::FromStr for JobTargetType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "host" => Ok(JobTargetType::Host),
            "container" => Ok(JobTargetType::Container),
            _ => Err(format!("Invalid job target type: {}", s)),
        }
    }
}

/// Job run record.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct JobRun {
    pub id: Uuid,
    pub job_id: Uuid,
    pub started_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
    pub status: String,
    pub output: Option<String>,
    pub error: Option<String>,
}

/// Job run status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobRunStatus {
    Running,
    Success,
    Failed,
    Timeout,
    Cancelled,
    /// Job exceeded the maximum retry limit and will not be retried.
    FailedPermanent,
}

impl std::fmt::Display for JobRunStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            JobRunStatus::Running => write!(f, "running"),
            JobRunStatus::Success => write!(f, "success"),
            JobRunStatus::Failed => write!(f, "failed"),
            JobRunStatus::Timeout => write!(f, "timeout"),
            JobRunStatus::Cancelled => write!(f, "cancelled"),
            JobRunStatus::FailedPermanent => write!(f, "failed_permanent"),
        }
    }
}

/// Create job run request.
#[derive(Debug, Clone)]
pub struct CreateJobRun {
    pub job_id: Uuid,
    pub status: JobRunStatus,
}

/// Job statistics.
#[derive(Debug, Clone, Serialize)]
pub struct JobStats {
    pub total_jobs: i64,
    pub enabled_jobs: i64,
    pub disabled_jobs: i64,
    pub total_runs: i64,
    pub successful_runs: i64,
    pub failed_runs: i64,
}
