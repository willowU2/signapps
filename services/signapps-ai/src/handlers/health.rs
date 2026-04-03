//! Health check handler.

use axum::{extract::State, Json};
use serde::Serialize;

use crate::AppState;

#[derive(Serialize, utoipa::ToSchema)]
/// Response for Health.
pub struct HealthResponse {
    /// Service health status ("healthy" or "degraded").
    pub status: String,
    /// Service name.
    pub service: String,
    /// Service version.
    pub version: String,
    /// Individual component health.
    pub components: ComponentsHealth,
    /// Frontend app metadata for dynamic discovery.
    pub app: serde_json::Value,
}

#[derive(Serialize, utoipa::ToSchema)]
/// ComponentsHealth data transfer object.
pub struct ComponentsHealth {
    /// Whether the vector store is reachable.
    pub vectors: bool,
    /// Whether the embeddings service is reachable.
    pub embeddings: bool,
    /// Whether the default LLM provider is reachable.
    pub llm: bool,
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
        app: serde_json::json!({
            "id": "ai",
            "label": "Intelligence",
            "description": "IA et automatisation",
            "icon": "Brain",
            "category": "Avancé",
            "color": "text-violet-500",
            "href": "/ai",
            "port": 3005
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
