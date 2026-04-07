//! VPN device models for SecureLink mesh network.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// VPN device entity.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Device {
    pub id: Uuid,
    pub name: String,
    pub nickname: Option<String>,
    pub public_key: String,
    pub ip_address: String,
    pub is_lighthouse: bool,
    pub is_relay: bool,
    pub blocked: bool,
    pub last_seen: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Create device request.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateDevice {
    pub name: String,
    pub nickname: Option<String>,
    #[serde(default)]
    pub is_lighthouse: bool,
    #[serde(default)]
    pub is_relay: bool,
}

/// Update device request.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateDevice {
    pub nickname: Option<String>,
    pub blocked: Option<bool>,
    pub is_lighthouse: Option<bool>,
    pub is_relay: Option<bool>,
}

/// Enrollment response with config.
#[derive(Debug, Clone, Serialize)]
pub struct EnrollmentResponse {
    pub device_id: Uuid,
    pub name: String,
    pub ip_address: String,
    pub config: MeshConfig,
}

/// Mesh VPN configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshConfig {
    /// PKI configuration.
    pub pki: PkiConfig,
    /// Static hosts mapping (lighthouse_ip -> [public_endpoints]).
    pub static_host_map: std::collections::HashMap<String, Vec<String>>,
    /// Lighthouse configuration.
    pub lighthouse: LighthouseConfig,
    /// Listen configuration.
    pub listen: ListenConfig,
    /// Punchy (NAT traversal) configuration.
    pub punchy: PunchyConfig,
    /// Firewall configuration.
    pub firewall: FirewallConfig,
}

/// PKI configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PkiConfig {
    /// CA certificate path or PEM.
    pub ca: String,
    /// Device certificate path or PEM.
    pub cert: String,
    /// Device private key path or PEM.
    pub key: String,
}

/// Lighthouse configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LighthouseConfig {
    /// Whether this device is a lighthouse.
    pub am_lighthouse: bool,
    /// Whether to serve DNS.
    #[serde(default)]
    pub serve_dns: bool,
    /// DNS configuration (if serve_dns is true).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dns: Option<DnsConfig>,
    /// Heartbeat interval in seconds.
    pub interval: i32,
    /// List of lighthouse VPN IPs.
    pub hosts: Vec<String>,
}

/// DNS configuration for lighthouse.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsConfig {
    pub host: String,
    pub port: i32,
}

/// Listen configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListenConfig {
    pub host: String,
    pub port: i32,
}

/// Punchy (NAT traversal) configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PunchyConfig {
    pub punch: bool,
    pub respond: bool,
    /// Delay before punching.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub delay: Option<String>,
}

/// Firewall configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FirewallConfig {
    /// Connection tracking configuration.
    pub conntrack: ConntrackConfig,
    /// Outbound rules.
    pub outbound: Vec<FirewallRule>,
    /// Inbound rules.
    pub inbound: Vec<FirewallRule>,
}

/// Connection tracking configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConntrackConfig {
    pub tcp_timeout: String,
    pub udp_timeout: String,
    pub default_timeout: String,
}

/// Firewall rule.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FirewallRule {
    pub port: String,
    pub proto: String,
    pub host: String,
    /// Optional groups filter.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub groups: Option<Vec<String>>,
}

/// VPN status.
#[derive(Debug, Clone, Serialize)]
pub struct VpnStatus {
    pub running: bool,
    pub lighthouse_reachable: bool,
    pub connected_devices: i32,
    pub network_cidr: String,
}

/// Certificate authority info.
#[derive(Debug, Clone, Serialize)]
pub struct CaInfo {
    pub name: String,
    pub fingerprint: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}
