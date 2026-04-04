//! Models for cross-functional org groups and membership.
//!
//! Covers the `workforce_org_groups` and `workforce_org_group_members` tables
//! created by migration 122.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

// ============================================================================
// Org Group
// ============================================================================

/// A cross-functional group that can span multiple org nodes.
///
/// Groups may be static (manually managed) or dynamic (rule-based via `filter`).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct OrgGroup {
    /// Unique identifier.
    pub id: Uuid,
    /// Tenant scope.
    pub tenant_id: Uuid,
    /// Display name of the group.
    pub name: String,
    /// Optional human-readable description.
    pub description: Option<String>,
    /// Discriminator (e.g. `"project"`, `"committee"`, `"distribution"`).
    pub group_type: String,
    /// JSONB filter definition for dynamic groups (null = static).
    pub filter: Option<serde_json::Value>,
    /// Optional node or person responsible for managing this group.
    pub managed_by: Option<Uuid>,
    /// Date from which membership is valid.
    pub valid_from: Option<NaiveDate>,
    /// Date after which membership expires.
    pub valid_until: Option<NaiveDate>,
    /// Entry lifecycle state: live, recycled, or tombstone.
    pub lifecycle_state: String,
    /// Extensible attributes (JSONB).
    pub attributes: serde_json::Value,
    /// Timestamp of record creation.
    pub created_at: DateTime<Utc>,
    /// Timestamp of last update.
    pub updated_at: DateTime<Utc>,
}

/// Request payload to create a new org group.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateOrgGroup {
    /// Display name of the group.
    pub name: String,
    /// Optional human-readable description.
    pub description: Option<String>,
    /// Discriminator (e.g. `"project"`, `"committee"`, `"distribution"`).
    pub group_type: String,
    /// JSONB filter definition for dynamic groups.
    pub filter: Option<serde_json::Value>,
    /// Optional managing node or person.
    pub managed_by: Option<Uuid>,
    /// Validity start date.
    pub valid_from: Option<NaiveDate>,
    /// Validity end date.
    pub valid_until: Option<NaiveDate>,
    /// Extensible attributes (JSONB).
    pub attributes: Option<serde_json::Value>,
}

/// Request payload to update an existing org group.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateOrgGroup {
    /// Updated display name.
    pub name: Option<String>,
    /// Updated description.
    pub description: Option<String>,
    /// Updated group type discriminator.
    pub group_type: Option<String>,
    /// Updated dynamic filter definition.
    pub filter: Option<serde_json::Value>,
    /// Updated managing node or person.
    pub managed_by: Option<Uuid>,
    /// Updated validity start date.
    pub valid_from: Option<NaiveDate>,
    /// Updated validity end date.
    pub valid_until: Option<NaiveDate>,
    /// Updated lifecycle state.
    pub lifecycle_state: Option<String>,
    /// Updated extensible attributes.
    pub attributes: Option<serde_json::Value>,
}

// ============================================================================
// Org Group Member
// ============================================================================

/// A member record within a cross-functional org group.
///
/// Members may be persons, nodes, or other groups (`member_type` discriminates).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct OrgGroupMember {
    /// Unique identifier.
    pub id: Uuid,
    /// Group this membership belongs to.
    pub group_id: Uuid,
    /// Type of the member entity (e.g. `"person"`, `"node"`, `"group"`).
    pub member_type: String,
    /// UUID of the member entity.
    pub member_id: Uuid,
    /// Whether this membership was added manually, overriding dynamic rules.
    pub is_manual_override: bool,
    /// Timestamp of record creation.
    pub created_at: DateTime<Utc>,
}

/// Request payload to add a member to an org group.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AddGroupMember {
    /// Type of the member entity (e.g. `"person"`, `"node"`, `"group"`).
    pub member_type: String,
    /// UUID of the member entity.
    pub member_id: Uuid,
    /// Whether this is a manual override of dynamic membership rules.
    pub is_manual_override: Option<bool>,
}

// ============================================================================
// Org Member Of (computed/cached membership)
// ============================================================================

/// A pre-computed or cached record indicating which groups a person belongs to.
///
/// Populated by background jobs or triggers that evaluate dynamic group filters.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct OrgMemberOf {
    /// Person whose membership is recorded.
    pub person_id: Uuid,
    /// Group the person belongs to.
    pub group_id: Uuid,
    /// Source that determined membership (e.g. `"dynamic"`, `"manual"`).
    pub source: String,
    /// Timestamp at which membership was last evaluated.
    pub computed_at: DateTime<Utc>,
}
