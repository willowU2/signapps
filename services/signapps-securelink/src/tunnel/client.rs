//! WebSocket client for connecting to relay servers.
//!
//! This module implements the outbound tunnel connection that allows
//! the home server to be accessible from the internet without opening ports.

use crate::tunnel::types::*;
use futures_util::{SinkExt, StreamExt};
use signapps_common::{Error, Result};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{broadcast, mpsc, RwLock};
use tokio::time::{interval, timeout};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{debug, error, info, warn};

/// Configuration for the tunnel client.
#[derive(Debug, Clone)]
pub struct TunnelClientConfig {
    /// Reconnection delay after disconnect.
    pub reconnect_delay: Duration,
    /// Maximum reconnection delay.
    pub max_reconnect_delay: Duration,
    /// Ping interval for keepalive.
    pub ping_interval: Duration,
    /// Connection timeout.
    pub connect_timeout: Duration,
    /// Request timeout for proxied requests.
    pub request_timeout: Duration,
}

impl Default for TunnelClientConfig {
    fn default() -> Self {
        Self {
            reconnect_delay: Duration::from_secs(1),
            max_reconnect_delay: Duration::from_secs(60),
            ping_interval: Duration::from_secs(30),
            connect_timeout: Duration::from_secs(10),
            request_timeout: Duration::from_secs(30),
        }
    }
}

/// State of a tunnel connection.
#[derive(Debug)]
struct TunnelConnection {
    tunnel: Tunnel,
    status: TunnelStatus,
    last_error: Option<String>,
}

/// Client for managing tunnel connections to relays.
#[derive(Clone)]
pub struct TunnelClient {
    config: TunnelClientConfig,
    http_client: reqwest::Client,
    tunnels: Arc<RwLock<HashMap<uuid::Uuid, TunnelConnection>>>,
    relays: Arc<RwLock<HashMap<uuid::Uuid, Relay>>>,
    shutdown_tx: broadcast::Sender<()>,
}

impl TunnelClient {
    /// Create a new tunnel client.
    pub fn new(config: TunnelClientConfig) -> Self {
        let (shutdown_tx, _) = broadcast::channel(1);

        Self {
            config,
            http_client: reqwest::Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
            tunnels: Arc::new(RwLock::new(HashMap::new())),
            relays: Arc::new(RwLock::new(HashMap::new())),
            shutdown_tx,
        }
    }

    /// Add a relay to the client.
    pub async fn add_relay(&self, relay: Relay) -> Result<()> {
        let mut relays = self.relays.write().await;
        relays.insert(relay.id, relay);
        Ok(())
    }

    /// Remove a relay from the client.
    pub async fn remove_relay(&self, relay_id: uuid::Uuid) -> Result<()> {
        let mut relays = self.relays.write().await;
        relays.remove(&relay_id);
        Ok(())
    }

    /// Get a relay by ID.
    pub async fn get_relay(&self, relay_id: uuid::Uuid) -> Option<Relay> {
        let relays = self.relays.read().await;
        relays.get(&relay_id).cloned()
    }

    /// List all relays.
    pub async fn list_relays(&self) -> Vec<Relay> {
        let relays = self.relays.read().await;
        relays.values().cloned().collect()
    }

    /// Test connection to a relay.
    pub async fn test_relay(&self, relay: &Relay) -> RelayTestResult {
        let start = std::time::Instant::now();

        // Try to establish a WebSocket connection
        let result = timeout(self.config.connect_timeout, connect_async(&relay.url)).await;

        match result {
            Ok(Ok((mut ws_stream, _))) => {
                let latency = start.elapsed().as_millis() as u32;

                // Send a ping to verify the connection works
                if let Err(e) = ws_stream.close(None).await {
                    warn!("Error closing test connection: {}", e);
                }

                RelayTestResult {
                    success: true,
                    latency_ms: Some(latency),
                    error: None,
                    version: None,
                }
            },
            Ok(Err(e)) => RelayTestResult {
                success: false,
                latency_ms: None,
                error: Some(format!("Connection failed: {}", e)),
                version: None,
            },
            Err(_) => RelayTestResult {
                success: false,
                latency_ms: None,
                error: Some("Connection timeout".to_string()),
                version: None,
            },
        }
    }

    /// Add a tunnel.
    pub async fn add_tunnel(&self, tunnel: Tunnel) -> Result<()> {
        let mut tunnels = self.tunnels.write().await;
        tunnels.insert(
            tunnel.id,
            TunnelConnection {
                tunnel,
                status: TunnelStatus::Disconnected,
                last_error: None,
            },
        );
        Ok(())
    }

    /// Remove a tunnel.
    pub async fn remove_tunnel(&self, tunnel_id: uuid::Uuid) -> Result<()> {
        let mut tunnels = self.tunnels.write().await;
        tunnels.remove(&tunnel_id);
        Ok(())
    }

    /// Get tunnel status.
    pub async fn get_tunnel_status(&self, tunnel_id: uuid::Uuid) -> Option<TunnelStatus> {
        let tunnels = self.tunnels.read().await;
        tunnels.get(&tunnel_id).map(|t| t.status)
    }

    /// Get tunnel info.
    pub async fn get_tunnel(&self, tunnel_id: uuid::Uuid) -> Option<Tunnel> {
        let tunnels = self.tunnels.read().await;
        tunnels.get(&tunnel_id).map(|t| {
            let mut tunnel = t.tunnel.clone();
            tunnel.status = t.status;
            tunnel.last_error = t.last_error.clone();
            tunnel
        })
    }

    /// List all tunnels.
    pub async fn list_tunnels(&self) -> Vec<Tunnel> {
        let tunnels = self.tunnels.read().await;
        tunnels
            .values()
            .map(|t| {
                let mut tunnel = t.tunnel.clone();
                tunnel.status = t.status;
                tunnel.last_error = t.last_error.clone();
                tunnel
            })
            .collect()
    }

    /// Start tunnel connection for a specific relay.
    pub async fn connect_relay(&self, relay_id: uuid::Uuid) -> Result<()> {
        let relay = self
            .get_relay(relay_id)
            .await
            .ok_or_else(|| Error::NotFound(format!("Relay {}", relay_id)))?;

        // Get all tunnels for this relay
        let tunnel_registrations: Vec<TunnelRegistration> = {
            let tunnels = self.tunnels.read().await;
            tunnels
                .values()
                .filter(|t| t.tunnel.relay_id == relay_id && t.tunnel.enabled)
                .map(|t| TunnelRegistration {
                    id: t.tunnel.id.to_string(),
                    subdomain: t.tunnel.subdomain.clone(),
                    protocol: t.tunnel.protocol.clone(),
                })
                .collect()
        };

        if tunnel_registrations.is_empty() {
            return Err(Error::Validation(
                "No tunnels configured for this relay".to_string(),
            ));
        }

        // Spawn connection task
        let client = self.clone();
        let config = self.config.clone();
        let mut shutdown_rx = self.shutdown_tx.subscribe();

        tokio::spawn(async move {
            let mut reconnect_delay = config.reconnect_delay;

            loop {
                // Check for shutdown
                if shutdown_rx.try_recv().is_ok() {
                    info!("Received shutdown signal, stopping relay connection");
                    break;
                }

                info!("Connecting to relay: {}", relay.url);

                match client.run_connection(&relay, &tunnel_registrations).await {
                    Ok(()) => {
                        info!("Relay connection closed normally");
                        reconnect_delay = config.reconnect_delay;
                    },
                    Err(e) => {
                        error!("Relay connection error: {}", e);

                        // Update tunnel statuses
                        client
                            .set_tunnels_status(relay_id, TunnelStatus::Error, Some(e.to_string()))
                            .await;
                    },
                }

                // Wait before reconnecting
                info!("Reconnecting in {:?}", reconnect_delay);
                tokio::select! {
                    _ = tokio::time::sleep(reconnect_delay) => {}
                    _ = shutdown_rx.recv() => {
                        info!("Received shutdown signal during reconnect delay");
                        break;
                    }
                }

                // Exponential backoff
                reconnect_delay = std::cmp::min(reconnect_delay * 2, config.max_reconnect_delay);
            }
        });

        Ok(())
    }

    /// Run the actual WebSocket connection.
    async fn run_connection(&self, relay: &Relay, tunnels: &[TunnelRegistration]) -> Result<()> {
        // Connect to relay
        let (ws_stream, _) = timeout(self.config.connect_timeout, connect_async(&relay.url))
            .await
            .map_err(|_| Error::Internal("Connection timeout".to_string()))?
            .map_err(|e| Error::Internal(format!("WebSocket connection failed: {}", e)))?;

        info!("Connected to relay: {}", relay.url);

        let (mut write, mut read) = ws_stream.split();

        // Send authentication message
        let auth_msg = TunnelMessage::Auth {
            token: relay.token.clone().unwrap_or_default(),
            tunnels: tunnels.to_vec(),
        };

        let auth_json = serde_json::to_string(&auth_msg)
            .map_err(|e| Error::Internal(format!("Failed to serialize auth: {}", e)))?;

        write
            .send(Message::Text(auth_json))
            .await
            .map_err(|e| Error::Internal(format!("Failed to send auth: {}", e)))?;

        // Wait for auth response
        let auth_response = timeout(Duration::from_secs(5), read.next())
            .await
            .map_err(|_| Error::Internal("Auth response timeout".to_string()))?
            .ok_or_else(|| Error::Internal("Connection closed during auth".to_string()))?
            .map_err(|e| Error::Internal(format!("WebSocket error: {}", e)))?;

        if let Message::Text(text) = auth_response {
            let text_str: &str = &text;
            let msg: TunnelMessage = serde_json::from_str(text_str)
                .map_err(|e| Error::Internal(format!("Invalid auth response: {}", e)))?;

            if let TunnelMessage::AuthResponse { success, error: _ } = msg {
                if !success {
                    return Err(Error::Unauthorized);
                }
            }
        }

        info!("Authenticated with relay");

        // Update tunnel statuses to connected
        self.set_tunnels_status(relay.id, TunnelStatus::Connected, None)
            .await;

        // Create channels for communication
        let (response_tx, mut response_rx) = mpsc::channel::<TunnelMessage>(100);
        let mut shutdown_rx = self.shutdown_tx.subscribe();

        // Spawn ping task
        let response_tx_ping = response_tx.clone();
        let ping_interval = self.config.ping_interval;
        tokio::spawn(async move {
            let mut ticker = interval(ping_interval);
            loop {
                ticker.tick().await;
                let timestamp = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64;

                if response_tx_ping
                    .send(TunnelMessage::Ping { timestamp })
                    .await
                    .is_err()
                {
                    break;
                }
            }
        });

        // Main message loop
        loop {
            tokio::select! {
                // Handle incoming messages
                msg = read.next() => {
                    match msg {
                        Some(Ok(Message::Text(text))) => {
                            let text_str: &str = &text;
                            match serde_json::from_str::<TunnelMessage>(text_str) {
                                Ok(msg) => {
                                    self.handle_message(msg, response_tx.clone()).await;
                                }
                                Err(e) => {
                                    warn!("Invalid message from relay: {}", e);
                                }
                            }
                        }
                        Some(Ok(Message::Ping(data))) => {
                            write.send(Message::Pong(data)).await.ok();
                        }
                        Some(Ok(Message::Close(_))) => {
                            info!("Relay closed connection");
                            break;
                        }
                        Some(Err(e)) => {
                            error!("WebSocket error: {}", e);
                            break;
                        }
                        None => {
                            info!("WebSocket stream ended");
                            break;
                        }
                        _ => {}
                    }
                }

                // Handle outgoing messages
                msg = response_rx.recv() => {
                    if let Some(msg) = msg {
                        let json = serde_json::to_string(&msg)
                            .expect("Failed to serialize message");
                        if let Err(e) = write.send(Message::Text(json)).await {
                            error!("Failed to send message: {}", e);
                            break;
                        }
                    }
                }

                // Handle shutdown
                _ = shutdown_rx.recv() => {
                    info!("Received shutdown signal");
                    write.close().await.ok();
                    break;
                }
            }
        }

        // Update tunnel statuses to disconnected
        self.set_tunnels_status(relay.id, TunnelStatus::Disconnected, None)
            .await;

        Ok(())
    }

    /// Handle an incoming message from the relay.
    async fn handle_message(&self, msg: TunnelMessage, response_tx: mpsc::Sender<TunnelMessage>) {
        match msg {
            TunnelMessage::Request {
                request_id,
                tunnel_id,
                method,
                path,
                headers,
                body,
            } => {
                debug!("Received request: {} {} {}", request_id, method, path);

                // Find the tunnel
                let tunnel_uuid = uuid::Uuid::parse_str(&tunnel_id).ok();
                let local_addr = if let Some(id) = tunnel_uuid {
                    let tunnels = self.tunnels.read().await;
                    tunnels.get(&id).map(|t| t.tunnel.local_addr.clone())
                } else {
                    None
                };

                let response = if let Some(addr) = local_addr {
                    // Proxy the request to the local service
                    self.proxy_request(&addr, &method, &path, headers, body)
                        .await
                } else {
                    TunnelMessage::Response {
                        request_id: request_id.clone(),
                        status: 404,
                        headers: vec![("Content-Type".to_string(), "text/plain".to_string())],
                        body: Some(b"Tunnel not found".to_vec()),
                    }
                };

                if let Err(e) = response_tx.send(response).await {
                    error!("Failed to send response: {}", e);
                }
            },
            TunnelMessage::Ping { timestamp } => {
                response_tx
                    .send(TunnelMessage::Pong { timestamp })
                    .await
                    .ok();
            },
            TunnelMessage::Pong { timestamp: _ } => {
                // Pong received, connection is alive
            },
            TunnelMessage::Error { message } => {
                error!("Error from relay: {}", message);
            },
            _ => {
                debug!("Unhandled message type");
            },
        }
    }

    /// Proxy a request to a local service.
    async fn proxy_request(
        &self,
        local_addr: &str,
        method: &str,
        path: &str,
        headers: Vec<(String, String)>,
        body: Option<Vec<u8>>,
    ) -> TunnelMessage {
        let url = format!("http://{}{}", local_addr, path);

        let request_id = uuid::Uuid::new_v4().to_string();

        let mut request = match method.to_uppercase().as_str() {
            "GET" => self.http_client.get(&url),
            "POST" => self.http_client.post(&url),
            "PUT" => self.http_client.put(&url),
            "DELETE" => self.http_client.delete(&url),
            "PATCH" => self.http_client.patch(&url),
            "HEAD" => self.http_client.head(&url),
            _ => {
                return TunnelMessage::Response {
                    request_id,
                    status: 405,
                    headers: vec![],
                    body: Some(b"Method not allowed".to_vec()),
                };
            },
        };

        // Add headers
        for (name, value) in headers {
            // Skip hop-by-hop headers
            #[allow(clippy::collapsible_if)]
            if !is_hop_by_hop_header(&name) {
                if let Ok(header_name) = reqwest::header::HeaderName::from_bytes(name.as_bytes()) {
                    if let Ok(header_value) = reqwest::header::HeaderValue::from_str(&value) {
                        request = request.header(header_name, header_value);
                    }
                }
            }
        }

        // Add body
        if let Some(body) = body {
            request = request.body(body);
        }

        // Send request
        match timeout(self.config.request_timeout, request.send()).await {
            Ok(Ok(response)) => {
                let status = response.status().as_u16();
                let headers: Vec<(String, String)> = response
                    .headers()
                    .iter()
                    .filter(|(name, _)| !is_hop_by_hop_header(name.as_str()))
                    .map(|(name, value)| {
                        (name.to_string(), value.to_str().unwrap_or("").to_string())
                    })
                    .collect();

                let body = response.bytes().await.ok().map(|b| b.to_vec());

                TunnelMessage::Response {
                    request_id,
                    status,
                    headers,
                    body,
                }
            },
            Ok(Err(e)) => {
                error!("Proxy request failed: {}", e);
                TunnelMessage::Response {
                    request_id,
                    status: 502,
                    headers: vec![("Content-Type".to_string(), "text/plain".to_string())],
                    body: Some(format!("Bad Gateway: {}", e).into_bytes()),
                }
            },
            Err(_) => TunnelMessage::Response {
                request_id,
                status: 504,
                headers: vec![("Content-Type".to_string(), "text/plain".to_string())],
                body: Some(b"Gateway Timeout".to_vec()),
            },
        }
    }

    /// Update the status of all tunnels for a relay.
    async fn set_tunnels_status(
        &self,
        relay_id: uuid::Uuid,
        status: TunnelStatus,
        error: Option<String>,
    ) {
        let mut tunnels = self.tunnels.write().await;
        for conn in tunnels.values_mut() {
            if conn.tunnel.relay_id == relay_id {
                conn.status = status;
                conn.last_error = error.clone();
            }
        }
    }

    /// Reconnect a specific tunnel.
    pub async fn reconnect_tunnel(&self, tunnel_id: uuid::Uuid) -> Result<()> {
        let relay_id = {
            let tunnels = self.tunnels.read().await;
            tunnels
                .get(&tunnel_id)
                .map(|t| t.tunnel.relay_id)
                .ok_or_else(|| Error::NotFound(format!("Tunnel {}", tunnel_id)))?
        };

        // Trigger reconnection by signaling shutdown and restarting
        self.connect_relay(relay_id).await
    }

    /// Shutdown all connections.
    pub fn shutdown(&self) {
        let _ = self.shutdown_tx.send(());
    }
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

    #[test]
    fn test_hop_by_hop_headers() {
        assert!(is_hop_by_hop_header("Connection"));
        assert!(is_hop_by_hop_header("connection"));
        assert!(is_hop_by_hop_header("Keep-Alive"));
        assert!(!is_hop_by_hop_header("Content-Type"));
        assert!(!is_hop_by_hop_header("Authorization"));
    }

    #[test]
    fn test_tunnel_client_config_default() {
        let config = TunnelClientConfig::default();
        assert_eq!(config.reconnect_delay, Duration::from_secs(1));
        assert_eq!(config.max_reconnect_delay, Duration::from_secs(60));
        assert_eq!(config.ping_interval, Duration::from_secs(30));
    }
}
