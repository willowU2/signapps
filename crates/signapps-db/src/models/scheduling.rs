//! Unified Scheduling domain models (TimeItem, Recurrence, Resources)

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ============================================================================
// Enums
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum TimeItemType {
    Task,
    Event,
    Booking,
    Shift,
    Milestone,
    Reminder,
    Blocker,
}

impl std::fmt::Display for TimeItemType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TimeItemType::Task => write!(f, "task"),
            TimeItemType::Event => write!(f, "event"),
            TimeItemType::Booking => write!(f, "booking"),
            TimeItemType::Shift => write!(f, "shift"),
            TimeItemType::Milestone => write!(f, "milestone"),
            TimeItemType::Reminder => write!(f, "reminder"),
            TimeItemType::Blocker => write!(f, "blocker"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum Scope {
    Moi,
    Eux,
    Nous,
}

impl std::fmt::Display for Scope {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Scope::Moi => write!(f, "moi"),
            Scope::Eux => write!(f, "eux"),
            Scope::Nous => write!(f, "nous"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum Visibility {
    Private,
    Group,
    Service,
    Bu,
    Company,
    Public,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum TimeItemStatus {
    Todo,
    InProgress,
    Done,
    Cancelled,
    Pending,
    Confirmed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum Priority {
    Low,
    Medium,
    High,
    Urgent,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum FocusLevel {
    Deep,
    Medium,
    Shallow,
    Break,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum EnergyRequired {
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum TimeOfDay {
    Morning,
    Midday,
    Afternoon,
    Evening,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum RecurrenceFrequency {
    Daily,
    Weekly,
    Monthly,
    Yearly,
    Custom,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DependencyType {
    FinishToStart,
    StartToStart,
    FinishToFinish,
    StartToFinish,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ParticipantRole {
    Owner,
    Editor,
    Participant,
    Viewer,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum RsvpStatus {
    Pending,
    Accepted,
    Declined,
    Tentative,
}

// ============================================================================
// TimeItem Model
// ============================================================================

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct TimeItem {
    pub id: Uuid,
    pub item_type: String,
    pub title: String,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub color: Option<String>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub deadline: Option<DateTime<Utc>>,
    pub duration_minutes: Option<i32>,
    pub all_day: bool,
    pub timezone: String,
    pub location_name: Option<String>,
    pub location_address: Option<String>,
    pub location_url: Option<String>,
    pub tenant_id: Uuid,
    pub business_unit_id: Option<Uuid>,
    pub service_id: Option<Uuid>,
    pub project_id: Option<Uuid>,
    pub owner_id: Uuid,
    pub scope: String,
    pub visibility: String,
    pub status: String,
    pub priority: Option<String>,
    pub focus_level: Option<String>,
    pub energy_required: Option<String>,
    pub value_score: Option<i16>,
    pub estimated_pomodoros: Option<i16>,
    pub actual_pomodoros: Option<i16>,
    pub preferred_time_of_day: Option<String>,
    pub min_block_duration_minutes: Option<i32>,
    pub max_block_duration_minutes: Option<i32>,
    pub parent_id: Option<Uuid>,
    pub template_id: Option<Uuid>,
    pub resource_id: Option<Uuid>,
    pub booking_link: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub created_by: Uuid,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTimeItem {
    #[serde(rename = "type")]
    pub item_type: String,
    pub title: String,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub color: Option<String>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub deadline: Option<DateTime<Utc>>,
    pub duration_minutes: Option<i32>,
    pub all_day: Option<bool>,
    pub timezone: Option<String>,
    pub location: Option<LocationInput>,
    pub project_id: Option<Uuid>,
    pub scope: Option<String>,
    pub visibility: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub focus_level: Option<String>,
    pub energy_required: Option<String>,
    pub value_score: Option<i16>,
    pub estimated_pomodoros: Option<i16>,
    pub preferred_time_of_day: Option<String>,
    pub min_block_duration_minutes: Option<i32>,
    pub max_block_duration_minutes: Option<i32>,
    pub parent_id: Option<Uuid>,
    pub resource_id: Option<Uuid>,
    pub recurrence: Option<RecurrenceRuleInput>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTimeItem {
    #[serde(rename = "type")]
    pub item_type: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub color: Option<String>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub deadline: Option<DateTime<Utc>>,
    pub duration_minutes: Option<i32>,
    pub all_day: Option<bool>,
    pub timezone: Option<String>,
    pub location: Option<LocationInput>,
    pub project_id: Option<Uuid>,
    pub scope: Option<String>,
    pub visibility: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub focus_level: Option<String>,
    pub energy_required: Option<String>,
    pub value_score: Option<i16>,
    pub estimated_pomodoros: Option<i16>,
    pub actual_pomodoros: Option<i16>,
    pub preferred_time_of_day: Option<String>,
    pub min_block_duration_minutes: Option<i32>,
    pub max_block_duration_minutes: Option<i32>,
    pub resource_id: Option<Uuid>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocationInput {
    pub name: Option<String>,
    pub address: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveTimeItem {
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub duration_minutes: Option<i32>,
}

// ============================================================================
// TimeItem Query
// ============================================================================

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TimeItemsQuery {
    pub start: Option<String>,
    pub end: Option<String>,
    pub scope: Option<String>,
    pub types: Option<Vec<String>>,
    pub statuses: Option<Vec<String>>,
    pub priorities: Option<Vec<String>>,
    pub project_id: Option<Uuid>,
    pub user_ids: Option<Vec<Uuid>>,
    pub group_ids: Option<Vec<Uuid>>,
    pub search: Option<String>,
    pub include_recurrences: Option<bool>,
    pub include_completed: Option<bool>,
    pub include_cancelled: Option<bool>,
    pub unscheduled_only: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeItemsResponse {
    pub items: Vec<TimeItem>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

// ============================================================================
// TimeItem User (Participants)
// ============================================================================

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct TimeItemUser {
    pub id: Uuid,
    pub time_item_id: Uuid,
    pub user_id: Uuid,
    pub role: String,
    pub rsvp_status: String,
    pub rsvp_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddTimeItemUser {
    pub user_id: Uuid,
    pub role: Option<String>,
}

// ============================================================================
// TimeItem Group
// ============================================================================

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct TimeItemGroup {
    pub id: Uuid,
    pub time_item_id: Uuid,
    pub group_id: Uuid,
    pub role: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddTimeItemGroup {
    pub group_id: Uuid,
    pub role: Option<String>,
}

// ============================================================================
// Share TimeItem
// ============================================================================

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareTimeItem {
    pub users: Option<Vec<AddTimeItemUser>>,
    pub groups: Option<Vec<AddTimeItemGroup>>,
}

// ============================================================================
// TimeItem Dependency
// ============================================================================

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct TimeItemDependency {
    pub id: Uuid,
    pub time_item_id: Uuid,
    pub depends_on_id: Uuid,
    pub dependency_type: String,
    pub lag_minutes: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddDependency {
    pub depends_on_id: Uuid,
    #[serde(rename = "type")]
    pub dependency_type: Option<String>,
    pub lag_minutes: Option<i32>,
}

// ============================================================================
// Recurrence Rule
// ============================================================================

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct RecurrenceRule {
    pub id: Uuid,
    pub time_item_id: Uuid,
    pub frequency: String,
    pub interval_value: i32,
    pub days_of_week: Vec<i32>,
    pub day_of_month: Option<i32>,
    pub month_of_year: Option<i32>,
    pub week_of_month: Option<i32>,
    pub end_date: Option<DateTime<Utc>>,
    pub occurrence_count: Option<i32>,
    pub exceptions: Vec<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurrenceRuleInput {
    pub frequency: String,
    pub interval: Option<i32>,
    pub days_of_week: Option<Vec<i32>>,
    pub day_of_month: Option<i32>,
    pub month_of_year: Option<i32>,
    pub week_of_month: Option<i32>,
    pub end_date: Option<DateTime<Utc>>,
    pub count: Option<i32>,
}

// ============================================================================
// Scheduling Resource
// ============================================================================

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct SchedulingResource {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub resource_type: String,
    pub description: Option<String>,
    pub capacity: Option<i32>,
    pub location: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSchedulingResource {
    pub name: String,
    pub resource_type: String,
    pub description: Option<String>,
    pub capacity: Option<i32>,
    pub location: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

// ============================================================================
// Template
// ============================================================================

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct SchedulingTemplate {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub items: serde_json::Value,
    pub created_by: Uuid,
    pub is_public: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSchedulingTemplate {
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub items: Vec<CreateTimeItem>,
}

// ============================================================================
// User Scheduling Preferences
// ============================================================================

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchedulingPreferences {
    pub id: Uuid,
    pub user_id: Uuid,
    pub peak_hours_start: i32,
    pub peak_hours_end: i32,
    pub pomodoro_length: i32,
    pub short_break_length: i32,
    pub long_break_length: i32,
    pub pomodoros_until_long_break: i32,
    pub show_weekends: bool,
    pub show_24_hour: bool,
    pub default_view: String,
    pub default_scope: String,
    pub week_starts_on: i32,
    pub reminder_defaults: Vec<i32>,
    pub enable_sound_notifications: bool,
    pub enable_desktop_notifications: bool,
    pub energy_profile: Option<serde_json::Value>,
    pub preferred_deep_work_time: String,
    pub auto_schedule_enabled: bool,
    pub respect_blockers: bool,
    pub buffer_between_meetings: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSchedulingPreferences {
    pub peak_hours_start: Option<i32>,
    pub peak_hours_end: Option<i32>,
    pub pomodoro_length: Option<i32>,
    pub short_break_length: Option<i32>,
    pub long_break_length: Option<i32>,
    pub pomodoros_until_long_break: Option<i32>,
    pub show_weekends: Option<bool>,
    pub show_24_hour: Option<bool>,
    pub default_view: Option<String>,
    pub default_scope: Option<String>,
    pub week_starts_on: Option<i32>,
    pub reminder_defaults: Option<Vec<i32>>,
    pub enable_sound_notifications: Option<bool>,
    pub enable_desktop_notifications: Option<bool>,
    pub energy_profile: Option<serde_json::Value>,
    pub preferred_deep_work_time: Option<String>,
    pub auto_schedule_enabled: Option<bool>,
    pub respect_blockers: Option<bool>,
    pub buffer_between_meetings: Option<i32>,
}

// ============================================================================
// TimeItem with Relations
// ============================================================================

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeItemWithRelations {
    #[serde(flatten)]
    pub item: TimeItem,
    pub users: Vec<TimeItemUser>,
    pub groups: Vec<TimeItemGroup>,
    pub dependencies: Vec<TimeItemDependency>,
    pub recurrence: Option<RecurrenceRule>,
}
