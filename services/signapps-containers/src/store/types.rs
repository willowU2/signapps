use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

// ── Database model ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a app source.
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
/// Represents a app install group.
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

#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
/// Represents a store app.
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

#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
/// Represents a source info.
pub struct SourceInfo {
    pub source_id: Uuid,
    pub source_name: String,
}

// ── App store index.json format ─────────────────────────────────

/// Top-level structure of an app store index.json.
/// Format: { "source": "...", "showcase": [...], "all": [...] }
#[derive(Debug, Deserialize)]
pub struct AppStoreIndex {
    pub all: Option<Vec<AppStoreMeta>>,
}

#[derive(Debug, Deserialize)]
/// Represents a app store meta.
pub struct AppStoreMeta {
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

// ── Compose / docker-compose parsed types ───────────────────────

#[derive(Debug, Clone, Deserialize)]
/// Represents a compose spec.
pub struct ComposeSpec {
    pub services: Option<HashMap<String, ComposeService>>,
}

#[derive(Debug, Clone, Deserialize)]
/// ComposeService implementation.
pub struct ComposeService {
    pub image: Option<String>,
    pub container_name: Option<String>,
    pub restart: Option<String>,
    pub environment: Option<ComposeEnv>,
    pub ports: Option<Vec<serde_json::Value>>,
    pub volumes: Option<Vec<ComposeVolume>>,
    pub labels: Option<ComposeLabels>,
    pub command: Option<ComposeCommand>,
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
pub enum ComposeLabels {
    Map(HashMap<String, serde_json::Value>),
    List(Vec<String>),
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
/// Enum representing ComposeEnv variants.
pub enum ComposeEnv {
    List(Vec<String>),
    Map(HashMap<String, serde_json::Value>),
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
/// Enum representing ComposeVolume variants.
pub enum ComposeVolume {
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
/// Enum representing ComposeCommand variants.
pub enum ComposeCommand {
    String(String),
    List(Vec<String>),
}

// ── Parsed config (ready for install form) ──────────────────────

#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
/// Configuration for ParsedApp.
pub struct ParsedAppConfig {
    pub services: Vec<ParsedService>,
}

#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
/// ParsedService implementation.
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

#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
/// Represents a env var.
pub struct EnvVar {
    pub key: String,
    pub default: Option<String>,
}

#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
/// Represents a app port.
pub struct AppPort {
    pub host: u16,
    pub container: u16,
    pub protocol: String,
}

#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
/// Represents a app volume.
pub struct AppVolume {
    pub source: String,
    pub target: String,
    pub read_only: bool,
}

// ── API request / response types ────────────────────────────────

/// Single-service install request (backwards-compatible).
#[derive(Debug, Deserialize, utoipa::ToSchema)]
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
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct MultiServiceInstallRequest {
    pub app_id: String,
    pub source_id: Uuid,
    pub group_name: String,
    pub services: Vec<ServiceOverride>,
    pub auto_start: Option<bool>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// ServiceOverride implementation.
pub struct ServiceOverride {
    pub service_name: String,
    pub container_name: String,
    pub environment: Option<HashMap<String, String>>,
    pub ports: Option<Vec<PortOverride>>,
    pub volumes: Option<Vec<VolumeOverride>>,
    pub labels: Option<HashMap<String, String>>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Represents a port override.
pub struct PortOverride {
    pub host: u16,
    pub container: u16,
    pub protocol: Option<String>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Represents a volume override.
pub struct VolumeOverride {
    pub source: String,
    pub target: String,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for AddSource operation.
pub struct AddSourceRequest {
    pub name: String,
    pub url: String,
}

#[derive(Debug, Deserialize)]
/// Query parameters for filtering and pagination.
pub struct ListAppsQuery {
    pub search: Option<String>,
    pub category: Option<String>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Represents a app details.
pub struct AppDetails {
    #[serde(flatten)]
    pub app: StoreApp,
    pub config: ParsedAppConfig,
}

#[derive(Debug, Deserialize)]
/// Query parameters for filtering and pagination.
pub struct CheckPortsQuery {
    pub ports: String,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Represents a port conflict.
pub struct PortConflict {
    pub port: u16,
    pub in_use: bool,
    pub used_by: Option<String>,
}

#[derive(Debug, Serialize)]
/// Represents a source validation.
#[derive(utoipa::ToSchema)]
pub struct SourceValidation {
    pub valid: bool,
    pub app_count: Option<usize>,
    pub error: Option<String>,
}

/// SSE install progress events.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum InstallEvent {
    Started {
        install_id: Uuid,
        service_count: usize,
    },
    PullingImage {
        service_name: String,
        image: String,
    },
    ImagePulled {
        service_name: String,
    },
    CreatingContainer {
        service_name: String,
    },
    ContainerCreated {
        service_name: String,
        container_name: String,
    },
    Starting {
        service_name: String,
    },
    ServiceReady {
        service_name: String,
    },
    Complete {
        install_id: Uuid,
    },
    Error {
        message: String,
    },
}

/// Response for install initiation.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct InstallStarted {
    pub install_id: Uuid,
}

/// Query params for SSE progress.
#[derive(Debug, Deserialize)]
pub struct ProgressQuery {
    pub token: Option<String>,
}
