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

/// Get job status
pub async fn get_job_status(
    State(_state): State<Arc<AppState>>,
    Path(job_id): Path<String>,
) -> Result<Json<JobStatus>, (StatusCode, String)> {
    // Parse job ID
    let _id = Uuid::parse_str(&job_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid job ID".to_string()))?;

    // NOTE: Job status requires persistent job queue (Redis or DB)
    // For now, return a mock response

    Ok(Json(JobStatus {
        id: job_id,
        status: "pending".to_string(),
        progress: 0.0,
        total_items: 0,
        completed_items: 0,
        failed_items: 0,
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
        result: None,
        error: None,
    }))
}
