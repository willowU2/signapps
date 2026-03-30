//! Health check handler.

use axum::{extract::State, Json};
use serde::Serialize;

use crate::AppState;

#[derive(Serialize)]
/// Response for Health.
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub version: String,
    pub storage_connected: bool,
}

/// Health check endpoint.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/health",
    responses((status = 200, description = "Success")),
    tag = "Storage"
)]
pub async fn health_check(State(state): State<AppState>) -> Json<HealthResponse> {
    let storage_connected = state.storage.list_buckets().await.is_ok();

    Json(HealthResponse {
        status: if storage_connected {
            "healthy"
        } else {
            "degraded"
        }
        .to_string(),
        service: "signapps-storage".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        storage_connected,
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
