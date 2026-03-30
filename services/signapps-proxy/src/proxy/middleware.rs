//! SmartShield inline rate limiting for the proxy engine.

use bytes::Bytes;
use http_body_util::combinators::BoxBody;
use hyper::{Response, StatusCode};
use std::net::SocketAddr;

use super::forwarder::full_body;
use super::route_cache::CachedRoute;
use crate::shield::ShieldService;

/// Check SmartShield rate limiting for an incoming request.
/// Returns Some(response) if the request should be blocked, None if allowed.
pub async fn check_shield(
    route: &CachedRoute,
    client_addr: SocketAddr,
    shield: &ShieldService,
) -> Option<Response<BoxBody<Bytes, hyper::Error>>> {
    let config = match &route.shield_config {
        Some(c) if c.enabled => c,
        _ => return None,
    };

    let client_ip = client_addr.ip().to_string();
    let route_id = route.id.to_string();

    match shield.check_request(&route_id, &client_ip, config).await {
        Ok(result) => {
            if result.is_allowed() {
                None
            } else {
                let (status, msg) = match result {
                    crate::shield::service::RateLimitResult::RateLimited { .. } => {
                        (StatusCode::TOO_MANY_REQUESTS, "Rate limit exceeded")
                    },
                    crate::shield::service::RateLimitResult::Blocked => {
                        (StatusCode::FORBIDDEN, "IP blocked")
                    },
                    _ => unreachable!(),
                };

                Some(
                    Response::builder()
                        .status(status)
                        .header("content-type", "text/plain")
                        .header("retry-after", "60")
                        .body(full_body(msg))
                        .expect("valid response builder"),
                )
            }
        },
        Err(e) => {
            tracing::warn!(error = %e, "Shield check failed, allowing request");
            None
        },
    }
}
