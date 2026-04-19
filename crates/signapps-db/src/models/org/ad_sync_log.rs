//! Canonical `org_ad_sync_log` table — audit trail of every entry
//! processed by the AD synchronization engine.
//!
//! Each row corresponds to one DN in one direction during one
//! sync run (`run_id`). The structured `diff` payload makes the
//! debug-skill `ad-sync-debug` self-explanatory.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// One row in the AD sync audit log.
///
/// `direction` is one of `pull`, `push`. `status` is one of `ok`,
/// `skipped`, `conflict`, `error`. `diff` carries `{ before, after }`
/// or `{ conflict: ..., ad: ..., org: ... }` depending on `status`.
///
/// # Examples
///
/// ```ignore
/// let log = AdSyncLog {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: uuid::Uuid::new_v4(),
///     run_id: uuid::Uuid::new_v4(),
///     entry_dn: "CN=Alice,OU=Users,DC=ex,DC=com".into(),
///     direction: "pull".into(),
///     status: "ok".into(),
///     diff: serde_json::json!({"after":{"email":"alice@ex.com"}}),
///     error: None,
///     created_at: chrono::Utc::now(),
/// };
/// ```
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AdSyncLog {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Tenant concerné.
    pub tenant_id: Uuid,
    /// Run AD parent (corrélation entre les entrées d'un même cycle).
    pub run_id: Uuid,
    /// Distinguished Name LDAP traité.
    pub entry_dn: String,
    /// Direction (`pull` | `push`).
    pub direction: String,
    /// Status (`ok` | `skipped` | `conflict` | `error`).
    pub status: String,
    /// Diff structuré JSONB.
    pub diff: serde_json::Value,
    /// Message d'erreur quand `status = error`.
    pub error: Option<String>,
    /// Date d'enregistrement (UTC).
    pub created_at: DateTime<Utc>,
}
