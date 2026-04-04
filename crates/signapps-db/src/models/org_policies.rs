//! Models for GPO-style org policies and their node/scope links.
//!
//! Covers the `workforce_org_policies`, `workforce_org_policy_links`, and
//! `workforce_country_policies` tables created by migration 206.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

// ============================================================================
// Org Policy
// ============================================================================

/// A GPO-style policy that can be linked to org nodes, groups, or countries.
///
/// Settings are stored as JSONB and merged down the org tree (deepest wins).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct OrgPolicy {
    /// Unique identifier.
    pub id: Uuid,
    /// Tenant scope.
    pub tenant_id: Uuid,
    /// Display name of the policy.
    pub name: String,
    /// Optional human-readable description.
    pub description: Option<String>,
    /// Policy domain (e.g. `"security"`, `"modules"`, `"naming"`, `"delegation"`,
    /// `"compliance"`, `"custom"`).
    pub domain: String,
    /// Merge precedence — higher value overrides lower.
    pub priority: i32,
    /// Whether this policy is enforced (non-overridable by child nodes).
    pub is_enforced: bool,
    /// Whether this policy is disabled (excluded from resolution).
    pub is_disabled: bool,
    /// Policy settings as JSONB.
    pub settings: serde_json::Value,
    /// Schema version for forward/backward compatibility.
    pub version: i32,
    /// Extensible attributes (JSONB).
    pub attributes: serde_json::Value,
    /// Timestamp of record creation.
    pub created_at: DateTime<Utc>,
    /// Timestamp of last update.
    pub updated_at: DateTime<Utc>,
}

/// Request payload to create a new org policy.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateOrgPolicy {
    /// Display name of the policy.
    pub name: String,
    /// Optional human-readable description.
    pub description: Option<String>,
    /// Policy domain (e.g. `"security"`, `"modules"`, `"naming"`, `"delegation"`,
    /// `"compliance"`, `"custom"`).
    pub domain: String,
    /// Merge precedence — higher value overrides lower.
    pub priority: Option<i32>,
    /// Whether this policy is enforced.
    pub is_enforced: Option<bool>,
    /// Policy settings as JSONB.
    pub settings: serde_json::Value,
}

/// Request payload to update an existing org policy.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateOrgPolicy {
    /// Updated display name.
    pub name: Option<String>,
    /// Updated description.
    pub description: Option<String>,
    /// Updated domain.
    pub domain: Option<String>,
    /// Updated priority.
    pub priority: Option<i32>,
    /// Updated enforcement flag.
    pub is_enforced: Option<bool>,
    /// Updated disabled flag.
    pub is_disabled: Option<bool>,
    /// Updated settings.
    pub settings: Option<serde_json::Value>,
}

// ============================================================================
// Org Policy Link
// ============================================================================

/// A link attaching a policy to an org scope (node, group, site, country, or global).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct OrgPolicyLink {
    /// Unique identifier.
    pub id: Uuid,
    /// Policy being linked.
    pub policy_id: Uuid,
    /// Scope type (e.g. `"node"`, `"group"`, `"site"`, `"country"`, `"global"`).
    pub link_type: String,
    /// Identifier of the scope entity (UUID as text, country code, or empty for global).
    pub link_id: String,
    /// Whether this link blocks policy inheritance at this point.
    pub is_blocked: bool,
    /// Timestamp of record creation.
    pub created_at: DateTime<Utc>,
}

/// Request payload to create a policy link.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreatePolicyLink {
    /// Policy to link.
    pub policy_id: Uuid,
    /// Scope type (e.g. `"node"`, `"group"`, `"site"`, `"country"`, `"global"`).
    pub link_type: String,
    /// Identifier of the scope entity (UUID as text, country code, or empty for global).
    pub link_id: String,
}

// ============================================================================
// Country Policy
// ============================================================================

/// Association between a country code and a policy.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CountryPolicy {
    /// ISO 3166-1 alpha-2 country code.
    pub country_code: String,
    /// Policy applied for this country.
    pub policy_id: Uuid,
}

// ============================================================================
// Effective Policy (resolved)
// ============================================================================

/// A single setting value resolved from a specific policy source.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct PolicySource {
    /// Setting key.
    pub key: String,
    /// Resolved setting value.
    pub value: serde_json::Value,
    /// Policy that provided this setting.
    pub policy_id: Uuid,
    /// Display name of the source policy.
    pub policy_name: String,
    /// Scope type through which the policy was linked.
    pub link_type: String,
    /// Human-readable description of the inheritance path.
    pub via: String,
}

/// Fully resolved policy settings for a given scope, with provenance.
///
/// `settings` is the merged view; `sources` provides per-key attribution.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct EffectivePolicy {
    /// Merged and resolved settings map.
    pub settings: serde_json::Value,
    /// Per-key provenance, one entry per setting key.
    pub sources: Vec<PolicySource>,
}
