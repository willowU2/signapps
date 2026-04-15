//! Hostname-based routing middleware.
//!
//! Routes requests to the prod or staging backend cluster based on the
//! `Host` header. The backend cluster is selected before any other routing
//! happens — downstream middleware (e.g. maintenance) reads the cluster from
//! request extensions to choose the correct per-env behaviour.
//!
//! Mapping:
//! - `app.signapps.io` / `app.localhost` → prod
//! - `staging.signapps.io` / `staging.localhost` → staging
//! - Anything else → prod (backward compatibility default)

use axum::{
    extract::{Request, State},
    http::HeaderValue,
    middleware::Next,
    response::Response,
};

/// Logical backend cluster selected by the hostname router.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum BackendCluster {
    /// Production cluster (default).
    Prod,
    /// Staging cluster (dev promotion target).
    Staging,
}

impl BackendCluster {
    /// Port offset applied to prod ports to reach staging (staging = prod + 1000).
    ///
    /// Consumed by downstream code (e.g. the proxy forwarder and the
    /// promote command) to compute the staging service port from a prod
    /// port number.
    #[allow(dead_code)]
    pub fn port_offset(&self) -> u16 {
        match self {
            BackendCluster::Prod => 0,
            BackendCluster::Staging => 1000,
        }
    }

    /// Env identifier matching the `deployments.env` CHECK constraint.
    pub fn env_name(&self) -> &'static str {
        match self {
            BackendCluster::Prod => "prod",
            BackendCluster::Staging => "dev",
        }
    }
}

/// Configuration for the hostname router — hostnames that map to the
/// staging cluster. Anything not matching goes to prod (default).
#[derive(Clone)]
pub struct HostnameRouterState {
    /// Hostnames (without port) that route to the staging cluster.
    pub staging_hostnames: Vec<String>,
}

impl Default for HostnameRouterState {
    fn default() -> Self {
        Self {
            staging_hostnames: vec![
                "staging.signapps.io".to_string(),
                "staging.localhost".to_string(),
            ],
        }
    }
}

fn extract_host(header: Option<&HeaderValue>) -> Option<&str> {
    let val = header?.to_str().ok()?;
    // Strip port (host:3000 → host)
    Some(val.split(':').next().unwrap_or(val))
}

/// Axum middleware that inserts the selected [`BackendCluster`] into the
/// request extensions.
pub async fn hostname_router_middleware(
    State(state): State<HostnameRouterState>,
    mut req: Request,
    next: Next,
) -> Response {
    let host = extract_host(req.headers().get("host")).unwrap_or("");
    let cluster = if state.staging_hostnames.iter().any(|h| h == host) {
        BackendCluster::Staging
    } else {
        BackendCluster::Prod
    };
    req.extensions_mut().insert(cluster);
    next.run(req).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request as HttpRequest, middleware, routing::get, Router};
    use tower::ServiceExt;

    async fn captured_cluster_app(state: HostnameRouterState) -> Router {
        Router::new()
            .route(
                "/peek",
                get(|req: axum::extract::Request| async move {
                    let cluster = req
                        .extensions()
                        .get::<BackendCluster>()
                        .cloned()
                        .unwrap_or(BackendCluster::Prod);
                    match cluster {
                        BackendCluster::Prod => "prod",
                        BackendCluster::Staging => "staging",
                    }
                }),
            )
            .layer(middleware::from_fn_with_state(
                state,
                hostname_router_middleware,
            ))
    }

    #[tokio::test]
    async fn routes_staging_hostname_to_staging_cluster() {
        let app = captured_cluster_app(HostnameRouterState::default()).await;
        let resp = app
            .oneshot(
                HttpRequest::builder()
                    .uri("/peek")
                    .header("host", "staging.localhost")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        assert_eq!(&body[..], b"staging");
    }

    #[tokio::test]
    async fn routes_prod_hostname_to_prod_cluster() {
        let app = captured_cluster_app(HostnameRouterState::default()).await;
        let resp = app
            .oneshot(
                HttpRequest::builder()
                    .uri("/peek")
                    .header("host", "app.localhost")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        assert_eq!(&body[..], b"prod");
    }

    #[tokio::test]
    async fn unknown_hostname_defaults_to_prod() {
        let app = captured_cluster_app(HostnameRouterState::default()).await;
        let resp = app
            .oneshot(
                HttpRequest::builder()
                    .uri("/peek")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        assert_eq!(&body[..], b"prod");
    }

    #[test]
    fn extract_host_strips_port() {
        let v = HeaderValue::from_static("app.localhost:3000");
        assert_eq!(extract_host(Some(&v)), Some("app.localhost"));
    }
}
