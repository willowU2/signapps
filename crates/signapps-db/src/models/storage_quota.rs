//! Storage quota models.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Storage quota record for a user.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct StorageQuota {
    pub user_id: Uuid,
    /// Maximum storage in bytes (None = unlimited)
    pub max_storage_bytes: Option<i64>,
    /// Maximum number of files (None = unlimited)
    pub max_files: Option<i64>,
    /// Maximum file size in bytes (None = unlimited)
    pub max_file_size_bytes: Option<i64>,
    /// Current used storage in bytes
    pub used_storage_bytes: i64,
    /// Current number of files
    pub file_count: i64,
    /// Allowed buckets (None = all allowed)
    pub allowed_buckets: Option<Vec<String>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to set (upsert) a user's quota limits.
#[derive(Debug, Clone, Deserialize)]
pub struct SetQuotaLimits {
    pub max_storage_bytes: Option<i64>,
    pub max_files: Option<i64>,
    pub max_file_size_bytes: Option<i64>,
    pub allowed_buckets: Option<Vec<String>>,
}

/// Request to update a user's used bytes and file count directly.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateQuotaUsage {
    pub used_storage_bytes: i64,
    pub file_count: i64,
}
