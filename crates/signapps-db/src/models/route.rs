//! Proxy route models.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Proxy route mode.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RouteMode {
    /// Standard reverse proxy.
    #[default]
    Proxy,
    /// Redirect to another URL.
    Redirect,
    /// Serve static files.
    Static,
    /// Load balancer.
    LoadBalancer,
}

/// SmartShield configuration for rate limiting.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ShieldConfig {
    /// Enable rate limiting.
    #[serde(default)]
    pub enabled: bool,
    /// Requests per second limit.
    #[serde(default = "default_rps")]
    pub requests_per_second: i32,
    /// Burst size.
    #[serde(default = "default_burst")]
    pub burst_size: i32,
    /// Block duration in seconds.
    #[serde(default = "default_block_duration")]
    pub block_duration_seconds: i32,
    /// Whitelist IPs.
    #[serde(default)]
    pub whitelist: Vec<String>,
    /// Blacklist IPs.
    #[serde(default)]
    pub blacklist: Vec<String>,
}

fn default_rps() -> i32 {
    100
}
fn default_burst() -> i32 {
    200
}
fn default_block_duration() -> i32 {
    300
}

/// Custom headers configuration.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HeadersConfig {
    /// Headers to add to requests.
    #[serde(default)]
    pub request_headers: Vec<HeaderEntry>,
    /// Headers to add to responses.
    #[serde(default)]
    pub response_headers: Vec<HeaderEntry>,
    /// Headers to remove from requests.
    #[serde(default)]
    pub remove_request_headers: Vec<String>,
    /// Headers to remove from responses.
    #[serde(default)]
    pub remove_response_headers: Vec<String>,
}

/// A single header entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeaderEntry {
    pub name: String,
    pub value: String,
}

/// Proxy route entity.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Route {
    pub id: Uuid,
    pub name: String,
    pub host: String,
    pub target: String,
    pub mode: String,
    pub tls_enabled: bool,
    pub auth_required: bool,
    pub shield_config: Option<serde_json::Value>,
    pub headers: Option<serde_json::Value>,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Route {
    /// Get the parsed shield config.
    pub fn get_shield_config(&self) -> Option<ShieldConfig> {
        self.shield_config
            .as_ref()
            .and_then(|v| serde_json::from_value(v.clone()).ok())
    }

    /// Get the parsed headers config.
    pub fn get_headers_config(&self) -> Option<HeadersConfig> {
        self.headers
            .as_ref()
            .and_then(|v| serde_json::from_value(v.clone()).ok())
    }
}

/// Create route request.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateRoute {
    pub name: String,
    pub host: String,
    pub target: String,
    #[serde(default)]
    pub mode: RouteMode,
    #[serde(default = "default_true")]
    pub tls_enabled: bool,
    #[serde(default)]
    pub auth_required: bool,
    pub shield_config: Option<ShieldConfig>,
    pub headers: Option<HeadersConfig>,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

/// Update route request.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateRoute {
    pub name: Option<String>,
    pub host: Option<String>,
    pub target: Option<String>,
    pub mode: Option<RouteMode>,
    pub tls_enabled: Option<bool>,
    pub auth_required: Option<bool>,
    pub shield_config: Option<ShieldConfig>,
    pub headers: Option<HeadersConfig>,
    pub enabled: Option<bool>,
}

/// Certificate info.
#[derive(Debug, Clone, Serialize)]
pub struct CertificateInfo {
    pub domain: String,
    pub issuer: String,
    pub valid_from: DateTime<Utc>,
    pub valid_until: DateTime<Utc>,
    pub auto_renew: bool,
}

/// Shield statistics.
#[derive(Debug, Clone, Serialize)]
pub struct ShieldStats {
    pub total_requests: u64,
    pub blocked_requests: u64,
    pub rate_limited: u64,
    pub active_blocks: u32,
}
