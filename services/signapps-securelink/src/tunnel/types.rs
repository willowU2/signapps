#![allow(dead_code)]
//! Types for tunnel management.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Status of a tunnel connection.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TunnelStatus {
    /// Tunnel is connected and working
    Connected,
    /// Tunnel is disconnected
    #[default]
    Disconnected,
    /// Tunnel is attempting to connect
    Connecting,
    /// Tunnel encountered an error
    Error,
}

/// Status of a relay connection.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RelayStatus {
    /// Relay is online and reachable
    Online,
    /// Relay is offline or unreachable
    #[default]
    Offline,
    /// Relay connection is being tested
    Testing,
}

/// A tunnel configuration for exposing a local service.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tunnel {
    /// Unique identifier.
    pub id: Uuid,
    /// Human-readable name.
    pub name: String,
    /// Local address to proxy to (e.g., "localhost:8080").
    pub local_addr: String,
    /// Subdomain for the tunnel (e.g., "app" -> app.home.domain.com).
    pub subdomain: String,
    /// Current connection status.
    #[serde(default)]
    pub status: TunnelStatus,
    /// Associated relay ID.
    pub relay_id: Uuid,
    /// Protocol type (http, tcp, udp).
    #[serde(default = "default_protocol")]
    pub protocol: String,
    /// Whether the tunnel is enabled.
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// Last error message if any.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    /// Last time the tunnel was connected.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_connected: Option<DateTime<Utc>>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

fn default_protocol() -> String {
    "http".to_string()
}

fn default_true() -> bool {
    true
}

/// Request to create a new tunnel.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateTunnel {
    /// Human-readable name.
    pub name: String,
    /// Local address to proxy to.
    pub local_addr: String,
    /// Subdomain for the tunnel.
    pub subdomain: String,
    /// Relay ID to use.
    pub relay_id: Uuid,
    /// Protocol type (optional, defaults to "http").
    #[serde(default = "default_protocol")]
    pub protocol: String,
}

/// Request to update a tunnel.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateTunnel {
    /// New name (optional).
    pub name: Option<String>,
    /// New local address (optional).
    pub local_addr: Option<String>,
    /// Enable/disable tunnel (optional).
    pub enabled: Option<bool>,
}

/// A relay/beacon server configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Relay {
    /// Unique identifier.
    pub id: Uuid,
    /// Human-readable name.
    pub name: String,
    /// WebSocket URL for the relay (e.g., "wss://relay.example.com").
    pub url: String,
    /// Authentication token.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    /// Whether this is the primary relay.
    #[serde(default)]
    pub is_primary: bool,
    /// Current connection status.
    #[serde(default)]
    pub status: RelayStatus,
    /// Region/location of the relay.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub region: Option<String>,
    /// Latency in milliseconds (from last test).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency_ms: Option<u32>,
    /// Last time relay was tested.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_tested: Option<DateTime<Utc>>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
}

/// Request to create a new relay.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateRelay {
    /// Human-readable name.
    pub name: String,
    /// WebSocket URL for the relay.
    pub url: String,
    /// Authentication token.
    pub token: Option<String>,
    /// Whether this is the primary relay.
    #[serde(default)]
    pub is_primary: bool,
    /// Region/location of the relay.
    pub region: Option<String>,
}

/// Request to update a relay.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateRelay {
    /// New name (optional).
    pub name: Option<String>,
    /// New URL (optional).
    pub url: Option<String>,
    /// New token (optional).
    pub token: Option<String>,
    /// Set as primary (optional).
    pub is_primary: Option<bool>,
}

/// Result of testing a relay connection.
#[derive(Debug, Clone, Serialize)]
pub struct RelayTestResult {
    /// Whether the relay is reachable.
    pub success: bool,
    /// Latency in milliseconds.
    pub latency_ms: Option<u32>,
    /// Error message if test failed.
    pub error: Option<String>,
    /// Relay version (if available).
    pub version: Option<String>,
}

/// DNS configuration for the tunnel service.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsServiceConfig {
    /// Whether DNS service is enabled.
    #[serde(default)]
    pub enabled: bool,
    /// Upstream DNS servers.
    #[serde(default)]
    pub upstream: Vec<String>,
    /// Whether ad-blocking is enabled.
    #[serde(default)]
    pub adblock_enabled: bool,
    /// Custom DNS records.
    #[serde(default)]
    pub custom_records: Vec<DnsRecord>,
    /// Listen address for DNS server.
    #[serde(default = "default_dns_listen")]
    pub listen_addr: String,
    /// Cache TTL in seconds.
    #[serde(default = "default_cache_ttl")]
    pub cache_ttl: u32,
}

fn default_dns_listen() -> String {
    "0.0.0.0:53".to_string()
}

fn default_cache_ttl() -> u32 {
    300
}

impl Default for DnsServiceConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            upstream: vec![
                "1.1.1.1".to_string(),
                "8.8.8.8".to_string(),
            ],
            adblock_enabled: false,
            custom_records: Vec::new(),
            listen_addr: default_dns_listen(),
            cache_ttl: default_cache_ttl(),
        }
    }
}

/// A custom DNS record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsRecord {
    /// Record name (e.g., "app.local").
    pub name: String,
    /// Record type (A, AAAA, CNAME, TXT).
    pub record_type: String,
    /// Record value.
    pub value: String,
    /// TTL in seconds.
    #[serde(default = "default_record_ttl")]
    pub ttl: u32,
}

fn default_record_ttl() -> u32 {
    3600
}

/// A DNS blocklist configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsBlocklist {
    /// Unique identifier.
    pub id: Uuid,
    /// Human-readable name.
    pub name: String,
    /// URL to fetch the blocklist from.
    pub url: String,
    /// Whether this blocklist is enabled.
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// Number of blocked domains.
    #[serde(default)]
    pub domain_count: u32,
    /// Last time the list was updated.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_updated: Option<DateTime<Utc>>,
}

/// Request to create a blocklist.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateBlocklist {
    /// Human-readable name.
    pub name: String,
    /// URL to fetch the blocklist from.
    pub url: String,
    /// Whether this blocklist is enabled.
    #[serde(default = "default_true")]
    pub enabled: bool,
}

/// DNS statistics.
#[derive(Debug, Clone, Serialize, Default)]
pub struct DnsStats {
    /// Total queries received.
    pub total_queries: u64,
    /// Queries blocked by ad-blocking.
    pub blocked_queries: u64,
    /// Cache hit count.
    pub cache_hits: u64,
    /// Cache miss count.
    pub cache_misses: u64,
    /// Average response time in milliseconds.
    pub avg_response_ms: f64,
    /// Top blocked domains.
    pub top_blocked: Vec<BlockedDomainStat>,
    /// Queries per hour (last 24h).
    pub queries_per_hour: Vec<u64>,
}

/// Statistics for a blocked domain.
#[derive(Debug, Clone, Serialize)]
pub struct BlockedDomainStat {
    /// Domain name.
    pub domain: String,
    /// Number of times blocked.
    pub count: u64,
}

/// Message sent over WebSocket to relay.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TunnelMessage {
    /// Authentication message.
    Auth {
        token: String,
        tunnels: Vec<TunnelRegistration>,
    },
    /// Authentication response.
    AuthResponse {
        success: bool,
        error: Option<String>,
    },
    /// Incoming request from relay.
    Request {
        request_id: String,
        tunnel_id: String,
        method: String,
        path: String,
        headers: Vec<(String, String)>,
        body: Option<Vec<u8>>,
    },
    /// Response to send back to relay.
    Response {
        request_id: String,
        status: u16,
        headers: Vec<(String, String)>,
        body: Option<Vec<u8>>,
    },
    /// TCP data packet.
    TcpData {
        connection_id: String,
        data: Vec<u8>,
    },
    /// TCP connection closed.
    TcpClose {
        connection_id: String,
    },
    /// Ping/keepalive.
    Ping {
        timestamp: u64,
    },
    /// Pong response.
    Pong {
        timestamp: u64,
    },
    /// Error message.
    Error {
        message: String,
    },
}

/// Tunnel registration info sent to relay.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TunnelRegistration {
    /// Tunnel ID.
    pub id: String,
    /// Subdomain.
    pub subdomain: String,
    /// Protocol.
    pub protocol: String,
}
