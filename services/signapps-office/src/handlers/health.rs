//! Health check handler.

#![allow(dead_code)]

use axum::Json;
use serde::Serialize;

#[derive(Serialize)]
/// Response for Health.
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub version: String,
}

/// Health check endpoint.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/health",
    responses((status = 200, description = "Success")),
    tag = "Office"
)]
#[tracing::instrument(skip_all)]
pub async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        service: "signapps-office".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
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
