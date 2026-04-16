//! Configuration handlers.

use axum::{extract::State, Json};
use signapps_common::Result;
use signapps_db::repositories::RouteRepository;

use crate::AppState;

/// Get current proxy configuration summary.
#[utoipa::path(
    get,
    path = "/api/v1/config/proxy",
    responses(
        (status = 200, description = "Proxy configuration summary"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Proxy"
)]
#[tracing::instrument(skip_all)]
pub async fn get_proxy_config(State(state): State<AppState>) -> Result<Json<serde_json::Value>> {
    let repo = RouteRepository::new(&state.pool);
    let routes = repo.list_enabled().await?;

    let certs_loaded = state
        .tls_resolver
        .as_ref()
        .map(|r| r.cert_count())
        .unwrap_or(0);

    Ok(Json(serde_json::json!({
        "routes_count": routes.len(),
        "cached_routes": state.route_cache.route_count(),
        "certificates_loaded": certs_loaded,
    })))
}

/// Get proxy overview stats.
#[utoipa::path(
    get,
    path = "/api/v1/config/proxy/overview",
    responses(
        (status = 200, description = "Proxy overview statistics"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Proxy"
)]
#[tracing::instrument(skip_all)]
pub async fn get_proxy_overview(State(state): State<AppState>) -> Result<Json<serde_json::Value>> {
    let repo = RouteRepository::new(&state.pool);
    let routes = repo.list_enabled().await?;

    let certs_loaded = state
        .tls_resolver
        .as_ref()
        .map(|r| r.cert_count())
        .unwrap_or(0);

    let requests_total = state
        .route_cache
        .requests_total
        .load(std::sync::atomic::Ordering::Relaxed);

    Ok(Json(serde_json::json!({
        "routes_count": routes.len(),
        "cached_routes": state.route_cache.route_count(),
        "certificates_loaded": certs_loaded,
        "requests_total": requests_total,
    })))
}

/// Force route cache refresh.
#[utoipa::path(
    post,
    path = "/api/v1/admin/config/refresh",
    responses(
        (status = 200, description = "Cache refreshed successfully"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Proxy"
)]
#[tracing::instrument(skip_all)]
pub async fn refresh_config(State(state): State<AppState>) -> Result<Json<serde_json::Value>> {
    state.route_cache.force_refresh();

    Ok(Json(serde_json::json!({
        "status": "refreshed",
        "cached_routes": state.route_cache.route_count(),
    })))
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
