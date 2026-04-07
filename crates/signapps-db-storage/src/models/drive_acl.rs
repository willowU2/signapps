//! Drive audit log and alert configuration models.
//!
//! ACL grant models have been removed; permission management is now handled
//! exclusively by the `signapps-sharing` crate.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Forensic audit log entry.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct DriveAuditLog {
    pub id: Uuid,
    pub node_id: Option<Uuid>,
    pub node_path: String,
    pub action: String,
    pub actor_id: Uuid,
    pub actor_ip: Option<String>,
    pub actor_geo: Option<String>,
    pub file_hash: Option<String>,
    pub details: Option<serde_json::Value>,
    pub prev_log_hash: Option<String>,
    pub log_hash: String,
    pub created_at: Option<DateTime<Utc>>,
}

/// Filters for querying audit log entries.
#[derive(Debug, Default)]
pub struct AuditLogFilters {
    pub node_id: Option<Uuid>,
    pub actor_id: Option<Uuid>,
    pub action: Option<String>,
    pub since: Option<DateTime<Utc>>,
    pub until: Option<DateTime<Utc>>,
}

/// Audit alert configuration.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AuditAlertConfig {
    pub id: Uuid,
    pub org_id: Uuid,
    pub alert_type: String,
    pub threshold: serde_json::Value,
    pub enabled: Option<bool>,
    pub notify_emails: Option<Vec<String>>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

/// Request to update an alert configuration.
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateAlertConfig {
    pub threshold: Option<serde_json::Value>,
    pub enabled: Option<bool>,
    pub notify_emails: Option<Vec<String>>,
}

/// Audit chain integrity verification result.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ChainVerification {
    pub valid: bool,
    pub total_entries: i64,
    pub first_corrupt_index: Option<i64>,
}
