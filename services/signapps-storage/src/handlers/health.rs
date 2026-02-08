//! Health check handler.

use axum::{extract::State, Json};
use serde::Serialize;

use crate::AppState;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub version: String,
    pub minio_connected: bool,
}

/// Health check endpoint.
pub async fn health_check(State(state): State<AppState>) -> Json<HealthResponse> {
    let minio_connected = state.minio.list_buckets().await.is_ok();

    Json(HealthResponse {
        status: if minio_connected { "healthy" } else { "degraded" }.to_string(),
        service: "signapps-storage".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        minio_connected,
    })
}
