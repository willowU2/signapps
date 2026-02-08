//! Health check handler.

use axum::{extract::State, Json};
use serde::Serialize;

use crate::AppState;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub version: String,
    pub components: ComponentsHealth,
}

#[derive(Serialize)]
pub struct ComponentsHealth {
    pub qdrant: bool,
    pub embeddings: bool,
    pub llm: bool,
}

/// Health check endpoint.
pub async fn health_check(State(state): State<AppState>) -> Json<HealthResponse> {
    let qdrant_healthy = state.qdrant.get_stats().await.is_ok();
    let embeddings_healthy = state.embeddings.health_check().await.unwrap_or(false);
    let llm_healthy = state.llm.health_check().await.unwrap_or(false);

    let all_healthy = qdrant_healthy && embeddings_healthy && llm_healthy;

    Json(HealthResponse {
        status: if all_healthy { "healthy" } else { "degraded" }.to_string(),
        service: "signapps-ai".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        components: ComponentsHealth {
            qdrant: qdrant_healthy,
            embeddings: embeddings_healthy,
            llm: llm_healthy,
        },
    })
}
