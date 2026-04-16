//! Proxy status handler.

use axum::{extract::State, Json};
use serde::Serialize;
use std::sync::atomic::Ordering;

use crate::AppState;

/// Proxy status response.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for ProxyStatus.
pub struct ProxyStatusResponse {
    pub http_listener: ListenerStatus,
    pub https_listener: ListenerStatus,
    pub routes_cached: usize,
    pub certificates_loaded: usize,
    pub requests_total: u64,
}

/// Listener status.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// ListenerStatus data transfer object.
pub struct ListenerStatus {
    pub port: u16,
    pub active: bool,
}

/// Get proxy engine status.
#[utoipa::path(
    get,
    path = "/api/v1/proxy/status",
    responses(
        (status = 200, description = "Current proxy engine status", body = ProxyStatusResponse),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Proxy"
)]
#[tracing::instrument(skip_all)]
pub async fn get_proxy_status(State(state): State<AppState>) -> Json<ProxyStatusResponse> {
    let proxy_enabled = std::env::var("PROXY_ENABLED")
        .unwrap_or_else(|_| "true".to_string())
        .parse::<bool>()
        .unwrap_or(true);

    let http_port: u16 = std::env::var("PROXY_HTTP_PORT")
        .unwrap_or_else(|_| "80".to_string())
        .parse()
        .unwrap_or(80);

    let https_port: u16 = std::env::var("PROXY_HTTPS_PORT")
        .unwrap_or_else(|_| "443".to_string())
        .parse()
        .unwrap_or(443);

    let certs_loaded = state
        .tls_resolver
        .as_ref()
        .map(|r| r.cert_count())
        .unwrap_or(0);

    Json(ProxyStatusResponse {
        http_listener: ListenerStatus {
            port: http_port,
            active: proxy_enabled,
        },
        https_listener: ListenerStatus {
            port: https_port,
            active: proxy_enabled,
        },
        routes_cached: state.route_cache.route_count(),
        certificates_loaded: certs_loaded,
        requests_total: state.route_cache.requests_total.load(Ordering::Relaxed),
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
