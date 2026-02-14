//! HTTP request forwarding via hyper client with connection pooling.

use bytes::Bytes;
use http_body_util::{combinators::BoxBody, BodyExt, Empty, Full};
use hyper::body::Incoming;
use hyper::{Request, Response, StatusCode, Uri};
use hyper_util::client::legacy::Client;
use hyper_util::rt::TokioExecutor;
use std::net::SocketAddr;

use super::route_cache::CachedRoute;

/// HTTP forwarder with connection pooling.
#[derive(Clone)]
pub struct HttpForwarder {
    client:
        Client<hyper_util::client::legacy::connect::HttpConnector, BoxBody<Bytes, hyper::Error>>,
}

impl HttpForwarder {
    pub fn new() -> Self {
        let client = Client::builder(TokioExecutor::new())
            .pool_idle_timeout(std::time::Duration::from_secs(30))
            .pool_max_idle_per_host(32)
            .build_http();

        Self { client }
    }

    /// Forward an HTTP request to the target backend.
    pub async fn forward(
        &self,
        mut req: Request<Incoming>,
        route: &CachedRoute,
        client_addr: SocketAddr,
        is_https: bool,
    ) -> Result<Response<BoxBody<Bytes, hyper::Error>>, hyper::Error> {
        // Handle redirect mode
        if route.mode == "redirect" {
            return Ok(self.redirect_response(&route.target));
        }

        // Pick target (load balancer round-robin or single target)
        let target = route.next_target();

        // Build the new URI
        let target_uri: Uri = match target.parse() {
            Ok(u) => u,
            Err(_) => return Ok(bad_gateway("Invalid target URL")),
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

        let new_uri: Uri = match new_uri.parse() {
            Ok(u) => u,
            Err(_) => return Ok(bad_gateway("Failed to build target URI")),
        };

        *req.uri_mut() = new_uri;

        // Inject forwarding headers
        let client_ip = client_addr.ip().to_string();
        let forwarded_host = req.headers().get("host").cloned();

        let headers = req.headers_mut();

        if let Ok(val) = client_ip.parse() {
            headers.insert("x-forwarded-for", val);
        }
        if let Ok(val) = (if is_https { "https" } else { "http" }).parse() {
            headers.insert("x-forwarded-proto", val);
        }
        if let Ok(val) = client_ip.parse() {
            headers.insert("x-real-ip", val);
        }
        if let Some(host) = forwarded_host {
            headers.insert("x-forwarded-host", host);
        }

        // Box the incoming body
        let (parts, body) = req.into_parts();
        let boxed_body = body.map_err(|e| e).boxed();
        let req = Request::from_parts(parts, boxed_body);

        // Forward the request
        match self.client.request(req).await {
            Ok(resp) => {
                let (parts, body) = resp.into_parts();
                let boxed_body = body
                    .map_err(|e| {
                        // Convert the legacy client error into hyper::Error
                        // This is a type-erased error path
                        let _ = e;
                        unreachable!("body stream error")
                    })
                    .boxed();
                Ok(Response::from_parts(parts, boxed_body))
            },
            Err(_) => Ok(bad_gateway("Backend unreachable")),
        }
    }

    fn redirect_response(&self, target: &str) -> Response<BoxBody<Bytes, hyper::Error>> {
        Response::builder()
            .status(StatusCode::MOVED_PERMANENTLY)
            .header("location", target)
            .body(empty_body())
            .unwrap()
    }
}

pub fn empty_body() -> BoxBody<Bytes, hyper::Error> {
    Empty::<Bytes>::new()
        .map_err(|never| match never {})
        .boxed()
}

pub fn full_body(data: impl Into<Bytes>) -> BoxBody<Bytes, hyper::Error> {
    Full::new(data.into())
        .map_err(|never| match never {})
        .boxed()
}

pub fn bad_gateway(msg: &str) -> Response<BoxBody<Bytes, hyper::Error>> {
    Response::builder()
        .status(StatusCode::BAD_GATEWAY)
        .header("content-type", "text/plain")
        .body(full_body(msg.to_string()))
        .unwrap()
}
