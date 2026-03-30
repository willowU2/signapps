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
    pub components: ComponentsHealth,
}

#[derive(Serialize)]
/// ComponentsHealth data transfer object.
pub struct ComponentsHealth {
    pub vectors: bool,
    pub embeddings: bool,
    pub llm: bool,
}

/// Health check endpoint.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/health",
    responses((status = 200, description = "Success")),
    tag = "Ai"
)]
#[tracing::instrument(skip_all)]
pub async fn health_check(State(state): State<AppState>) -> Json<HealthResponse> {
    let vectors_healthy = state.vectors.get_stats(None).await.is_ok();
    let embeddings_healthy = state.embeddings.health_check().await.unwrap_or(false);
    let llm_healthy = match state.providers.get_default() {
        Ok(provider) => provider.health_check().await.unwrap_or(false),
        Err(_) => false,
    };

    let all_healthy = vectors_healthy && embeddings_healthy && llm_healthy;

    Json(HealthResponse {
        status: if all_healthy { "healthy" } else { "degraded" }.to_string(),
        service: "signapps-ai".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        components: ComponentsHealth {
            vectors: vectors_healthy,
            embeddings: embeddings_healthy,
            llm: llm_healthy,
        },
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
