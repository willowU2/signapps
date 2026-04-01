//! Enterprise org structure models: Party Model, Entity Trees, Assignments, Sites.
//!
//! Covers all tables in the `core` schema created by migration 122.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

// ============================================================================
// Enum mirrors (stored as TEXT / PG enums, round-tripped via String)
// ============================================================================

/// Discriminator for a person's organisational role context.
pub type PersonRoleType = String; // 'employee' | 'client_contact' | 'supplier_contact' | 'partner'

/// Discriminator for which entity-tree a node belongs to.
pub type TreeType = String; // 'internal' | 'clients' | 'suppliers'

/// Discriminator for how a person fills a position.
pub type AssignmentType = String; // 'holder' | 'interim' | 'deputy' | 'intern' | 'contractor'

/// Discriminator for the managerial dimension of an assignment.
pub type ResponsibilityType = String; // 'hierarchical' | 'functional' | 'matrix'

/// Audit action recorded in assignment_history.
pub type AssignmentAction = String; // 'created' | 'modified' | 'ended' | 'transferred'

/// Physical granularity of a geographic site.
pub type SiteType = String; // 'campus' | 'building' | 'floor' | 'room'

// ============================================================================
// Person (Party Model)
// ============================================================================

/// A physical or legal person that can hold one or more organisational roles.
///
/// Persons may optionally be linked to an identity `user_id` (platform account).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct Person {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub avatar_url: Option<String>,
    /// Optional link to the platform user account.
    pub user_id: Option<Uuid>,
    pub is_active: bool,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request payload to create a new person record.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreatePerson {
    pub tenant_id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub avatar_url: Option<String>,
    pub user_id: Option<Uuid>,
    pub metadata: Option<serde_json::Value>,
}

/// Request payload to update an existing person record.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdatePerson {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub avatar_url: Option<String>,
    pub is_active: Option<bool>,
    pub metadata: Option<serde_json::Value>,
}

// ============================================================================
// Person Role
// ============================================================================

/// A role context attached to a person (e.g. the same person can be both
/// an employee and a client contact).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct PersonRole {
    pub id: Uuid,
    pub person_id: Uuid,
    /// One of: `employee`, `client_contact`, `supplier_contact`, `partner`.
    pub role_type: PersonRoleType,
    pub metadata: serde_json::Value,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

/// Request payload to add a role to a person.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePersonRole {
    pub person_id: Uuid,
    pub role_type: PersonRoleType,
    pub metadata: Option<serde_json::Value>,
}

// ============================================================================
// Org Tree
// ============================================================================

/// A named entity tree scoped to a tenant.
///
/// Each tenant has at most one tree per `tree_type` (enforced by UNIQUE constraint).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct OrgTree {
    pub id: Uuid,
    pub tenant_id: Uuid,
    /// One of: `internal`, `clients`, `suppliers`.
    pub tree_type: TreeType,
    pub name: String,
    /// The UUID of the root [`OrgNode`], set after the first node is created.
    pub root_node_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request payload to create a new org tree.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateOrgTree {
    pub tenant_id: Uuid,
    pub tree_type: TreeType,
    pub name: String,
}

// ============================================================================
// Org Node
// ============================================================================

/// A generic node in an org tree (department, team, division, client account…).
///
/// The `node_type` field is free-text so that each tree can use its own taxonomy
/// without schema changes (e.g. `"department"`, `"team"`, `"cost_center"`).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct OrgNode {
    pub id: Uuid,
    pub tree_id: Uuid,
    pub parent_id: Option<Uuid>,
    /// Domain-specific discriminator (e.g. `"department"`, `"team"`, `"division"`).
    pub node_type: String,
    pub name: String,
    /// Short code used in reporting or directory paths.
    pub code: Option<String>,
    pub description: Option<String>,
    /// Arbitrary structured configuration (budgets, colours, icons…).
    pub config: serde_json::Value,
    pub sort_order: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request payload to create a new org node.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateOrgNode {
    pub tree_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub node_type: String,
    pub name: String,
    pub code: Option<String>,
    pub description: Option<String>,
    pub config: Option<serde_json::Value>,
    pub sort_order: Option<i32>,
}

/// Request payload to update an existing org node.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateOrgNode {
    pub name: Option<String>,
    pub code: Option<String>,
    pub description: Option<String>,
    pub config: Option<serde_json::Value>,
    pub sort_order: Option<i32>,
    pub is_active: Option<bool>,
}

/// A closure-table row representing an ancestor → descendant relationship.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct OrgClosure {
    pub ancestor_id: Uuid,
    pub descendant_id: Uuid,
    /// Number of edges between ancestor and descendant (0 = self-reference).
    pub depth: i32,
}

/// A tree node augmented with its children for hierarchical serialisation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrgChartNode {
    #[serde(flatten)]
    pub node: OrgNode,
    pub children: Vec<OrgChartNode>,
}

// ============================================================================
// Assignment
// ============================================================================

/// A temporal assignment of a person to an org-tree node.
///
/// Supports partial FTE (e.g. 0.5 for half-time) and multiple responsibility
/// dimensions (hierarchical, functional, matrix).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct Assignment {
    pub id: Uuid,
    pub person_id: Uuid,
    pub node_id: Uuid,
    /// One of: `holder`, `interim`, `deputy`, `intern`, `contractor`.
    pub assignment_type: AssignmentType,
    /// One of: `hierarchical`, `functional`, `matrix`.
    pub responsibility_type: ResponsibilityType,
    pub start_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    /// Full-time equivalent ratio (0.00–1.00).
    pub fte_ratio: f64,
    pub is_primary: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request payload to create a new assignment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAssignment {
    pub person_id: Uuid,
    pub node_id: Uuid,
    pub assignment_type: Option<AssignmentType>,
    pub responsibility_type: Option<ResponsibilityType>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub fte_ratio: Option<f64>,
    pub is_primary: Option<bool>,
}

/// Request payload to update an existing assignment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAssignment {
    pub assignment_type: Option<AssignmentType>,
    pub responsibility_type: Option<ResponsibilityType>,
    pub end_date: Option<NaiveDate>,
    pub fte_ratio: Option<f64>,
    pub is_primary: Option<bool>,
}

// ============================================================================
// Assignment History
// ============================================================================

/// Forensic log entry tracking every change made to an assignment.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AssignmentHistory {
    pub id: Uuid,
    pub assignment_id: Uuid,
    /// One of: `created`, `modified`, `ended`, `transferred`.
    pub action: AssignmentAction,
    /// User who performed the change.
    pub changed_by: Option<Uuid>,
    /// JSON diff of changed fields.
    pub changes: serde_json::Value,
    pub reason: Option<String>,
    pub effective_date: NaiveDate,
    pub created_at: DateTime<Utc>,
}

/// Request payload to append an audit entry to assignment history.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAssignmentHistory {
    pub assignment_id: Uuid,
    pub action: AssignmentAction,
    pub changed_by: Option<Uuid>,
    pub changes: Option<serde_json::Value>,
    pub reason: Option<String>,
    pub effective_date: NaiveDate,
}

// ============================================================================
// Site
// ============================================================================

/// A geographic or physical location with optional coordinates and hierarchy.
///
/// Sites can be nested (campus → building → floor → room) via `parent_id`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct Site {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub parent_id: Option<Uuid>,
    /// One of: `campus`, `building`, `floor`, `room`.
    pub site_type: SiteType,
    pub name: String,
    pub address: Option<String>,
    pub city: Option<String>,
    pub country: Option<String>,
    pub geo_lat: Option<f64>,
    pub geo_lng: Option<f64>,
    pub timezone: Option<String>,
    pub capacity: Option<i32>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request payload to create a new site.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateSite {
    pub tenant_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub site_type: SiteType,
    pub name: String,
    pub address: Option<String>,
    pub city: Option<String>,
    pub country: Option<String>,
    pub geo_lat: Option<f64>,
    pub geo_lng: Option<f64>,
    pub timezone: Option<String>,
    pub capacity: Option<i32>,
}

/// Request payload to update an existing site.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateSite {
    pub name: Option<String>,
    pub address: Option<String>,
    pub city: Option<String>,
    pub country: Option<String>,
    pub geo_lat: Option<f64>,
    pub geo_lng: Option<f64>,
    pub timezone: Option<String>,
    pub capacity: Option<i32>,
    pub is_active: Option<bool>,
}

// ============================================================================
// Node Site (N:N join)
// ============================================================================

/// Association between an org node and a physical site.
///
/// A node may span multiple sites; `is_primary` flags the canonical one.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct NodeSite {
    pub node_id: Uuid,
    pub site_id: Uuid,
    pub is_primary: bool,
}

// ============================================================================
// Person Site (temporal)
// ============================================================================

/// Temporal assignment of a person to a site (their physical work location).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct PersonSite {
    pub id: Uuid,
    pub person_id: Uuid,
    pub site_id: Uuid,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub is_primary: bool,
}

// ============================================================================
// Permission Profile
// ============================================================================

/// Module-level permission overrides attached to an org node.
///
/// When `inherit` is `true` the effective permissions are merged up the tree
/// via the closure table (most-specific node wins per module).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct PermissionProfile {
    pub id: Uuid,
    pub node_id: Uuid,
    /// Whether permissions should inherit from ancestor nodes.
    pub inherit: bool,
    /// Map of module → permission level (e.g. `{"billing": "read_only"}`).
    pub modules: serde_json::Value,
    /// Highest identity role allowed for members of this node.
    pub max_role: String,
    /// Arbitrary fine-grained overrides beyond module-level.
    pub custom_permissions: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request payload to create or replace the permission profile of an org node.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpsertPermissionProfile {
    pub inherit: Option<bool>,
    pub modules: Option<serde_json::Value>,
    pub max_role: Option<String>,
    pub custom_permissions: Option<serde_json::Value>,
}

/// Resolved permission set for a person at a specific org node,
/// obtained by walking the closure table and merging inherited profiles.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct EffectivePermissions {
    pub node_id: Uuid,
    /// Merged module permissions (deepest node overrides ancestors).
    pub modules: serde_json::Value,
    pub max_role: String,
    pub custom_permissions: serde_json::Value,
    /// Ordered list of node IDs from root to the target node (inheritance chain).
    pub inherited_from: Vec<Uuid>,
}
