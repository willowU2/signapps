//! Calendar domain models (events, tasks, resources, sharing)

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ============================================================================
// Calendar Model
// ============================================================================
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
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
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateCalendar {
    pub name: String,
    pub description: Option<String>,
    pub timezone: Option<String>,
    pub color: Option<String>,
    pub is_shared: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
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
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct CalendarMember {
    pub id: Uuid,
    pub calendar_id: Uuid,
    pub user_id: Uuid,
    pub role: String, // owner|editor|viewer
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AddCalendarMember {
    pub user_id: Uuid,
    pub role: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CalendarWithMembers {
    pub calendar: Calendar,
    pub members: Vec<CalendarMemberWithUser>,
}

#[derive(Debug, Clone, FromRow, Serialize)]
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
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
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
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateEvent {
    pub title: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub rrule: Option<String>,
    pub timezone: Option<String>,
    pub is_all_day: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateEvent {
    pub title: Option<String>,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub rrule: Option<String>,
    pub timezone: Option<String>,
    pub is_all_day: Option<bool>,
}

// ============================================================================
// Event with Attendees & Resources
// ============================================================================
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventWithDetails {
    pub event: Event,
    pub attendees: Vec<EventAttendee>,
    pub resources: Vec<EventResource>,
    pub metadata: Vec<EventMetadata>,
}

// ============================================================================
// Event Attendee (RSVP)
// ============================================================================
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Deserialize)]
pub struct AddEventAttendee {
    pub user_id: Option<Uuid>,
    pub email: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateAttendeeRsvp {
    pub rsvp_status: String,
}

// ============================================================================
// Event Metadata
// ============================================================================
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
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
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct EventResource {
    pub id: Uuid,
    pub event_id: Uuid,
    pub resource_id: Uuid,
    pub created_at: DateTime<Utc>,
}

// ============================================================================
// Task (Hierarchical with parent_id)
// ============================================================================
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
#[derive(Debug, Clone, Serialize)]
pub struct TaskNode {
    pub task: Task,
    pub children: Vec<TaskNode>,
    pub attachments: Vec<TaskAttachment>,
}

// ============================================================================
// Task Attachment
// ============================================================================
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
