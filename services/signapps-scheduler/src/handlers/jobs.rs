//! Job management handlers.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::scheduler::service::RunningJob;
use crate::AppState;
use signapps_common::Result;
use signapps_db::models::{CreateJob, Job, JobRun, JobStats, UpdateJob};

/// List all jobs.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/jobs",
    responses((status = 200, description = "Success")),
    tag = "Scheduler"
)]
pub async fn list_jobs(State(state): State<AppState>) -> Result<Json<Vec<Job>>> {
    let jobs = state.scheduler.list_jobs().await?;
    Ok(Json(jobs))
}

/// Get a job by ID.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/jobs/{id}",
    responses((status = 200, description = "Success")),
    tag = "Scheduler"
)]
pub async fn get_job(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<Job>> {
    let job = state
        .scheduler
        .get_job(id)
        .await?
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Job {}", id)))?;
    Ok(Json(job))
}

/// Create a new job.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/jobs",
    responses((status = 201, description = "Success")),
    tag = "Scheduler"
)]
pub async fn create_job(
    State(state): State<AppState>,
    Json(request): Json<CreateJob>,
) -> Result<(StatusCode, Json<Job>)> {
    let job = state.scheduler.create_job(&request).await?;
    Ok((StatusCode::CREATED, Json(job)))
}

/// Update a job.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    put,
    path = "/api/v1/jobs",
    responses((status = 200, description = "Success")),
    tag = "Scheduler"
)]
pub async fn update_job(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateJob>,
) -> Result<Json<Job>> {
    let job = state.scheduler.update_job(id, &request).await?;
    Ok(Json(job))
}

/// Delete a job.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    delete,
    path = "/api/v1/jobs/{id}",
    responses((status = 204, description = "Success")),
    tag = "Scheduler"
)]
pub async fn delete_job(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<StatusCode> {
    state.scheduler.delete_job(id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Enable a job.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    put,
    path = "/api/v1/jobs/{id}",
    responses((status = 200, description = "Success")),
    tag = "Scheduler"
)]
pub async fn enable_job(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<Job>> {
    let job = state.scheduler.enable_job(id).await?;
    Ok(Json(job))
}

/// Disable a job.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    put,
    path = "/api/v1/jobs/{id}",
    responses((status = 200, description = "Success")),
    tag = "Scheduler"
)]
pub async fn disable_job(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<Job>> {
    let job = state.scheduler.disable_job(id).await?;
    Ok(Json(job))
}

/// Run a job immediately.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/jobs",
    responses((status = 201, description = "Success")),
    tag = "Scheduler"
)]
pub async fn run_job(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<RunJobResponse>> {
    let result = state.scheduler.run_job_by_id(id).await?;
    Ok(Json(RunJobResponse {
        status: result.status.to_string(),
        output: result.output,
        error: result.error,
        duration_ms: result.duration_ms,
    }))
}

/// Run job response.
#[derive(Debug, Serialize)]
/// Response for RunJob.
pub struct RunJobResponse {
    pub status: String,
    pub output: Option<String>,
    pub error: Option<String>,
    pub duration_ms: u64,
}

/// Query params for job runs.
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct JobRunsQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    50
}

/// Get job runs.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/jobs",
    responses((status = 200, description = "Success")),
    tag = "Scheduler"
)]
pub async fn get_job_runs(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<JobRunsQuery>,
) -> Result<Json<Vec<JobRun>>> {
    let runs = state.scheduler.get_job_runs(id, query.limit).await?;
    Ok(Json(runs))
}

/// Get a specific run.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/jobs",
    responses((status = 200, description = "Success")),
    tag = "Scheduler"
)]
pub async fn get_run(
    State(state): State<AppState>,
    Path(run_id): Path<Uuid>,
) -> Result<Json<JobRun>> {
    let run = state
        .scheduler
        .get_run(run_id)
        .await?
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Run {}", run_id)))?;
    Ok(Json(run))
}

/// Get scheduler statistics.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/jobs",
    responses((status = 200, description = "Success")),
    tag = "Scheduler"
)]
pub async fn get_stats(State(state): State<AppState>) -> Result<Json<JobStats>> {
    let stats = state.scheduler.get_stats().await?;
    Ok(Json(stats))
}

/// Get currently running jobs.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/jobs",
    responses((status = 200, description = "Success")),
    tag = "Scheduler"
)]
pub async fn get_running(State(state): State<AppState>) -> Result<Json<Vec<RunningJob>>> {
    let running = state.scheduler.get_running_jobs().await;
    Ok(Json(running))
}

/// Cleanup old job runs.
#[derive(Debug, Deserialize)]
/// Request body for Cleanup.
pub struct CleanupRequest {
    #[serde(default = "default_days")]
    pub days: i32,
}

fn default_days() -> i32 {
    30
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/jobs",
    responses((status = 200, description = "Success")),
    tag = "Scheduler"
)]
pub async fn cleanup_runs(
    State(state): State<AppState>,
    Json(request): Json<CleanupRequest>,
) -> Result<Json<CleanupResponse>> {
    let deleted = state.scheduler.cleanup_old_runs(request.days).await?;
    Ok(Json(CleanupResponse {
        deleted_runs: deleted,
    }))
}

/// Cleanup response.
#[derive(Debug, Serialize)]
/// Response for Cleanup.
pub struct CleanupResponse {
    pub deleted_runs: i64,
}

/// Health check.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/jobs",
    responses((status = 200, description = "Success")),
    tag = "Scheduler"
)]
pub async fn health_check(State(state): State<AppState>) -> Result<Json<HealthResponse>> {
    let stats = state.scheduler.get_stats().await?;
    let running = state.scheduler.get_running_jobs().await;

    Ok(Json(HealthResponse {
        status: "healthy".to_string(),
        total_jobs: stats.total_jobs,
        enabled_jobs: stats.enabled_jobs,
        running_jobs: running.len() as i64,
    }))
}

/// Health response.
#[derive(Debug, Serialize)]
/// Response for Health.
pub struct HealthResponse {
    pub status: String,
    pub total_jobs: i64,
    pub enabled_jobs: i64,
    pub running_jobs: i64,
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
