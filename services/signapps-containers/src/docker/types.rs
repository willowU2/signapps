//! Docker-related types and DTOs.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Container creation configuration.
#[derive(Debug, Clone, Deserialize, Serialize, utoipa::ToSchema)]
pub struct ContainerConfig {
    /// Container name
    pub name: String,
    /// Docker image (e.g., "nginx:latest")
    pub image: String,
    /// Command to run
    pub cmd: Option<Vec<String>>,
    /// Environment variables
    pub env: Option<Vec<String>>,
    /// Port mappings (host:container)
    pub ports: Option<Vec<PortMapping>>,
    /// Volume mounts
    pub volumes: Option<Vec<VolumeMount>>,
    /// Labels
    pub labels: Option<HashMap<String, String>>,
    /// Restart policy
    pub restart_policy: Option<RestartPolicy>,
    /// Resource limits
    pub resources: Option<ResourceLimits>,
    /// Network mode
    pub network_mode: Option<String>,
    /// Networks to connect to
    pub networks: Option<Vec<String>>,
    /// Hostname
    pub hostname: Option<String>,
    /// Working directory
    pub working_dir: Option<String>,
    /// User
    pub user: Option<String>,
    /// Auto-update enabled
    pub auto_update: Option<bool>,
}

/// Port mapping configuration.
#[derive(Debug, Clone, Deserialize, Serialize, utoipa::ToSchema)]
pub struct PortMapping {
    /// Host port
    pub host: u16,
    /// Container port
    pub container: u16,
    /// Protocol (tcp/udp)
    #[serde(default = "default_protocol")]
    pub protocol: String,
    /// Host IP to bind
    pub host_ip: Option<String>,
}

fn default_protocol() -> String {
    "tcp".to_string()
}

/// Volume mount configuration.
#[derive(Debug, Clone, Deserialize, Serialize, utoipa::ToSchema)]
pub struct VolumeMount {
    /// Host path or volume name
    pub source: String,
    /// Container path
    pub target: String,
    /// Read-only mount
    #[serde(default)]
    pub read_only: bool,
}

/// Restart policy.
#[derive(Debug, Clone, Default, Deserialize, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "kebab-case")]
pub enum RestartPolicy {
    #[default]
    No,
    Always,
    OnFailure,
    UnlessStopped,
}

/// Resource limits for a container.
#[derive(Debug, Clone, Deserialize, Serialize, utoipa::ToSchema)]
pub struct ResourceLimits {
    /// CPU cores limit (e.g., 0.5 for half a core)
    pub cpu_cores: Option<f64>,
    /// Memory limit in MB
    pub memory_mb: Option<i64>,
    /// Memory swap limit in MB (-1 for unlimited)
    pub memory_swap_mb: Option<i64>,
}

/// Mount point information from Docker inspect.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct MountInfo {
    pub source: Option<String>,
    pub destination: String,
    pub mount_type: String,
    pub rw: bool,
}

/// Resource usage/limits from Docker inspect.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct ResourceInfo {
    pub memory_limit: Option<i64>,
    pub nano_cpus: Option<i64>,
    pub cpu_shares: Option<i64>,
}

/// Health check status from Docker inspect.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct HealthInfo {
    pub status: String,
    pub failing_streak: i64,
    pub test: Option<Vec<String>>,
}

/// Container information returned by Docker.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct ContainerInfo {
    pub id: String,
    pub name: String,
    pub image: String,
    pub status: String,
    pub state: String,
    pub created: String,
    pub ports: Vec<PortInfo>,
    pub labels: HashMap<String, String>,
    pub networks: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mounts: Option<Vec<MountInfo>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cmd: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entrypoint: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub working_dir: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hostname: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub restart_policy: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub restart_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resources: Option<ResourceInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub health: Option<HealthInfo>,
}

/// Port information.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct PortInfo {
    pub container_port: u16,
    pub host_port: Option<u16>,
    pub host_ip: Option<String>,
    pub protocol: String,
}

/// Container stats snapshot.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct ContainerStats {
    pub container_id: String,
    pub cpu_percent: f64,
    pub memory_usage_mb: f64,
    pub memory_limit_mb: f64,
    pub memory_percent: f64,
    pub network_rx_bytes: u64,
    pub network_tx_bytes: u64,
    pub block_read_bytes: u64,
    pub block_write_bytes: u64,
    pub pids: u64,
    pub timestamp: String,
}

/// Docker image information.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct ImageInfo {
    pub id: String,
    pub repo_tags: Vec<String>,
    pub size_mb: f64,
    pub created: String,
}

/// Image pull progress.
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize)]
pub struct PullProgress {
    pub status: String,
    pub progress: Option<String>,
    pub id: Option<String>,
}

/// Network information.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct NetworkInfo {
    pub id: String,
    pub name: String,
    pub driver: String,
    pub scope: String,
    pub internal: bool,
    pub containers: Vec<String>,
}

/// Volume information.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct VolumeInfo {
    pub name: String,
    pub driver: String,
    pub mountpoint: String,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}
