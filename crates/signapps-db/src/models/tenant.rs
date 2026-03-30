//! Multi-tenant domain models (tenants, workspaces, projects, templates)

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

// ============================================================================
// Tenant Model (Enterprise/Organization)
// ============================================================================

/// A top-level tenant (organisation) with plan limits and branding settings.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Tenant {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub domain: Option<String>,
    pub logo_url: Option<String>,
    pub settings: serde_json::Value,
    pub plan: String,
    pub max_users: i32,
    pub max_resources: i32,
    pub max_workspaces: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to create a new tenant.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateTenant {
    pub name: String,
    pub slug: String,
    pub domain: Option<String>,
    pub logo_url: Option<String>,
    pub plan: Option<String>,
}

/// Request to update an existing tenant's settings or plan.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateTenant {
    pub name: Option<String>,
    pub domain: Option<String>,
    pub logo_url: Option<String>,
    pub settings: Option<serde_json::Value>,
    pub plan: Option<String>,
    pub max_users: Option<i32>,
    pub max_resources: Option<i32>,
    pub max_workspaces: Option<i32>,
    pub is_active: Option<bool>,
}

// ============================================================================
// Workspace Model (Group within a Tenant)
// ============================================================================

/// A workspace grouping users and projects within a tenant.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Workspace {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub color: String,
    pub icon: Option<String>,
    pub is_default: bool,
    pub settings: serde_json::Value,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to create a new workspace within a tenant.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateWorkspace {
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub is_default: Option<bool>,
}

/// Request to update an existing workspace.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateWorkspace {
    pub name: Option<String>,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub is_default: Option<bool>,
    pub settings: Option<serde_json::Value>,
}

// ============================================================================
// Workspace Member
// ============================================================================

/// A member of a workspace with an assigned role.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct WorkspaceMember {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub user_id: Uuid,
    pub role: String, // owner|admin|member|viewer
    pub joined_at: DateTime<Utc>,
}

/// A workspace member row joined with user profile details.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct WorkspaceMemberWithUser {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub user_id: Uuid,
    pub username: String,
    pub email: Option<String>,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub role: String,
    pub joined_at: DateTime<Utc>,
}

/// Request to add a user to a workspace with an optional role.
#[derive(Debug, Clone, Deserialize)]
pub struct AddWorkspaceMember {
    pub user_id: Uuid,
    pub role: Option<String>,
}

// ============================================================================
// Project Model
// ============================================================================

/// A project within a tenant and optional workspace, tracking tasks and progress.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Project {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub workspace_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub color: String,
    pub icon: Option<String>,
    pub status: String, // planning|active|on_hold|completed|archived
    pub start_date: Option<NaiveDate>,
    pub due_date: Option<NaiveDate>,
    pub calendar_id: Option<Uuid>,
    pub template_id: Option<Uuid>,
    pub owner_id: Option<Uuid>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

/// Request to create a new project.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateProject {
    pub workspace_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub status: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub due_date: Option<NaiveDate>,
    pub template_id: Option<Uuid>,
}

/// Request to update an existing project.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateProject {
    pub workspace_id: Option<Uuid>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub status: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub due_date: Option<NaiveDate>,
    pub metadata: Option<serde_json::Value>,
}

// ============================================================================
// Project Member
// ============================================================================

/// A member of a project with an assigned role.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct ProjectMember {
    pub id: Uuid,
    pub project_id: Uuid,
    pub user_id: Uuid,
    pub role: String, // owner|admin|member|viewer
    pub joined_at: DateTime<Utc>,
}

// ============================================================================
// Project with Tasks count
// ============================================================================

/// A project row joined with aggregated task completion statistics.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct ProjectWithStats {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub workspace_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub color: String,
    pub status: String,
    pub start_date: Option<NaiveDate>,
    pub due_date: Option<NaiveDate>,
    pub owner_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub total_tasks: i64,
    pub completed_tasks: i64,
}

// ============================================================================
// Resource Type (configurable per tenant)
// ============================================================================

/// A tenant-configurable resource type (e.g. room, equipment, vehicle).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct ResourceType {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String, // room|equipment|vehicle|desk
    pub icon: Option<String>,
    pub color: Option<String>,
    pub requires_approval: bool,
    pub created_at: DateTime<Utc>,
}

/// Request to create a new resource type for a tenant.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateResourceType {
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub requires_approval: Option<bool>,
}

// ============================================================================
// Enhanced Resource (with tenant support)
// ============================================================================

/// A tenant-scoped bookable resource with availability rules and approval settings.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct TenantResource {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub resource_type_id: Option<Uuid>,
    pub name: String,
    pub resource_type: String,
    pub description: Option<String>,
    pub capacity: Option<i32>,
    pub location: Option<String>,
    pub floor: Option<String>,
    pub building: Option<String>,
    pub amenities: Option<Vec<String>>,
    pub photo_urls: Option<Vec<String>>,
    pub calendar_id: Option<Uuid>,
    pub availability_rules: serde_json::Value,
    pub booking_rules: serde_json::Value,
    pub requires_approval: bool,
    pub approver_ids: Option<Vec<Uuid>>,
    pub is_available: bool,
    pub owner_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to create a new tenant resource.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateTenantResource {
    pub resource_type_id: Option<Uuid>,
    pub name: String,
    pub resource_type: String,
    pub description: Option<String>,
    pub capacity: Option<i32>,
    pub location: Option<String>,
    pub floor: Option<String>,
    pub building: Option<String>,
    pub amenities: Option<Vec<String>>,
    pub requires_approval: Option<bool>,
    pub approver_ids: Option<Vec<Uuid>>,
}

/// Request to update an existing tenant resource.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateTenantResource {
    pub name: Option<String>,
    pub description: Option<String>,
    pub capacity: Option<i32>,
    pub location: Option<String>,
    pub floor: Option<String>,
    pub building: Option<String>,
    pub amenities: Option<Vec<String>>,
    pub photo_urls: Option<Vec<String>>,
    pub availability_rules: Option<serde_json::Value>,
    pub booking_rules: Option<serde_json::Value>,
    pub requires_approval: Option<bool>,
    pub approver_ids: Option<Vec<Uuid>>,
    pub is_available: Option<bool>,
}

// ============================================================================
// Reservation (Booking with approval workflow)
// ============================================================================

/// A resource booking request with an optional approval workflow.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Reservation {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub resource_id: Uuid,
    pub event_id: Option<Uuid>,
    pub requested_by: Uuid,
    pub status: String, // pending|approved|rejected|cancelled
    pub approved_by: Option<Uuid>,
    pub approved_at: Option<DateTime<Utc>>,
    pub rejection_reason: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to create a resource reservation linked to an optional event.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateReservation {
    pub resource_id: Uuid,
    pub event_id: Option<Uuid>,
    pub notes: Option<String>,
}

/// Request to approve or reject a resource reservation.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateReservationStatus {
    pub status: String,
    pub rejection_reason: Option<String>,
}

// ============================================================================
// Template Model
// ============================================================================

/// A reusable content template for projects, tasks, events, or checklists.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Template {
    pub id: Uuid,
    pub tenant_id: Option<Uuid>, // NULL = global template
    pub workspace_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub template_type: String, // project|task|event|checklist
    pub content: serde_json::Value,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub is_public: bool,
    pub usage_count: i32,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

/// Request to create a new content template.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateTemplate {
    pub workspace_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub template_type: String,
    pub content: serde_json::Value,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub is_public: Option<bool>,
}

/// Request to update an existing content template.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateTemplate {
    pub name: Option<String>,
    pub description: Option<String>,
    pub content: Option<serde_json::Value>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub is_public: Option<bool>,
}

// ============================================================================
// Label Model
// ============================================================================

/// A colour-coded label used to tag entities within a workspace.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Label {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub workspace_id: Option<Uuid>,
    pub name: String,
    pub color: String,
    pub created_at: DateTime<Utc>,
}

/// Request to create a new label within a workspace.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateLabel {
    pub workspace_id: Option<Uuid>,
    pub name: String,
    pub color: String,
}

// ============================================================================
// Entity Label (polymorphic)
// ============================================================================

/// A polymorphic association attaching a label to an event, task, or project.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct EntityLabel {
    pub id: Uuid,
    pub label_id: Uuid,
    pub entity_type: String, // event|task|project
    pub entity_id: Uuid,
    pub created_at: DateTime<Utc>,
}

// ============================================================================
// Enhanced Task (with project support)
// ============================================================================

/// A task scoped to a tenant, optionally linked to a project, event, and template.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct TenantTask {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub calendar_id: Uuid,
    pub project_id: Option<Uuid>,
    pub parent_task_id: Option<Uuid>,
    pub event_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: i32,
    pub position: i32,
    pub due_date: Option<NaiveDate>,
    pub estimated_hours: Option<f64>,
    pub assigned_to: Option<Uuid>,
    pub template_id: Option<Uuid>,
    pub created_by: Uuid,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to create a new tenant task.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateTenantTask {
    pub calendar_id: Uuid,
    pub project_id: Option<Uuid>,
    pub parent_task_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<i32>,
    pub position: Option<i32>,
    pub due_date: Option<NaiveDate>,
    pub estimated_hours: Option<f64>,
    pub assigned_to: Option<Uuid>,
    pub template_id: Option<Uuid>,
}

// ============================================================================
// Enhanced Calendar (with tenant support)
// ============================================================================

/// A calendar scoped to a tenant, supporting personal, group, enterprise, and resource types.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct TenantCalendar {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub workspace_id: Option<Uuid>,
    pub owner_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub timezone: String,
    pub color: String,
    pub calendar_type: String, // personal|group|enterprise|resource_room|resource_equipment
    pub resource_id: Option<Uuid>,
    pub is_shared: bool,
    pub is_public: bool,
    pub is_default: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to create a new tenant calendar.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateTenantCalendar {
    pub workspace_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub timezone: Option<String>,
    pub color: Option<String>,
    pub calendar_type: Option<String>,
    pub is_shared: Option<bool>,
    pub is_public: Option<bool>,
}
