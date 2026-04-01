//! Drive ACL, audit log, and alert configuration models.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// ACL grant on a drive node.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct DriveAcl {
    pub id: Uuid,
    pub node_id: Uuid,
    pub grantee_type: String,
    pub grantee_id: Option<Uuid>,
    pub role: String,
    pub inherit: Option<bool>,
    pub granted_by: Uuid,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

/// Request to create an ACL grant.
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateAcl {
    pub grantee_type: String,
    pub grantee_id: Option<Uuid>,
    pub role: String,
    pub inherit: Option<bool>,
    pub expires_at: Option<DateTime<Utc>>,
}

/// Request to update an existing ACL grant.
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateAcl {
    pub role: Option<String>,
    pub inherit: Option<bool>,
    pub expires_at: Option<DateTime<Utc>>,
}

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

/// Effective ACL result after tree-walk resolution.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct EffectiveAcl {
    pub node_id: Uuid,
    pub user_id: Uuid,
    pub role: Option<String>,
    pub is_owner: bool,
    pub inherited_from: Option<Uuid>,
    pub grants: Vec<DriveAcl>,
}

/// Audit chain integrity verification result.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ChainVerification {
    pub valid: bool,
    pub total_entries: i64,
    pub first_corrupt_index: Option<i64>,
}
