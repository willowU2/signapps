use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

// ── Database model ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct AppSource {
    pub id: Uuid,
    pub name: String,
    pub url: String,
    pub enabled: bool,
    pub last_fetched: Option<DateTime<Utc>>,
    pub app_count: i32,
    pub last_error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct AppInstallGroup {
    pub id: Uuid,
    pub app_id: String,
    pub app_name: String,
    pub source_id: Option<Uuid>,
    pub network_name: Option<String>,
    pub owner_id: Option<Uuid>,
    pub status: String,
    pub service_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Store app (metadata shown in the catalog) ───────────────────

#[derive(Debug, Clone, Serialize)]
pub struct StoreApp {
    pub id: String,
    pub name: String,
    pub description: String,
    pub long_description: String,
    pub icon: String,
    pub tags: Vec<String>,
    pub supported_architectures: Vec<String>,
    pub compose_url: String,
    pub source_id: Uuid,
    pub source_name: String,
    pub image: String,
    pub repository: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub other_sources: Vec<SourceInfo>,
    #[serde(skip_serializing_if = "is_zero")]
    pub duplicate_count: usize,
}

fn is_zero(v: &usize) -> bool {
    *v == 0
}

#[derive(Debug, Clone, Serialize)]
pub struct SourceInfo {
    pub source_id: Uuid,
    pub source_name: String,
}

// ── Cosmos index.json format ────────────────────────────────────

/// Top-level structure of a Cosmos-format index.json.
/// Format: { "source": "...", "showcase": [...], "all": [...] }
#[derive(Debug, Deserialize)]
pub struct CosmosIndex {
    pub all: Option<Vec<CosmosAppMeta>>,
}

#[derive(Debug, Deserialize)]
pub struct CosmosAppMeta {
    pub id: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
    #[serde(alias = "longDescription")]
    pub long_description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub icon: Option<String>,
    pub compose: Option<String>,
    pub supported_architectures: Option<Vec<String>>,
    pub repository: Option<String>,
    pub image: Option<String>,
}

// ── Cosmos-compose / docker-compose parsed types ────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct CosmosCompose {
    pub services: Option<HashMap<String, CosmosService>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CosmosService {
    pub image: Option<String>,
    pub container_name: Option<String>,
    pub restart: Option<String>,
    pub environment: Option<CosmosEnv>,
    pub ports: Option<Vec<serde_json::Value>>,
    pub volumes: Option<Vec<CosmosVolume>>,
    pub labels: Option<CosmosLabels>,
    pub command: Option<CosmosCommand>,
    pub hostname: Option<String>,
    pub depends_on: Option<serde_json::Value>,
    #[allow(dead_code)]
    pub networks: Option<serde_json::Value>,
    #[allow(dead_code)]
    #[serde(flatten)]
    pub extra: serde_json::Value,
}

/// Labels can be a map {"key": "value"} or an array ["key=value"].
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum CosmosLabels {
    Map(HashMap<String, serde_json::Value>),
    List(Vec<String>),
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum CosmosEnv {
    List(Vec<String>),
    Map(HashMap<String, serde_json::Value>),
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum CosmosVolume {
    Short(String),
    Long {
        source: Option<String>,
        target: String,
        #[serde(rename = "type")]
        #[allow(dead_code)]
        vol_type: Option<String>,
        read_only: Option<bool>,
    },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum CosmosCommand {
    String(String),
    List(Vec<String>),
}

// ── Parsed config (ready for install form) ──────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct ParsedAppConfig {
    pub services: Vec<ParsedService>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ParsedService {
    pub service_name: String,
    pub image: String,
    pub container_name: Option<String>,
    pub restart: String,
    pub environment: Vec<EnvVar>,
    pub ports: Vec<AppPort>,
    pub volumes: Vec<AppVolume>,
    pub command: Option<Vec<String>>,
    pub labels: HashMap<String, String>,
    pub hostname: Option<String>,
    pub depends_on: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct EnvVar {
    pub key: String,
    pub default: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppPort {
    pub host: u16,
    pub container: u16,
    pub protocol: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppVolume {
    pub source: String,
    pub target: String,
    pub read_only: bool,
}

// ── API request / response types ────────────────────────────────

/// Single-service install request (backwards-compatible).
#[derive(Debug, Deserialize)]
pub struct InstallRequest {
    pub app_id: String,
    pub source_id: Uuid,
    pub container_name: String,
    pub environment: Option<HashMap<String, String>>,
    pub ports: Option<Vec<PortOverride>>,
    pub volumes: Option<Vec<VolumeOverride>>,
    pub labels: Option<HashMap<String, String>>,
    pub auto_start: Option<bool>,
}

/// Multi-service install request.
#[derive(Debug, Deserialize)]
pub struct MultiServiceInstallRequest {
    pub app_id: String,
    pub source_id: Uuid,
    pub group_name: String,
    pub services: Vec<ServiceOverride>,
    pub auto_start: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ServiceOverride {
    pub service_name: String,
    pub container_name: String,
    pub environment: Option<HashMap<String, String>>,
    pub ports: Option<Vec<PortOverride>>,
    pub volumes: Option<Vec<VolumeOverride>>,
    pub labels: Option<HashMap<String, String>>,
}

#[derive(Debug, Deserialize)]
pub struct PortOverride {
    pub host: u16,
    pub container: u16,
    pub protocol: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct VolumeOverride {
    pub source: String,
    pub target: String,
}

#[derive(Debug, Deserialize)]
pub struct AddSourceRequest {
    pub name: String,
    pub url: String,
}

#[derive(Debug, Deserialize)]
pub struct ListAppsQuery {
    pub search: Option<String>,
    pub category: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AppDetails {
    #[serde(flatten)]
    pub app: StoreApp,
    pub config: ParsedAppConfig,
}

#[derive(Debug, Deserialize)]
pub struct CheckPortsQuery {
    pub ports: String,
}

#[derive(Debug, Serialize)]
pub struct PortConflict {
    pub port: u16,
    pub in_use: bool,
    pub used_by: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SourceValidation {
    pub valid: bool,
    pub app_count: Option<usize>,
    pub error: Option<String>,
}

/// SSE install progress events.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum InstallEvent {
    Started { install_id: Uuid, service_count: usize },
    PullingImage { service_name: String, image: String },
    ImagePulled { service_name: String },
    CreatingContainer { service_name: String },
    ContainerCreated { service_name: String, container_name: String },
    Starting { service_name: String },
    ServiceReady { service_name: String },
    Complete { install_id: Uuid },
    Error { message: String },
}

/// Response for install initiation.
#[derive(Debug, Serialize)]
pub struct InstallStarted {
    pub install_id: Uuid,
}

/// Query params for SSE progress.
#[derive(Debug, Deserialize)]
pub struct ProgressQuery {
    pub token: Option<String>,
}
