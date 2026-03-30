//! Health check handler.

#![allow(dead_code)]

use axum::Json;
use serde::Serialize;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub version: String,
}

/// Health check endpoint.
#[tracing::instrument(skip_all)]
pub async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        service: "signapps-office".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}
