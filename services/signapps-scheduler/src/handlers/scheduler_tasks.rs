//! Scheduler task handlers -- CRUD for scheduled tasks with execution history.
//!
//! These endpoints expose the scheduler's internal job management as a
//! user-facing "scheduled tasks" API under `/api/v1/scheduler/tasks`.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;
use signapps_common::Result;
use signapps_db::models::{CreateJob, Job, JobRun, JobStats};

// ============================================================================
// Response types
// ============================================================================

/// Scheduled task response (wraps Job).
#[derive(Debug, Serialize)]
pub struct SchedulerTaskResponse {
    /// Task details (same as Job).
    #[serde(flatten)]
    pub job: Job,
}

/// Execution stats summary.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct ExecutionStatsResponse {
    /// Total number of scheduled tasks.
    pub total: i64,
    /// Number of active (enabled) tasks.
    pub active: i64,
    /// Number of tasks that succeeded in last run.
    pub succeeded: i64,
    /// Number of tasks currently running.
    pub running: usize,
}

/// Query parameters for listing executions.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ExecutionsQuery {
    /// Maximum number of executions to return (default 50).
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    50
}

// ============================================================================
// Handlers
// ============================================================================

/// List all scheduled tasks.
///
/// Returns the full list of scheduler jobs, each representing a scheduled task.
///
/// # Errors
///
/// Returns `Error::Database` if the query fails.
#[utoipa::path(
    get,
    path = "/api/v1/scheduler/tasks",
    responses(
        (status = 200, description = "List of scheduled tasks"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Scheduler"
)]
#[tracing::instrument(skip_all)]
pub async fn list_scheduler_tasks(
    State(state): State<AppState>,
) -> Result<Json<Vec<SchedulerTaskResponse>>> {
    let jobs = state.scheduler.list_jobs().await?;
    let tasks: Vec<SchedulerTaskResponse> = jobs
        .into_iter()
        .map(|job| SchedulerTaskResponse { job })
        .collect();
    Ok(Json(tasks))
}

/// Create a new scheduled task.
///
/// # Errors
///
/// Returns `Error::Validation` if the cron expression is invalid.
/// Returns `Error::Database` on constraint violations.
// Note: utoipa::path omitted because CreateJob lacks ToSchema.
#[tracing::instrument(skip_all)]
pub async fn create_scheduler_task(
    State(state): State<AppState>,
    Json(request): Json<CreateJob>,
) -> Result<(StatusCode, Json<SchedulerTaskResponse>)> {
    let job = state.scheduler.create_job(&request).await?;
    tracing::info!(job_id = %job.id, name = %job.name, "Created scheduled task");
    Ok((StatusCode::CREATED, Json(SchedulerTaskResponse { job })))
}

/// Get execution history for a scheduled task.
///
/// Returns the list of past and current executions (runs) for the given task,
/// ordered by most recent first.
///
/// # Errors
///
/// Returns `Error::NotFound` if the task does not exist.
/// Returns `Error::Database` if the query fails.
#[utoipa::path(
    get,
    path = "/api/v1/scheduler/tasks/{id}/executions",
    params(
        ("id" = Uuid, Path, description = "Task/Job ID"),
        ExecutionsQuery,
    ),
    responses(
        (status = 200, description = "Execution history"),
        (status = 404, description = "Task not found"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Scheduler"
)]
#[tracing::instrument(skip_all, fields(task_id = %id))]
pub async fn list_task_executions(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<ExecutionsQuery>,
) -> Result<Json<Vec<JobRun>>> {
    // Verify job/task exists
    let _job = state
        .scheduler
        .get_job(id)
        .await?
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Scheduler task {}", id)))?;

    let runs = state.scheduler.get_job_runs(id, query.limit).await?;
    Ok(Json(runs))
}

/// Get execution stats (total, active, succeeded, running).
///
/// # Errors
///
/// Returns `Error::Database` if the query fails.
#[utoipa::path(
    get,
    path = "/api/v1/scheduler/tasks/stats",
    responses(
        (status = 200, description = "Execution statistics", body = ExecutionStatsResponse),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Scheduler"
)]
#[tracing::instrument(skip_all)]
pub async fn get_execution_stats(
    State(state): State<AppState>,
) -> Result<Json<ExecutionStatsResponse>> {
    let stats: JobStats = state.scheduler.get_stats().await?;
    let running = state.scheduler.get_running_jobs().await;

    Ok(Json(ExecutionStatsResponse {
        total: stats.total_jobs,
        active: stats.enabled_jobs,
        succeeded: stats.successful_runs,
        running: running.len(),
    }))
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
