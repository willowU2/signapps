//! WebSocket upgrade detection and bidirectional tunneling.

use bytes::Bytes;
use http_body_util::combinators::BoxBody;
use http_body_util::BodyExt;
use hyper::body::Incoming;
use hyper::{Request, Response, StatusCode};
use hyper_util::client::legacy::Client;
use hyper_util::rt::TokioExecutor;

use super::forwarder::full_body;

/// Check if a request is a WebSocket upgrade.
pub fn is_websocket_upgrade(req: &Request<Incoming>) -> bool {
    let connection = req
        .headers()
        .get("connection")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let upgrade = req
        .headers()
        .get("upgrade")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    connection.to_lowercase().contains("upgrade") && upgrade.to_lowercase() == "websocket"
}

/// Forward a WebSocket upgrade request to the backend and tunnel data bidirectionally.
pub async fn handle_websocket_upgrade(
    mut req: Request<Incoming>,
    target: &str,
    client_addr: std::net::SocketAddr,
) -> Result<Response<BoxBody<Bytes, hyper::Error>>, hyper::Error> {
    let target_uri: hyper::Uri = match target.parse() {
        Ok(u) => u,
        Err(_) => {
            return Ok(Response::builder()
                .status(StatusCode::BAD_GATEWAY)
                .body(full_body("Invalid WebSocket target"))
                .unwrap());
        },
    };

    let path_and_query = req
        .uri()
        .path_and_query()
        .map(|pq| pq.as_str())
        .unwrap_or("/");

    let new_uri = format!(
        "{}{}",
        target_uri.to_string().trim_end_matches('/'),
        path_and_query
    );

    let new_uri: hyper::Uri = match new_uri.parse() {
        Ok(u) => u,
        Err(_) => {
            return Ok(Response::builder()
                .status(StatusCode::BAD_GATEWAY)
                .body(full_body("Failed to build WebSocket target URI"))
                .unwrap());
        },
    };

    *req.uri_mut() = new_uri;

    // Add forwarding headers
    let client_ip = client_addr.ip().to_string();
    if let Ok(val) = client_ip.parse() {
        req.headers_mut().insert("x-forwarded-for", val);
    }

    // Save the upgrade future for the *incoming* (client→proxy) connection
    // before we consume the request sending it to the backend.
    let client_upgrade_fut = hyper::upgrade::on(&mut req);

    // Use a separate HTTP client for the upgrade
    let client: Client<hyper_util::client::legacy::connect::HttpConnector, Incoming> =
        Client::builder(TokioExecutor::new()).build_http();

    match client.request(req).await {
        Ok(mut backend_resp) => {
            if backend_resp.status() == StatusCode::SWITCHING_PROTOCOLS {
                // Save the upgrade future for the backend response
                let backend_upgrade_fut = hyper::upgrade::on(&mut backend_resp);

                // Build the 101 response to send back to the client, copying WS headers
                let mut resp_builder = Response::builder().status(StatusCode::SWITCHING_PROTOCOLS);
                for (key, value) in backend_resp.headers() {
                    resp_builder = resp_builder.header(key, value);
                }
                let resp_body = full_body("");
                let response = resp_builder.body(resp_body).unwrap();

                // Spawn the bidirectional pipe as a background task
                tokio::spawn(async move {
                    let client_conn = match client_upgrade_fut.await {
                        Ok(c) => c,
                        Err(e) => {
                            tracing::error!("WebSocket client upgrade failed: {}", e);
                            return;
                        },
                    };
                    let backend_conn = match backend_upgrade_fut.await {
                        Ok(b) => b,
                        Err(e) => {
                            tracing::error!("WebSocket backend upgrade failed: {}", e);
                            return;
                        },
                    };

                    // Pipe bytes bidirectionally between client and backend
                    let mut client_io = hyper_util::rt::TokioIo::new(client_conn);
                    let mut backend_io = hyper_util::rt::TokioIo::new(backend_conn);

                    match tokio::io::copy_bidirectional(&mut client_io, &mut backend_io).await {
                        Ok((from_client, from_backend)) => {
                            tracing::debug!(
                                "WebSocket tunnel closed: {}B client→backend, {}B backend→client",
                                from_client,
                                from_backend
                            );
                        },
                        Err(e) => {
                            tracing::debug!("WebSocket tunnel error (normal on close): {}", e);
                        },
                    }
                });

                Ok(response)
            } else {
                // Backend didn't accept the upgrade
                let (parts, body) = backend_resp.into_parts();
                let boxed = body
                    .map_err(|e| {
                        tracing::error!("Body stream error from WebSocket backend: {e}");
                        e
                    })
                    .boxed();
                Ok(Response::from_parts(parts, boxed))
            }
        },
        Err(_) => Ok(Response::builder()
            .status(StatusCode::BAD_GATEWAY)
            .body(full_body("WebSocket backend unreachable"))
            .unwrap()),
    }
}
