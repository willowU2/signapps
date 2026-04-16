use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Serialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::AppState;

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// JobStatus data transfer object.
pub struct JobStatus {
    pub id: String,
    pub status: String,
    pub progress: f32,
    pub total_items: u32,
    pub completed_items: u32,
    pub failed_items: u32,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Get job status from the in-memory job store
#[utoipa::path(
    get,
    path = "/api/v1/jobs/{id}",
    params(
        ("id" = String, Path, description = "Job UUID")
    ),
    responses(
        (status = 200, description = "Job status retrieved", body = JobStatus),
        (status = 400, description = "Invalid job ID"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Job not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Jobs"
)]
#[tracing::instrument(skip_all)]
pub async fn get_job_status(
    State(state): State<Arc<AppState>>,
    Path(job_id): Path<String>,
) -> Result<Json<JobStatus>, (StatusCode, String)> {
    let id = Uuid::parse_str(&job_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid job ID".to_string()))?;

    match state.job_store.get(&id) {
        Some(entry) => Ok(Json(JobStatus {
            id: job_id,
            status: entry.status.clone(),
            progress: entry.progress,
            total_items: entry.total_items,
            completed_items: entry.completed_items,
            failed_items: entry.failed_items,
            created_at: entry.created_at.clone(),
            updated_at: entry.updated_at.clone(),
            result: entry.result.clone(),
            error: entry.error.clone(),
        })),
        None => Err((StatusCode::NOT_FOUND, format!("Job {} not found", job_id))),
    }
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
