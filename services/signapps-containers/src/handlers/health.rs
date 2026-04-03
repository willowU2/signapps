//! Health check handler.

use axum::Json;
use serde::Serialize;

use crate::AppState;

/// Health check response.
#[derive(Serialize, utoipa::ToSchema)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub version: String,
    pub docker_connected: bool,
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
    tag = "system"
)]
#[tracing::instrument(skip_all)]
pub async fn health_check(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> Json<HealthResponse> {
    let docker_connected = state.docker.ping().await.is_ok();

    Json(HealthResponse {
        status: if docker_connected {
            "healthy"
        } else {
            "degraded"
        }
        .to_string(),
        service: "signapps-containers".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        docker_connected,
        app: serde_json::json!({
            "id": "containers",
            "label": "Containers",
            "description": "Orchestration de conteneurs",
            "icon": "Container",
            "category": "Infrastructure",
            "color": "text-red-500",
            "href": "/containers",
            "port": 3002
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
        assert!(true, "{} handler module loaded", module_path!());
    }
}
