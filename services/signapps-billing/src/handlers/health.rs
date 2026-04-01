//! Health check handler.

use axum::{response::IntoResponse, Json};

/// Return a simple JSON health status.
pub async fn health() -> impl IntoResponse {
    Json(serde_json::json!({ "status": "ok" }))
}
