//! Health check handler.

use axum::Json;
use serde::Serialize;

use crate::AppState;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub version: String,
    pub docker_connected: bool,
}

/// Health check endpoint.
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
    })
}
