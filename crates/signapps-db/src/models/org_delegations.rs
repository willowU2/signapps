//! Models for org management delegations.
//!
//! Covers the `workforce_org_delegations` table created by migration 208.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

// ============================================================================
// Org Delegation
// ============================================================================

/// A temporary or permanent delegation of management authority.
///
/// Allows a manager (`delegator_id`) to grant another entity (`delegate_id`)
/// scoped access to act on their behalf within a specific org subtree.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct OrgDelegation {
    /// Unique identifier.
    pub id: Uuid,
    /// Tenant scope.
    pub tenant_id: Uuid,
    /// Person granting the delegation.
    pub delegator_id: Uuid,
    /// Type of the delegate entity (e.g. `"person"`, `"group"`).
    pub delegate_type: String,
    /// UUID of the entity receiving the delegation.
    pub delegate_id: Uuid,
    /// Org node whose subtree is the scope of the delegation (nullable).
    pub scope_node_id: Option<Uuid>,
    /// JSONB map of specific permissions granted.
    pub permissions: serde_json::Value,
    /// UUID of the person who actually created this delegation (for sub-delegations).
    pub delegated_by: Option<Uuid>,
    /// Depth in the delegation chain (0 = original, 1 = sub-delegation, ...).
    pub depth: i32,
    /// Parent delegation if this is a sub-delegation.
    pub parent_delegation_id: Option<Uuid>,
    /// When the delegation expires (null = permanent).
    pub expires_at: Option<DateTime<Utc>>,
    /// Whether the delegation is currently active.
    pub is_active: bool,
    /// Timestamp of record creation.
    pub created_at: DateTime<Utc>,
    /// Timestamp of last update.
    pub updated_at: DateTime<Utc>,
}

/// Request payload to create a new delegation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateDelegation {
    /// Person granting the delegation.
    pub delegator_id: Uuid,
    /// Type of the delegate entity (e.g. `"person"`, `"group"`).
    pub delegate_type: String,
    /// UUID of the entity receiving the delegation.
    pub delegate_id: Uuid,
    /// Org node whose subtree defines the scope.
    pub scope_node_id: Option<Uuid>,
    /// JSONB map of specific permissions granted.
    pub permissions: serde_json::Value,
    /// Optional parent delegation (for sub-delegations).
    pub parent_delegation_id: Option<Uuid>,
    /// Optional expiry timestamp.
    pub expires_at: Option<DateTime<Utc>>,
}

/// Request payload to update an existing delegation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateDelegation {
    /// Updated permissions map.
    pub permissions: Option<serde_json::Value>,
    /// Updated expiry timestamp.
    pub expires_at: Option<DateTime<Utc>>,
    /// Updated active flag.
    pub is_active: Option<bool>,
}
