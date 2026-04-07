//! Storage Tier 3 SQLx Models (Sharing)

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Corresponds to the `storage.shares` database table.
///
/// `created_at` and `download_count` are nullable in the DB (DEFAULT without NOT NULL),
/// so they are stored as `Option` here to match what sqlx::query_as! infers from the schema.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Share {
    pub id: Uuid,
    pub bucket: String,
    pub key: String,
    pub token: String,
    pub created_by: Uuid,
    /// Nullable in DB (has DEFAULT NOW() but no NOT NULL constraint).
    pub created_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub password_hash: Option<String>,
    pub max_downloads: Option<i32>,
    /// Nullable in DB (has DEFAULT 0 but no NOT NULL constraint).
    pub download_count: Option<i32>,
    pub access_type: String,
    pub is_active: bool,
}
