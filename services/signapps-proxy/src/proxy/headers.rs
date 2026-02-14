//! Custom header application per route.

use bytes::Bytes;
use http_body_util::combinators::BoxBody;
use hyper::body::Incoming;
use hyper::{Request, Response};
use signapps_db::models::HeadersConfig;

/// Apply custom request headers before forwarding.
pub fn apply_request_headers(req: &mut Request<Incoming>, config: &HeadersConfig) {
    let headers = req.headers_mut();

    // Remove specified headers
    for name in &config.remove_request_headers {
        if let Ok(header_name) = name.parse::<hyper::header::HeaderName>() {
            headers.remove(&header_name);
        }
    }

    // Add custom headers
    for entry in &config.request_headers {
        if let (Ok(name), Ok(value)) = (
            entry.name.parse::<hyper::header::HeaderName>(),
            entry.value.parse::<hyper::header::HeaderValue>(),
        ) {
            headers.insert(name, value);
        }
    }
}

/// Apply custom response headers after receiving backend response.
pub fn apply_response_headers(
    resp: &mut Response<BoxBody<Bytes, hyper::Error>>,
    config: &HeadersConfig,
) {
    let headers = resp.headers_mut();

    // Remove specified headers
    for name in &config.remove_response_headers {
        if let Ok(header_name) = name.parse::<hyper::header::HeaderName>() {
            headers.remove(&header_name);
        }
    }

    // Add custom headers
    for entry in &config.response_headers {
        if let (Ok(name), Ok(value)) = (
            entry.name.parse::<hyper::header::HeaderName>(),
            entry.value.parse::<hyper::header::HeaderValue>(),
        ) {
            headers.insert(name, value);
        }
    }
}
