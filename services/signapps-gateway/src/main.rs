//! SignApps Gateway - Reverse-Proxy entry point
//!
//! Routes all public traffic to the appropriate backend service using reqwest.
//! Each service runs on its own port; the gateway forwards by path prefix.

use axum::{
    body::Body,
    extract::{Request, State},
    http::{HeaderName, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::any,
    Router,
};
use signapps_common::bootstrap::{env_or, init_tracing, load_env};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::watch;
use tokio::task::JoinHandle;

// ---------------------------------------------------------------------------
// Service port map
// ---------------------------------------------------------------------------

#[derive(Clone)]
struct ServiceMap {
    /// Ordered list of (path_prefix, backend_base_url)
    routes: Vec<(String, String)>,
    client: reqwest::Client,
}

impl ServiceMap {
    fn new(routes: Vec<(&str, &str)>) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .pool_idle_timeout(Duration::from_secs(30))
            .pool_max_idle_per_host(32)
            .build()
            .expect("reqwest client");

        Self {
            routes: routes
                .into_iter()
                .map(|(p, u)| (p.to_string(), u.to_string()))
                .collect(),
            client,
        }
    }

    /// Find the backend URL for a given path.
    fn resolve(&self, path: &str) -> Option<&str> {
        self.routes
            .iter()
            .find(|(prefix, _)| path.starts_with(prefix.as_str()))
            .map(|(_, url)| url.as_str())
    }
}

// ---------------------------------------------------------------------------
// Gateway health
// ---------------------------------------------------------------------------

async fn gateway_health() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "gateway": "signapps-gateway",
        "status": "healthy",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

// ---------------------------------------------------------------------------
// Reverse-proxy handler
// ---------------------------------------------------------------------------

async fn proxy_handler(State(svc): State<Arc<ServiceMap>>, req: Request) -> Response {
    let path = req.uri().path();
    let path_query = req
        .uri()
        .path_and_query()
        .map(|pq| pq.as_str())
        .unwrap_or(path);

    let backend = match svc.resolve(path) {
        Some(b) => b,
        None => {
            return (
                StatusCode::NOT_FOUND,
                axum::Json(serde_json::json!({ "error": "No backend for this path" })),
            )
                .into_response();
        },
    };

    let target_url = format!("{}{}", backend.trim_end_matches('/'), path_query);

    let method = req.method().clone();
    let headers = req.headers().clone();

    // Collect body bytes
    let body_bytes = match axum::body::to_bytes(req.into_body(), usize::MAX).await {
        Ok(b) => b,
        Err(e) => {
            tracing::error!("Failed to read request body: {}", e);
            return StatusCode::BAD_GATEWAY.into_response();
        },
    };

    // Build forwarded request
    let mut proxy_req = svc.client.request(method.clone(), &target_url);

    // Copy headers (skip hop-by-hop)
    for (name, value) in &headers {
        let n = name.as_str().to_lowercase();
        if matches!(
            n.as_str(),
            "connection"
                | "keep-alive"
                | "proxy-authenticate"
                | "proxy-authorization"
                | "te"
                | "trailers"
                | "transfer-encoding"
                | "upgrade"
        ) {
            continue;
        }
        proxy_req = proxy_req.header(name.as_str(), value.as_bytes());
    }

    if !body_bytes.is_empty() {
        proxy_req = proxy_req.body(body_bytes.to_vec());
    }

    match proxy_req.send().await {
        Ok(resp) => {
            let status = resp.status();
            let resp_headers = resp.headers().clone();
            let resp_bytes = match resp.bytes().await {
                Ok(b) => b,
                Err(e) => {
                    tracing::error!("Failed to read backend response: {}", e);
                    return StatusCode::BAD_GATEWAY.into_response();
                },
            };

            let mut response = Response::new(Body::from(resp_bytes));
            *response.status_mut() =
                StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);

            for (name, value) in &resp_headers {
                let n = name.as_str().to_lowercase();
                if matches!(
                    n.as_str(),
                    "connection" | "transfer-encoding" | "keep-alive"
                ) {
                    continue;
                }
                if let (Ok(hn), Ok(hv)) = (
                    HeaderName::from_bytes(name.as_str().as_bytes()),
                    HeaderValue::from_bytes(value.as_bytes()),
                ) {
                    response.headers_mut().insert(hn, hv);
                }
            }

            response
        },
        Err(e) => {
            tracing::warn!("Backend {} unreachable: {}", backend, e);
            (
                StatusCode::BAD_GATEWAY,
                axum::Json(serde_json::json!({
                    "error": "Backend service unreachable",
                    "backend": backend
                })),
            )
                .into_response()
        },
    }
}

// ---------------------------------------------------------------------------
// Spawn service helper (kept for future embedded-service mode)
// ---------------------------------------------------------------------------

async fn spawn_service(
    name: &str,
    port: u16,
    router: Router,
    mut shutdown_rx: watch::Receiver<bool>,
) -> JoinHandle<()> {
    let name = name.to_string();
    let addr = format!("0.0.0.0:{}", port);

    tokio::spawn(async move {
        let listener = match tokio::net::TcpListener::bind(&addr).await {
            Ok(l) => {
                tracing::info!("[{}] listening on port {}", name, port);
                l
            },
            Err(e) => {
                tracing::error!("[{}] failed to bind port {}: {}", name, port, e);
                return;
            },
        };

        let shutdown_signal = {
            let name = name.clone();
            async move {
                loop {
                    shutdown_rx.changed().await.ok();
                    if *shutdown_rx.borrow() {
                        break;
                    }
                }
                tracing::info!("[{}] shutting down...", name);
            }
        };

        if let Err(e) = axum::serve(listener, router)
            .with_graceful_shutdown(shutdown_signal)
            .await
        {
            tracing::error!("[{}] server error: {}", name, e);
        }

        tracing::info!("[{}] stopped", name);
    })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing("signapps_gateway");
    load_env();

    tracing::info!("=== SignApps Gateway - Reverse Proxy ===");

    // Build the service route table from env vars (overridable for testing/docker)
    let identity_url = env_or("IDENTITY_SERVICE_URL", "http://127.0.0.1:3001");
    let docs_url = env_or("DOCS_SERVICE_URL", "http://127.0.0.1:3010");
    let storage_url = env_or("STORAGE_SERVICE_URL", "http://127.0.0.1:3004");
    let ai_url = env_or("AI_SERVICE_URL", "http://127.0.0.1:3005");
    let calendar_url = env_or("CALENDAR_SERVICE_URL", "http://127.0.0.1:3007");
    let forms_url = env_or("FORMS_SERVICE_URL", "http://127.0.0.1:3015");
    let social_url = env_or("SOCIAL_SERVICE_URL", "http://127.0.0.1:3008");
    let office_url = env_or("OFFICE_SERVICE_URL", "http://127.0.0.1:3014");
    let remote_url = env_or("REMOTE_SERVICE_URL", "http://127.0.0.1:3017");
    let mail_url = env_or("MAIL_SERVICE_URL", "http://127.0.0.1:3012");
    let proxy_url = env_or("PROXY_SERVICE_URL", "http://127.0.0.1:3003");

    // Ordered: more-specific prefixes first
    let service_map = Arc::new(ServiceMap::new(vec![
        ("/api/v1/auth", &identity_url),
        ("/api/v1/users", &identity_url),
        ("/api/v1/workspaces", &identity_url),
        ("/api/v1/tenant", &identity_url),
        ("/api/v1/docs", &docs_url),
        ("/api/v1/channels", &docs_url),
        ("/api/v1/dms", &docs_url),
        ("/api/v1/files", &storage_url),
        ("/api/v1/buckets", &storage_url),
        ("/api/v1/preview", &storage_url),
        ("/api/v1/ai", &ai_url),
        ("/api/v1/calendar", &calendar_url),
        ("/api/v1/forms", &forms_url),
        ("/api/v1/social", &social_url),
        ("/api/v1/office", &office_url),
        ("/api/v1/remote", &remote_url),
        ("/api/v1/mail", &mail_url),
        ("/api/v1/proxy", &proxy_url),
        // Fallback: identity health
        ("/health", &identity_url),
    ]));

    let gateway_port: u16 = env_or("GATEWAY_PORT", "3099").parse().unwrap_or(3099);

    let app = Router::new()
        .route("/gateway/health", axum::routing::get(gateway_health))
        .fallback(any(proxy_handler))
        .with_state(service_map);

    let (shutdown_tx, _shutdown_rx) = watch::channel(false);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", gateway_port)).await?;
    tracing::info!("Gateway listening on port {}", gateway_port);

    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            tokio::signal::ctrl_c().await.ok();
            tracing::info!("Shutdown signal received");
            let _ = shutdown_tx.send(true);
        })
        .await?;

    tracing::info!("=== SignApps Gateway stopped ===");
    Ok(())
}
