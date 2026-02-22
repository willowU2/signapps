//! Storage Tier 3 SQLx Models (Sharing)

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Corresponds to the `storage.shares` database table
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Share {
    pub id: Uuid,
    pub bucket: String,
    pub key: String,
    pub token: String,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub password_hash: Option<String>,
    pub max_downloads: Option<i32>,
    pub download_count: i32,
    pub access_type: String,
    pub is_active: bool,
}
