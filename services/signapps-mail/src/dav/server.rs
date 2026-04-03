//! CalDAV/CardDAV Axum server.
//!
//! Spawns a separate Axum application on port 8443 (configurable via `DAV_PORT`).
//! Handles `.well-known` discovery redirects and routes all `/dav/*` requests
//! to the appropriate CalDAV or CardDAV handler based on path and method.

use axum::{
    body::Body,
    http::{Method, Request},
    response::{IntoResponse, Redirect, Response},
    routing::get,
    Router,
};
use signapps_dav::webdav::{parse_depth, DavResponse};

use crate::state::MailServerState;

use super::auth;

/// Start the DAV server on the given port.
///
/// # Errors
///
/// Logs errors if the TCP listener cannot bind. Does not panic.
///
/// # Panics
///
/// None.
#[tracing::instrument(skip(state), fields(port))]
pub async fn start(state: MailServerState, port: u16) {
    let app = Router::new()
        .route("/.well-known/caldav", get(well_known_caldav))
        .route("/.well-known/carddav", get(well_known_carddav))
        .fallback(dav_handler)
        .with_state(state);

    let addr: std::net::SocketAddr = format!("0.0.0.0:{}", port)
        .parse()
        .expect("DAV server address is valid");

    tracing::info!("CalDAV/CardDAV server listening on port {}", port);

    match tokio::net::TcpListener::bind(addr).await {
        Ok(listener) => {
            if let Err(e) = axum::serve(listener, app).await {
                tracing::error!("DAV server error: {}", e);
            }
        }
        Err(e) => {
            tracing::error!("Failed to bind DAV server on port {}: {}", port, e);
        }
    }
}

/// Well-known CalDAV discovery redirect.
///
/// Clients like macOS Calendar and Thunderbird probe `/.well-known/caldav`
/// to discover the principal URL.
///
/// # Panics
///
/// None.
async fn well_known_caldav() -> Redirect {
    Redirect::permanent("/dav/calendars/")
}

/// Well-known CardDAV discovery redirect.
///
/// # Panics
///
/// None.
async fn well_known_carddav() -> Redirect {
    Redirect::permanent("/dav/addressbooks/")
}

/// Top-level DAV request handler.
///
/// Authenticates via HTTP Basic Auth, then dispatches to the CalDAV or
/// CardDAV handler based on the request path prefix.
///
/// # Panics
///
/// None.
#[tracing::instrument(skip(state, req))]
async fn dav_handler(
    axum::extract::State(state): axum::extract::State<MailServerState>,
    req: Request<Body>,
) -> Response {
    let method = req.method().clone();
    let path = req.uri().path().to_string();
    let headers = req.headers().clone();

    tracing::debug!(method = %method, path = %path, "DAV request");

    // OPTIONS is unauthenticated — returns supported methods
    if method == Method::OPTIONS {
        return build_options_response(&path);
    }

    // Authenticate
    let dav_auth = match auth::authenticate_basic(&state.pool, &headers).await {
        Ok(a) => a,
        Err(resp) => return resp.into_response(),
    };

    // Read body
    let body_bytes = match axum::body::to_bytes(req.into_body(), 10 * 1024 * 1024).await {
        Ok(b) => b,
        Err(e) => {
            tracing::error!("Failed to read DAV request body: {}", e);
            return (axum::http::StatusCode::BAD_REQUEST, "Invalid request body").into_response();
        }
    };
    let body_str = String::from_utf8_lossy(&body_bytes).to_string();

    let depth = parse_depth(headers.get("depth").and_then(|v| v.to_str().ok()));
    let if_match = headers
        .get("if-match")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    // Route based on path prefix
    let dav_response = if path.starts_with("/dav/calendars") {
        super::caldav::handle(
            &state.pool,
            &dav_auth,
            &method,
            &path,
            depth,
            if body_str.is_empty() {
                None
            } else {
                Some(&body_str)
            },
            if_match.as_deref(),
        )
        .await
    } else if path.starts_with("/dav/addressbooks") {
        super::carddav::handle(
            &state.pool,
            &dav_auth,
            &method,
            &path,
            depth,
            if body_str.is_empty() {
                None
            } else {
                Some(&body_str)
            },
            if_match.as_deref(),
        )
        .await
    } else {
        DavResponse::not_found()
    };

    // Convert DavResponse to Axum Response
    let mut builder = Response::builder().status(dav_response.status);
    for (key, value) in &dav_response.headers {
        builder = builder.header(key.as_str(), value.as_str());
    }

    // Add DAV header for client discovery
    builder = builder.header("DAV", "1, 2, 3, calendar-access, addressbook");

    builder
        .body(Body::from(dav_response.body))
        .unwrap_or_else(|_| {
            Response::builder()
                .status(500)
                .body(Body::from("Internal error"))
                .unwrap()
        })
}

/// Build an OPTIONS response with supported DAV methods.
fn build_options_response(path: &str) -> Response {
    let methods = if path.starts_with("/dav/calendars") || path.starts_with("/dav/addressbooks") {
        "OPTIONS, PROPFIND, PROPPATCH, REPORT, GET, PUT, DELETE, MKCOL"
    } else {
        "OPTIONS, PROPFIND"
    };

    Response::builder()
        .status(200)
        .header("Allow", methods)
        .header("DAV", "1, 2, 3, calendar-access, addressbook")
        .header("Content-Length", "0")
        .body(Body::empty())
        .unwrap_or_else(|_| {
            Response::builder()
                .status(500)
                .body(Body::from("Internal error"))
                .unwrap()
        })
}
