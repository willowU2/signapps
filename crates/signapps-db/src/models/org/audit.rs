//! Canonical `org_audit_log` table.
//!
//! Chaque INSERT/UPDATE/DELETE sur une table org_* auditée (nodes,
//! persons, assignments, positions, incumbents) génère un row via le
//! trigger SQL `org_audit_trigger()` installé par la migration 500.
//!
//! Les handlers applicatifs peuvent aussi écrire directement dans cette
//! table pour enrichir le contexte (ex: `actor_user_id` qui n'est pas
//! visible côté trigger SQL).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// One `org_audit_log` row.
///
/// `diff_json` a deux formes selon l'action :
/// - `insert` / `delete` : snapshot de la ligne (`to_jsonb(row)`).
/// - `update` : `{"before": {...}, "after": {...}}`.
///
/// # Examples
///
/// ```ignore
/// let e = AuditLogEntry {
///     id: 1,
///     tenant_id: uuid::Uuid::new_v4(),
///     actor_user_id: None,
///     entity_type: "org_nodes".into(),
///     entity_id: uuid::Uuid::new_v4(),
///     action: "update".into(),
///     diff_json: serde_json::json!({"before": {}, "after": {}}),
///     at: chrono::Utc::now(),
/// };
/// ```
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AuditLogEntry {
    /// Identifiant séquentiel (BIGSERIAL).
    pub id: i64,
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Acteur humain (facultatif — les triggers ne le connaissent pas).
    pub actor_user_id: Option<Uuid>,
    /// Nom de la table source (`org_nodes`, `org_persons`, ...).
    pub entity_type: String,
    /// Id de la ligne impactée.
    pub entity_id: Uuid,
    /// Action (`insert` | `update` | `delete`).
    pub action: String,
    /// Snapshot ou diff selon `action`.
    pub diff_json: serde_json::Value,
    /// Horodatage UTC.
    pub at: DateTime<Utc>,
}
