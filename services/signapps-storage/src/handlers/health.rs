//! Health check handler.

use axum::{extract::State, Json};
use serde::Serialize;

use crate::AppState;

#[derive(Serialize, utoipa::ToSchema)]
/// Response for Health.
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub version: String,
    pub storage_connected: bool,
    /// Frontend app metadata for dynamic discovery.
    pub app: serde_json::Value,
}

/// Health check endpoint.
#[utoipa::path(
    get,
    path = "/health",
    responses(
        (status = 200, description = "Service health status", body = HealthResponse),
    ),
    tag = "health"
)]
#[tracing::instrument(skip_all)]
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
        app: serde_json::json!({
            "id": "drive",
            "label": "Drive",
            "description": "Stockage et partage de fichiers",
            "icon": "HardDrive",
            "category": "Infrastructure",
            "color": "text-slate-500",
            "href": "/storage",
            "port": 3004
        }),
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
        let _ = module_path!();
    }
}
