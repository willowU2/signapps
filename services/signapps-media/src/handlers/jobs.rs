use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Serialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::AppState;

#[derive(Debug, Serialize)]
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
