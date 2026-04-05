//! Shared types for the org handler module.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

/// Organization node in the hierarchy
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, utoipa::ToSchema)]
/// OrgNode data transfer object.
pub struct OrgNode {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub node_type: String,
    pub name: String,
    pub code: Option<String>,
    pub description: Option<String>,
    pub config: serde_json::Value,
    pub sort_order: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// Entry lifecycle state: live, recycled, or tombstone.
    pub lifecycle_state: Option<String>,
    /// Extensible attributes (JSONB).
    pub attributes: Option<serde_json::Value>,
}

/// Node type definition (customizable per tenant)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, utoipa::ToSchema)]
/// OrgNodeType data transfer object.
pub struct OrgNodeType {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub allowed_children: serde_json::Value,
    pub config_schema: Option<serde_json::Value>,
    pub sort_order: Option<i32>,
    pub created_at: DateTime<Utc>,
    /// Tree type (internal/clients/suppliers).
    pub tree_type: Option<String>,
    /// Display label.
    pub label: Option<String>,
    /// Whether this node type is active.
    pub is_active: Option<bool>,
    /// Last update timestamp.
    pub updated_at: Option<DateTime<Utc>>,
    /// Schema definition for attributes.
    pub schema: Option<serde_json::Value>,
}

/// Tree node with children (recursive structure)
#[derive(Debug, Clone, Serialize, Deserialize)]
/// OrgTreeNode data transfer object.
pub struct OrgTreeNode {
    #[serde(flatten)]
    pub node: OrgNode,
    pub children: Vec<OrgTreeNode>,
    pub depth: i32,
    pub employee_count: i64,
}

/// Create node request
#[derive(Debug, Deserialize, Validate, utoipa::ToSchema)]
/// Request body for CreateNode.
pub struct CreateNodeRequest {
    pub parent_id: Option<Uuid>,
    #[validate(length(min = 1, max = 50))]
    pub node_type: String,
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    pub code: Option<String>,
    pub description: Option<String>,
    pub config: Option<serde_json::Value>,
    pub sort_order: Option<i32>,
}

/// Update node request
#[derive(Debug, Deserialize, Validate, utoipa::ToSchema)]
/// Request body for UpdateNode.
pub struct UpdateNodeRequest {
    #[validate(length(min = 1, max = 255))]
    pub name: Option<String>,
    pub code: Option<String>,
    pub description: Option<String>,
    pub config: Option<serde_json::Value>,
    pub sort_order: Option<i32>,
    pub is_active: Option<bool>,
}

/// Move node request
#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for MoveNode.
pub struct MoveNodeRequest {
    pub new_parent_id: Option<Uuid>,
}

/// Create node type request
#[derive(Debug, Deserialize, Validate, utoipa::ToSchema)]
/// Request body for CreateNodeType.
pub struct CreateNodeTypeRequest {
    #[validate(length(min = 1, max = 50))]
    pub code: String,
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub allowed_children: Option<Vec<String>>,
    pub config_schema: Option<serde_json::Value>,
    pub sort_order: Option<i32>,
}

/// Query params for tree retrieval
#[derive(Debug, Deserialize, Default)]
/// Query parameters for filtering results.
pub struct TreeQueryParams {
    pub include_inactive: Option<bool>,
    pub root_id: Option<Uuid>,
    pub max_depth: Option<i32>,
}
