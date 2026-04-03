//! Calendar domain models (events, tasks, resources, sharing)

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ============================================================================
// Calendar Model
// ============================================================================
/// A personal or shared calendar belonging to a user.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct Calendar {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub timezone: String,
    pub color: String,
    pub is_shared: bool,
    pub is_public: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub tenant_id: Option<Uuid>,
    pub workspace_id: Option<Uuid>,
    pub calendar_type: Option<String>,
    pub resource_id: Option<Uuid>,
    pub is_default: Option<bool>,
    pub deleted_at: Option<DateTime<Utc>>,
}

/// Request to create a new calendar.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateCalendar {
    pub name: String,
    pub description: Option<String>,
    pub timezone: Option<String>,
    pub color: Option<String>,
    pub is_shared: Option<bool>,
}

/// Request to update an existing calendar.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateCalendar {
    pub name: Option<String>,
    pub description: Option<String>,
    pub timezone: Option<String>,
    pub color: Option<String>,
    pub is_shared: Option<bool>,
}

// ============================================================================
// Calendar Member (Sharing)
// ============================================================================
/// A user who has been granted access to a shared calendar with a specific role.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CalendarMember {
    pub id: Uuid,
    pub calendar_id: Uuid,
    pub user_id: Uuid,
    pub role: String, // owner|editor|viewer
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to add a user to a calendar with a given role.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AddCalendarMember {
    pub user_id: Uuid,
    pub role: String,
}

/// A calendar together with its full member list.
#[derive(Debug, Clone, Serialize)]
pub struct CalendarWithMembers {
    pub calendar: Calendar,
    pub members: Vec<CalendarMemberWithUser>,
}

/// A calendar member row joined with basic user profile data.
#[derive(Debug, Clone, FromRow, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CalendarMemberWithUser {
    pub id: Uuid,
    pub user_id: Uuid,
    pub username: String,
    pub email: Option<String>,
    pub role: String,
}

// ============================================================================
// Event Model
// ============================================================================
/// A calendar event with optional recurrence rules, type metadata, and attendee support.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct Event {
    pub id: Uuid,
    pub calendar_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub rrule: Option<String>,
    pub rrule_exceptions: Vec<Uuid>,
    pub timezone: String,
    pub created_by: Uuid,
    pub is_all_day: bool,
    pub is_deleted: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    // Unified event type fields
    pub event_type: Option<String>,
    pub scope: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub parent_event_id: Option<Uuid>,
    pub resource_id: Option<Uuid>,
    pub category_id: Option<Uuid>,
    pub leave_type: Option<String>,
    pub presence_mode: Option<String>,
    pub approval_by: Option<Uuid>,
    pub approval_comment: Option<String>,
    pub energy_level: Option<String>,
    pub cron_expression: Option<String>,
    pub cron_target: Option<String>,
    pub assigned_to: Option<Uuid>,
    pub project_id: Option<Uuid>,
    pub tags: Option<Vec<String>>,
}

/// Request to create a new calendar event.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateEvent {
    pub title: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub rrule: Option<String>,
    pub timezone: Option<String>,
    pub is_all_day: Option<bool>,
    // Unified event type fields
    pub event_type: Option<String>,
    pub scope: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub parent_event_id: Option<Uuid>,
    pub resource_id: Option<Uuid>,
    pub category_id: Option<Uuid>,
    pub leave_type: Option<String>,
    pub presence_mode: Option<String>,
    pub approval_by: Option<Uuid>,
    pub approval_comment: Option<String>,
    pub energy_level: Option<String>,
    pub cron_expression: Option<String>,
    pub cron_target: Option<String>,
    pub assigned_to: Option<Uuid>,
    pub project_id: Option<Uuid>,
    pub tags: Option<Vec<String>>,
}

/// Request to update an existing calendar event.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateEvent {
    pub title: Option<String>,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub rrule: Option<String>,
    pub timezone: Option<String>,
    pub is_all_day: Option<bool>,
    // Unified event type fields
    pub event_type: Option<String>,
    pub scope: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub parent_event_id: Option<Uuid>,
    pub resource_id: Option<Uuid>,
    pub category_id: Option<Uuid>,
    pub leave_type: Option<String>,
    pub presence_mode: Option<String>,
    pub approval_by: Option<Uuid>,
    pub approval_comment: Option<String>,
    pub energy_level: Option<String>,
    pub cron_expression: Option<String>,
    pub cron_target: Option<String>,
    pub assigned_to: Option<Uuid>,
    pub project_id: Option<Uuid>,
    pub tags: Option<Vec<String>>,
}

// ============================================================================
// Event with Attendees & Resources
// ============================================================================
/// An event bundled with its attendees, booked resources, and custom metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct EventWithDetails {
    pub event: Event,
    pub attendees: Vec<EventAttendee>,
    pub resources: Vec<EventResource>,
    pub metadata: Vec<EventMetadata>,
}

// ============================================================================
// Event Attendee (RSVP)
// ============================================================================
/// An attendee (user or external email) invited to a calendar event with an RSVP status.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct EventAttendee {
    pub id: Uuid,
    pub event_id: Uuid,
    pub user_id: Option<Uuid>,
    pub email: Option<String>,
    pub rsvp_status: String, // pending|accepted|declined|tentative
    pub response_date: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to add an attendee to an event.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AddEventAttendee {
    pub user_id: Option<Uuid>,
    pub email: Option<String>,
}

/// Request to update an attendee's RSVP status.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateAttendeeRsvp {
    pub rsvp_status: String,
}

// ============================================================================
// Event Metadata
// ============================================================================
/// A key-value metadata entry attached to a calendar event.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct EventMetadata {
    pub id: Uuid,
    pub event_id: Uuid,
    pub key: String,
    pub value: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ============================================================================
// Resource
// ============================================================================
/// A bookable resource such as a room, piece of equipment, or vehicle.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Resource {
    pub id: Uuid,
    pub name: String,
    pub resource_type: String, // room|equipment|vehicle
    pub description: Option<String>,
    pub capacity: Option<i32>,
    pub location: Option<String>,
    pub is_available: bool,
    pub owner_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to create a new bookable resource.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateResource {
    pub name: String,
    pub resource_type: String,
    pub description: Option<String>,
    pub capacity: Option<i32>,
    pub location: Option<String>,
}

// ============================================================================
// Event Resource (booking)
// ============================================================================
/// A link between a calendar event and a booked resource.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct EventResource {
    pub id: Uuid,
    pub event_id: Uuid,
    pub resource_id: Uuid,
    pub created_at: DateTime<Utc>,
}

// ============================================================================
// Task (Hierarchical with parent_id)
// ============================================================================
/// A hierarchical task associated with a calendar, optionally assigned to a user.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Task {
    pub id: Uuid,
    pub calendar_id: Uuid,
    pub parent_task_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub status: String, // open|in_progress|completed|archived
    pub priority: i32,  // 0=low, 1=medium, 2=high, 3=urgent
    pub position: i32,
    pub due_date: Option<NaiveDate>,
    pub assigned_to: Option<Uuid>,
    pub created_by: Uuid,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to create a new task.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateTask {
    pub parent_task_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<i32>,
    pub position: Option<i32>,
    pub due_date: Option<NaiveDate>,
    pub assigned_to: Option<Uuid>,
}

/// Request to update an existing task.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateTask {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<i32>,
    pub position: Option<i32>,
    pub due_date: Option<NaiveDate>,
    pub assigned_to: Option<Uuid>,
}

// ============================================================================
// Task Tree (with children)
// ============================================================================
/// A task node in a recursive tree structure, containing child tasks and attachments.
#[derive(Debug, Clone, Serialize)]
pub struct TaskNode {
    pub task: Task,
    pub children: Vec<TaskNode>,
    pub attachments: Vec<TaskAttachment>,
}

// ============================================================================
// Task Attachment
// ============================================================================
/// A file attached to a task, referenced by URL.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct TaskAttachment {
    pub id: Uuid,
    pub task_id: Uuid,
    pub file_url: String,
    pub file_name: Option<String>,
    pub file_size_bytes: Option<i32>,
    pub created_at: DateTime<Utc>,
}

// ============================================================================
// Reminder
// ============================================================================
/// A scheduled reminder for an event or task, delivered via notification, email, or SMS.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Reminder {
    pub id: Uuid,
    pub event_id: Option<Uuid>,
    pub task_id: Option<Uuid>,
    pub user_id: Uuid,
    pub reminder_type: String, // notification|email|sms
    pub minutes_before: i32,
    pub is_sent: bool,
    pub sent_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Request to create a reminder for an event or task.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateReminder {
    pub event_id: Option<Uuid>,
    pub task_id: Option<Uuid>,
    pub user_id: Uuid,
    pub reminder_type: Option<String>,
    pub minutes_before: Option<i32>,
}

// ============================================================================
// Activity Log (Audit Trail)
// ============================================================================
/// An audit trail entry recording a change to a calendar entity.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct ActivityLog {
    pub id: Uuid,
    pub calendar_id: Uuid,
    pub entity_type: String, // event|task|calendar|resource
    pub entity_id: Uuid,
    pub action: String, // created|updated|deleted|shared
    pub user_id: Option<Uuid>,
    pub changes: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

// ============================================================================
// FloorPlan Models
// ============================================================================
/// A floor plan layout used for visualising and booking physical resources.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct FloorPlan {
    pub id: Uuid,
    pub name: String,
    pub floor: String,
    pub width: f64,
    pub height: f64,
    pub resources: serde_json::Value,
    pub svg_content: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to create a new floor plan.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateFloorPlan {
    pub name: String,
    pub floor: String,
    pub width: f64,
    pub height: f64,
    pub resources: serde_json::Value,
    #[serde(rename = "svgContent")]
    pub svg_content: Option<String>,
}

/// Request to update an existing floor plan.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateFloorPlan {
    pub name: Option<String>,
    pub floor: Option<String>,
    pub width: Option<f64>,
    pub height: Option<f64>,
    pub resources: Option<serde_json::Value>,
    #[serde(rename = "svgContent")]
    pub svg_content: Option<String>,
}

// ============================================================================
// Category
// ============================================================================
/// A color-coded category used to classify calendar events and tasks.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Category {
    pub id: Uuid,
    pub name: String,
    pub color: String,
    pub icon: Option<String>,
    pub owner_id: Option<Uuid>,
    pub org_id: Option<Uuid>,
    pub rules: Option<serde_json::Value>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

/// Request to create a new event/task category.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCategory {
    pub name: String,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub org_id: Option<Uuid>,
    pub rules: Option<serde_json::Value>,
}

// ============================================================================
// PresenceRule
// ============================================================================
/// An organisational rule governing on-site vs. remote presence requirements for a team.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct PresenceRule {
    pub id: Uuid,
    pub org_id: Uuid,
    pub team_id: Option<Uuid>,
    pub rule_type: String,
    pub rule_config: serde_json::Value,
    pub enforcement: Option<String>,
    pub active: Option<bool>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

/// Request to create a new presence rule for an organisation or team.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePresenceRule {
    pub org_id: Uuid,
    pub team_id: Option<Uuid>,
    pub rule_type: String,
    pub rule_config: serde_json::Value,
    pub enforcement: Option<String>,
}

// ============================================================================
// LeaveBalance
// ============================================================================
/// A user's annual leave balance tracking total, used, and pending days per leave type.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct LeaveBalance {
    pub id: Uuid,
    pub user_id: Uuid,
    pub leave_type: String,
    pub year: i32,
    pub total_days: f64,
    pub used_days: f64,
    pub pending_days: f64,
    pub updated_at: Option<DateTime<Utc>>,
}

// ============================================================================
// TimesheetEntry
// ============================================================================
/// A timesheet entry recording hours worked by a user on a given date.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct TimesheetEntry {
    pub id: Uuid,
    pub user_id: Uuid,
    pub event_id: Option<Uuid>,
    pub date: NaiveDate,
    pub hours: f64,
    pub category_id: Option<Uuid>,
    pub auto_generated: Option<bool>,
    pub validated: Option<bool>,
    pub validated_at: Option<DateTime<Utc>>,
    pub exported_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

// ============================================================================
// ApprovalWorkflow
// ============================================================================
/// An approval workflow triggered by configurable calendar events (e.g. leave requests).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct ApprovalWorkflow {
    pub id: Uuid,
    pub org_id: Uuid,
    pub trigger_type: String,
    pub trigger_config: serde_json::Value,
    pub approvers: serde_json::Value,
    pub active: Option<bool>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

/// Request to create a new approval workflow.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateApprovalWorkflow {
    pub org_id: Uuid,
    pub trigger_type: String,
    pub trigger_config: serde_json::Value,
    pub approvers: serde_json::Value,
}
