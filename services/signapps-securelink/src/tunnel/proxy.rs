#![allow(dead_code)]
//! Local proxy for forwarding requests to local services.
//!
//! This module handles proxying incoming tunnel requests to the
//! appropriate local services.

use signapps_common::{Error, Result};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

/// Configuration for a local proxy endpoint.
#[derive(Debug, Clone)]
pub struct ProxyEndpoint {
    /// Name of the endpoint.
    pub name: String,
    /// Local address to proxy to.
    pub local_addr: String,
    /// Protocol (http, tcp).
    pub protocol: String,
}

/// Local proxy service for forwarding requests.
#[derive(Clone)]
pub struct LocalProxy {
    endpoints: Arc<RwLock<HashMap<String, ProxyEndpoint>>>,
    http_client: reqwest::Client,
}

impl LocalProxy {
    /// Create a new local proxy.
    pub fn new() -> Self {
        Self {
            endpoints: Arc::new(RwLock::new(HashMap::new())),
            http_client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
        }
    }

    /// Register an endpoint.
    pub async fn register_endpoint(&self, subdomain: &str, endpoint: ProxyEndpoint) {
        let mut endpoints = self.endpoints.write().await;
        endpoints.insert(subdomain.to_string(), endpoint);
    }

    /// Unregister an endpoint.
    pub async fn unregister_endpoint(&self, subdomain: &str) {
        let mut endpoints = self.endpoints.write().await;
        endpoints.remove(subdomain);
    }

    /// Get an endpoint by subdomain.
    pub async fn get_endpoint(&self, subdomain: &str) -> Option<ProxyEndpoint> {
        let endpoints = self.endpoints.read().await;
        endpoints.get(subdomain).cloned()
    }

    /// List all endpoints.
    pub async fn list_endpoints(&self) -> Vec<ProxyEndpoint> {
        let endpoints = self.endpoints.read().await;
        endpoints.values().cloned().collect()
    }

    /// Proxy an HTTP request to a local endpoint.
    pub async fn proxy_http(
        &self,
        subdomain: &str,
        method: &str,
        path: &str,
        headers: Vec<(String, String)>,
        body: Option<Vec<u8>>,
    ) -> Result<HttpResponse> {
        let endpoint = self.get_endpoint(subdomain).await
            .ok_or_else(|| Error::NotFound(format!("Endpoint for subdomain: {}", subdomain)))?;

        let url = format!("http://{}{}", endpoint.local_addr, path);
        debug!("Proxying {} {} to {}", method, path, url);

        let mut request = match method.to_uppercase().as_str() {
            "GET" => self.http_client.get(&url),
            "POST" => self.http_client.post(&url),
            "PUT" => self.http_client.put(&url),
            "DELETE" => self.http_client.delete(&url),
            "PATCH" => self.http_client.patch(&url),
            "HEAD" => self.http_client.head(&url),
            "OPTIONS" => self.http_client.request(reqwest::Method::OPTIONS, &url),
            _ => return Err(Error::Validation(format!("Unsupported method: {}", method))),
        };

        // Add headers (skip hop-by-hop)
        for (name, value) in &headers {
            if !is_hop_by_hop_header(name) {
                if let Ok(header_name) = reqwest::header::HeaderName::from_bytes(name.as_bytes()) {
                    if let Ok(header_value) = reqwest::header::HeaderValue::from_str(value) {
                        request = request.header(header_name, header_value);
                    }
                }
            }
        }

        // Add body if present
        if let Some(body) = body {
            request = request.body(body);
        }

        // Send request
        let response = request.send().await
            .map_err(|e| Error::Internal(format!("Proxy request failed: {}", e)))?;

        let status = response.status().as_u16();
        let headers: Vec<(String, String)> = response
            .headers()
            .iter()
            .filter(|(name, _)| !is_hop_by_hop_header(name.as_str()))
            .map(|(name, value)| {
                (
                    name.to_string(),
                    value.to_str().unwrap_or("").to_string(),
                )
            })
            .collect();

        let body = response.bytes().await
            .map_err(|e| Error::Internal(format!("Failed to read response body: {}", e)))?
            .to_vec();

        Ok(HttpResponse {
            status,
            headers,
            body,
        })
    }

    /// Check if a local endpoint is reachable.
    pub async fn check_endpoint(&self, addr: &str) -> bool {
        match TcpStream::connect(addr).await {
            Ok(_) => true,
            Err(e) => {
                debug!("Endpoint {} not reachable: {}", addr, e);
                false
            }
        }
    }
}

impl Default for LocalProxy {
    fn default() -> Self {
        Self::new()
    }
}

/// HTTP response from a proxied request.
#[derive(Debug, Clone)]
pub struct HttpResponse {
    /// HTTP status code.
    pub status: u16,
    /// Response headers.
    pub headers: Vec<(String, String)>,
    /// Response body.
    pub body: Vec<u8>,
}

/// TCP proxy for raw TCP connections.
pub struct TcpProxy {
    listen_addr: SocketAddr,
    target_addr: String,
}

impl TcpProxy {
    /// Create a new TCP proxy.
    pub fn new(listen_addr: SocketAddr, target_addr: String) -> Self {
        Self {
            listen_addr,
            target_addr,
        }
    }

    /// Start the TCP proxy.
    pub async fn run(&self) -> Result<()> {
        let listener = TcpListener::bind(self.listen_addr).await
            .map_err(|e| Error::Internal(format!("Failed to bind TCP proxy: {}", e)))?;

        info!("TCP proxy listening on {} -> {}", self.listen_addr, self.target_addr);

        loop {
            match listener.accept().await {
                Ok((inbound, peer_addr)) => {
                    debug!("Accepted TCP connection from {}", peer_addr);
                    let target = self.target_addr.clone();
                    tokio::spawn(async move {
                        if let Err(e) = proxy_tcp_connection(inbound, &target).await {
                            warn!("TCP proxy error: {}", e);
                        }
                    });
                }
                Err(e) => {
                    error!("Failed to accept TCP connection: {}", e);
                }
            }
        }
    }
}

/// Proxy a single TCP connection.
async fn proxy_tcp_connection(mut inbound: TcpStream, target_addr: &str) -> Result<()> {
    let mut outbound = TcpStream::connect(target_addr).await
        .map_err(|e| Error::Internal(format!("Failed to connect to target: {}", e)))?;

    let (mut ri, mut wi) = inbound.split();
    let (mut ro, mut wo) = outbound.split();

    let client_to_server = async {
        let mut buf = vec![0u8; 8192];
        loop {
            let n = ri.read(&mut buf).await?;
            if n == 0 {
                break;
            }
            wo.write_all(&buf[..n]).await?;
        }
        wo.shutdown().await
    };

    let server_to_client = async {
        let mut buf = vec![0u8; 8192];
        loop {
            let n = ro.read(&mut buf).await?;
            if n == 0 {
                break;
            }
            wi.write_all(&buf[..n]).await?;
        }
        wi.shutdown().await
    };

    tokio::select! {
        result = client_to_server => {
            if let Err(e) = result {
                debug!("Client to server copy ended: {}", e);
            }
        }
        result = server_to_client => {
            if let Err(e) = result {
                debug!("Server to client copy ended: {}", e);
            }
        }
    }

    Ok(())
}

/// Check if a header is a hop-by-hop header that shouldn't be proxied.
fn is_hop_by_hop_header(name: &str) -> bool {
    matches!(
        name.to_lowercase().as_str(),
        "connection"
            | "keep-alive"
            | "proxy-authenticate"
            | "proxy-authorization"
            | "te"
            | "trailer"
            | "transfer-encoding"
            | "upgrade"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_local_proxy_endpoints() {
        let proxy = LocalProxy::new();

        // Register endpoint
        proxy.register_endpoint("app", ProxyEndpoint {
            name: "My App".to_string(),
            local_addr: "localhost:8080".to_string(),
            protocol: "http".to_string(),
        }).await;

        // Get endpoint
        let endpoint = proxy.get_endpoint("app").await;
        assert!(endpoint.is_some());
        assert_eq!(endpoint.unwrap().local_addr, "localhost:8080");

        // List endpoints
        let endpoints = proxy.list_endpoints().await;
        assert_eq!(endpoints.len(), 1);

        // Unregister endpoint
        proxy.unregister_endpoint("app").await;
        let endpoint = proxy.get_endpoint("app").await;
        assert!(endpoint.is_none());
    }
}
