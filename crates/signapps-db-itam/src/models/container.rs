//! Container and quota models.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Managed container entity.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Container {
    pub id: Uuid,
    pub docker_id: Option<String>,
    pub name: String,
    pub image: String,
    pub status: Option<String>,
    pub config: Option<serde_json::Value>,
    pub labels: Option<serde_json::Value>,
    pub auto_update: bool,
    pub owner_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Create container request.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateContainer {
    pub name: String,
    pub image: String,
    pub config: Option<serde_json::Value>,
    pub labels: Option<serde_json::Value>,
    pub auto_update: Option<bool>,
}

/// User quota for containers.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct UserQuota {
    pub user_id: Uuid,
    pub max_containers: i32,
    pub max_cpu_cores: f64,
    pub max_memory_mb: i32,
    pub max_storage_gb: i32,
    pub current_containers: i32,
    pub current_cpu_cores: f64,
    pub current_memory_mb: i32,
    pub current_storage_gb: i32,
    pub updated_at: DateTime<Utc>,
}

/// Update quota request.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateQuota {
    pub max_containers: Option<i32>,
    pub max_cpu_cores: Option<f64>,
    pub max_memory_mb: Option<i32>,
    pub max_storage_gb: Option<i32>,
}

/// Container status enum.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ContainerStatus {
    Created,
    Running,
    Paused,
    Restarting,
    Removing,
    Exited,
    Dead,
}
