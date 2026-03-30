//! Core proxy engine: TCP listener, HTTP dispatch, TLS termination.

use bytes::Bytes;
use http_body_util::combinators::BoxBody;
use hyper::body::Incoming;
use hyper::service::service_fn;
use hyper::{Request, Response, StatusCode};
use hyper_util::rt::{TokioExecutor, TokioIo};
use hyper_util::server::conn::auto::Builder as ServerBuilder;
use std::net::SocketAddr;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tokio::net::TcpListener;

use super::acme::AcmeChallengeStore;
use super::forwarder::{full_body, HttpForwarder};
use super::headers;
use super::middleware::check_shield;
use super::route_cache::RouteCache;
use super::tls::TlsCertResolver;
use super::websocket;
use crate::shield::ShieldService;

/// Proxy engine configuration.
#[derive(Clone)]
pub struct ProxyEngine {
    pub route_cache: RouteCache,
    pub forwarder: HttpForwarder,
    pub shield: ShieldService,
    pub acme_store: AcmeChallengeStore,
    pub tls_resolver: Option<TlsCertResolver>,
}

/// Run the HTTP proxy listener on the specified port.
pub async fn run_proxy(
    http_port: u16,
    https_port: Option<u16>,
    engine: ProxyEngine,
) -> anyhow::Result<()> {
    let http_addr = SocketAddr::from(([0, 0, 0, 0], http_port));
    let http_listener = TcpListener::bind(http_addr).await?;
    tracing::info!("Proxy HTTP listening on {}", http_addr);

    // Spawn HTTPS listener if TLS is configured
    if let (Some(port), Some(resolver)) = (https_port, engine.tls_resolver.clone()) {
        let engine_https = engine.clone();
        tokio::spawn(async move {
            if let Err(e) = run_https_listener(port, engine_https, resolver).await {
                tracing::error!(error = %e, "HTTPS listener failed");
            }
        });
    }

    // HTTP accept loop
    let engine = Arc::new(engine);
    loop {
        let (stream, client_addr) = match http_listener.accept().await {
            Ok(conn) => conn,
            Err(e) => {
                tracing::debug!(error = %e, "Failed to accept TCP connection");
                continue;
            },
        };

        let engine = engine.clone();
        tokio::spawn(async move {
            let io = TokioIo::new(stream);
            let svc = service_fn(move |req: Request<Incoming>| {
                let engine = engine.clone();
                async move { handle_http_request(req, client_addr, &engine, false).await }
            });

            if let Err(e) = ServerBuilder::new(TokioExecutor::new())
                .serve_connection(io, svc)
                .await
            {
                tracing::debug!(error = %e, "HTTP connection error");
            }
        });
    }
}

/// Run the HTTPS proxy listener with TLS termination.
async fn run_https_listener(
    port: u16,
    engine: ProxyEngine,
    resolver: TlsCertResolver,
) -> anyhow::Result<()> {
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = TcpListener::bind(addr).await?;
    tracing::info!("Proxy HTTPS listening on {}", addr);

    // Build rustls ServerConfig with custom cert resolver
    let tls_config = rustls::ServerConfig::builder()
        .with_no_client_auth()
        .with_cert_resolver(Arc::new(resolver));

    let tls_acceptor = tokio_rustls::TlsAcceptor::from(Arc::new(tls_config));
    let engine = Arc::new(engine);

    loop {
        let (stream, client_addr) = match listener.accept().await {
            Ok(conn) => conn,
            Err(e) => {
                tracing::debug!(error = %e, "Failed to accept TLS connection");
                continue;
            },
        };

        let tls_acceptor = tls_acceptor.clone();
        let engine = engine.clone();

        tokio::spawn(async move {
            let tls_stream = match tls_acceptor.accept(stream).await {
                Ok(s) => s,
                Err(e) => {
                    tracing::debug!(error = %e, "TLS handshake failed");
                    return;
                },
            };

            let io = TokioIo::new(tls_stream);
            let svc = service_fn(move |req: Request<Incoming>| {
                let engine = engine.clone();
                async move { handle_http_request(req, client_addr, &engine, true).await }
            });

            if let Err(e) = ServerBuilder::new(TokioExecutor::new())
                .serve_connection(io, svc)
                .await
            {
                tracing::debug!(error = %e, "HTTPS connection error");
            }
        });
    }
}

/// Handle a single HTTP request through the proxy pipeline.
async fn handle_http_request(
    mut req: Request<Incoming>,
    client_addr: SocketAddr,
    engine: &ProxyEngine,
    is_https: bool,
) -> Result<Response<BoxBody<Bytes, hyper::Error>>, hyper::Error> {
    // Increment total request counter
    engine
        .route_cache
        .requests_total
        .fetch_add(1, Ordering::Relaxed);

    // ACME HTTP-01 challenge interception (port 80 only)
    if !is_https {
        if let Some(resp) = handle_acme_challenge(&req, &engine.acme_store) {
            return Ok(resp);
        }
    }

    // Extract host from request
    let host = extract_host(&req);
    let host = match host {
        Some(h) => h,
        None => {
            return Ok(Response::builder()
                .status(StatusCode::BAD_REQUEST)
                .body(full_body("Missing Host header"))
                .expect("valid response builder"));
        },
    };

    // Lookup route in cache
    let route = match engine.route_cache.lookup(&host) {
        Some(r) => r,
        None => {
            return Ok(Response::builder()
                .status(StatusCode::NOT_FOUND)
                .header("content-type", "text/plain")
                .body(full_body(format!("No route for host: {}", host)))
                .expect("valid response builder"));
        },
    };

    // HTTPS redirect if route requires TLS and we're on HTTP
    if !is_https && route.tls_enabled && route.force_https {
        let redirect_url = format!("https://{}{}", host, req.uri().path());
        return Ok(Response::builder()
            .status(StatusCode::MOVED_PERMANENTLY)
            .header("location", redirect_url)
            .body(full_body(""))
            .expect("valid response builder"));
    }

    // SmartShield rate limiting check
    if let Some(resp) = check_shield(&route, client_addr, &engine.shield).await {
        return Ok(resp);
    }

    // Apply custom request headers
    if let Some(ref config) = route.headers_config {
        headers::apply_request_headers(&mut req, config);
    }

    // WebSocket upgrade detection
    if websocket::is_websocket_upgrade(&req) {
        let target = route.next_target();
        return websocket::handle_websocket_upgrade(req, target, client_addr).await;
    }

    // Forward the request
    let mut resp = engine
        .forwarder
        .forward(req, &route, client_addr, is_https)
        .await?;

    // Apply custom response headers
    if let Some(ref config) = route.headers_config {
        headers::apply_response_headers(&mut resp, config);
    }

    Ok(resp)
}

/// Extract host from the request (Host header or URI authority).
fn extract_host(req: &Request<Incoming>) -> Option<String> {
    // Try Host header first
    if let Some(host) = req.headers().get("host") {
        if let Ok(h) = host.to_str() {
            return Some(h.to_string());
        }
    }

    // Fallback to URI authority
    req.uri().authority().map(|a| a.to_string())
}

/// Handle ACME HTTP-01 challenge requests.
fn handle_acme_challenge(
    req: &Request<Incoming>,
    store: &AcmeChallengeStore,
) -> Option<Response<BoxBody<Bytes, hyper::Error>>> {
    let path = req.uri().path();
    if !path.starts_with("/.well-known/acme-challenge/") {
        return None;
    }

    let token = path.strip_prefix("/.well-known/acme-challenge/")?;
    if token.is_empty() {
        return None;
    }

    match store.get(token) {
        Some(proof) => {
            tracing::info!(token, "Serving ACME challenge response");
            Some(
                Response::builder()
                    .status(StatusCode::OK)
                    .header("content-type", "text/plain")
                    .body(full_body(proof))
                    .expect("valid response builder"),
            )
        },
        None => {
            tracing::debug!(token, "ACME challenge token not found");
            Some(
                Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .body(full_body("Challenge not found"))
                    .expect("valid response builder"),
            )
        },
    }
}
