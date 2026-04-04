//! Models for the org structure audit log.
//!
//! Covers the `workforce_org_audit_log` table created by migration 122.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

// ============================================================================
// Org Audit Entry
// ============================================================================

/// A single forensic audit log entry for an org structure change.
///
/// Every mutation (create, update, delete, move) performed on org entities
/// must produce an entry to maintain a complete change history.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct OrgAuditEntry {
    /// Unique identifier of the log entry.
    pub id: Uuid,
    /// Tenant scope.
    pub tenant_id: Uuid,
    /// UUID of the user or system actor that performed the change.
    pub actor_id: Uuid,
    /// Type of the actor (e.g. `"user"`, `"system"`, `"service"`).
    pub actor_type: String,
    /// Action performed (e.g. `"create"`, `"update"`, `"delete"`, `"move"`).
    pub action: String,
    /// Entity type affected (e.g. `"org_node"`, `"assignment"`, `"group"`).
    pub entity_type: String,
    /// UUID of the entity that was affected.
    pub entity_id: Uuid,
    /// JSON diff of fields that changed.
    pub changes: serde_json::Value,
    /// Arbitrary metadata (e.g. request ID, IP address).
    pub metadata: Option<serde_json::Value>,
    /// Timestamp at which the event occurred.
    pub created_at: DateTime<Utc>,
}

/// Request payload to append an entry to the org audit log.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateAuditEntry {
    /// Tenant scope.
    pub tenant_id: Uuid,
    /// UUID of the actor performing the change.
    pub actor_id: Uuid,
    /// Type of the actor.
    pub actor_type: String,
    /// Action performed.
    pub action: String,
    /// Entity type affected.
    pub entity_type: String,
    /// UUID of the affected entity.
    pub entity_id: Uuid,
    /// JSON diff of changed fields.
    pub changes: serde_json::Value,
    /// Optional metadata.
    pub metadata: Option<serde_json::Value>,
}

// ============================================================================
// Audit Query (filter params)
// ============================================================================

/// Query filter parameters for searching the org audit log.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AuditQuery {
    /// Required: tenant to query.
    pub tenant_id: Uuid,
    /// Optional filter by entity type.
    pub entity_type: Option<String>,
    /// Optional filter by entity UUID.
    pub entity_id: Option<Uuid>,
    /// Optional filter by actor UUID.
    pub actor_id: Option<Uuid>,
    /// Optional filter by action name.
    pub action: Option<String>,
    /// Optional lower bound on `created_at`.
    pub from_date: Option<DateTime<Utc>>,
    /// Optional upper bound on `created_at`.
    pub to_date: Option<DateTime<Utc>>,
    /// Maximum number of results to return (default 50).
    pub limit: Option<i64>,
    /// Number of results to skip for pagination.
    pub offset: Option<i64>,
}
