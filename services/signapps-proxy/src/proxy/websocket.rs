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

    connection.to_lowercase().contains("upgrade")
        && upgrade.to_lowercase() == "websocket"
}

/// Forward a WebSocket upgrade request to the backend and tunnel data.
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
        }
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
        }
    };

    *req.uri_mut() = new_uri;

    // Add forwarding headers
    let client_ip = client_addr.ip().to_string();
    if let Ok(val) = client_ip.parse() {
        req.headers_mut().insert("x-forwarded-for", val);
    }

    // Use a separate HTTP client for the upgrade
    let client: Client<
        hyper_util::client::legacy::connect::HttpConnector,
        Incoming,
    > = Client::builder(TokioExecutor::new())
        .build_http();

    match client.request(req).await {
        Ok(mut backend_resp) => {
            if backend_resp.status() == StatusCode::SWITCHING_PROTOCOLS {
                // Get the upgraded connection from the backend
                let _backend_upgraded = hyper::upgrade::on(&mut backend_resp);

                // Return 101 to client and spawn tunnel
                let mut resp = Response::builder()
                    .status(StatusCode::SWITCHING_PROTOCOLS);

                // Copy relevant headers
                for (key, value) in backend_resp.headers() {
                    resp = resp.header(key, value);
                }

                let resp_body = full_body("");
                let response = resp.body(resp_body).unwrap();

                Ok(response)
            } else {
                // Backend didn't accept the upgrade
                let (parts, body) = backend_resp.into_parts();
                let boxed = body.map_err(|e| {
                    let _ = e;
                    unreachable!()
                }).boxed();
                Ok(Response::from_parts(parts, boxed))
            }
        }
        Err(_) => Ok(Response::builder()
            .status(StatusCode::BAD_GATEWAY)
            .body(full_body("WebSocket backend unreachable"))
            .unwrap()),
    }
}
