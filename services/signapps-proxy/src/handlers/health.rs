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
    pub database: bool,
    pub cache: bool,
    pub proxy: bool,
}

/// Health check endpoint.
pub async fn health_check(State(state): State<AppState>) -> Json<HealthResponse> {
    let db_healthy = state.pool.health_check().await.is_ok();
    let cache_healthy = state.shield.health_check();
    let proxy_healthy = state.route_cache.route_count() > 0 || state.tls_resolver.is_some();

    let all_healthy = db_healthy && cache_healthy;

    Json(HealthResponse {
        status: if all_healthy { "healthy" } else { "degraded" }.to_string(),
        service: "signapps-proxy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        components: ComponentsHealth {
            database: db_healthy,
            cache: cache_healthy,
            proxy: proxy_healthy,
        },
    })
}
