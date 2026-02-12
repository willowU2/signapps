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

#[derive(Debug, Deserialize)]
pub struct InstallRequest {
    pub app_id: String,
    pub source_id: Uuid,
    pub container_name: String,
    pub environment: Option<HashMap<String, String>>,
    pub ports: Option<Vec<PortOverride>>,
    pub volumes: Option<Vec<VolumeOverride>>,
    pub auto_start: Option<bool>,
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
