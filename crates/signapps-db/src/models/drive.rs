use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Represents the type of a node in the drive
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[serde(rename_all = "lowercase")]
#[sqlx(type_name = "node_type", rename_all = "lowercase")]
pub enum NodeType {
    Folder,
    File,
    Document,
    Spreadsheet,
}

/// Represents a node (folder, file, or document) in the virtual file system
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DriveNode {
    pub id: Uuid,
    pub parent_id: Option<Uuid>,
    pub name: String,
    pub node_type: NodeType,
    pub target_id: Option<Uuid>,
    pub owner_id: Uuid,
    pub size: Option<i64>,
    pub mime_type: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub deleted_at: Option<DateTime<Utc>>,
}

/// Request to create a new drive node
#[derive(Debug, Deserialize)]
pub struct CreateDriveNodeRequest {
    pub parent_id: Option<Uuid>,
    pub name: String,
    pub node_type: String, // "folder", "file", "document"
    pub target_id: Option<Uuid>,
    pub size: Option<i64>,
    pub mime_type: Option<String>,
}

/// Request to update an existing drive node
#[derive(Debug, Deserialize)]
pub struct UpdateDriveNodeRequest {
    pub name: Option<String>,
    pub parent_id: Option<Uuid>,
}

/// Represents a role for drive permissions
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "permission_role", rename_all = "lowercase")]
pub enum PermissionRole {
    Viewer,
    Editor,
    Manager,
}

/// Represents a permission grant on a drive node
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DrivePermission {
    pub id: Uuid,
    pub node_id: Uuid,
    pub user_id: Option<Uuid>,
    pub group_id: Option<Uuid>,
    pub role: PermissionRole,
    pub granted_by: Uuid,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

/// Request to create or update a permission
#[derive(Debug, Deserialize)]
pub struct SetDrivePermissionRequest {
    pub user_id: Option<Uuid>,
    pub group_id: Option<Uuid>,
    pub role: String, // "viewer", "editor", "manager"
}

/// Represents a drive node with its permissions (for sharing views)
#[derive(Debug, Serialize)]
pub struct DriveNodeWithAccess {
    #[serde(flatten)]
    pub node: DriveNode,
    pub access_role: String,
}
