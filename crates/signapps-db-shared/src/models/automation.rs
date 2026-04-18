//! Automation, extension, and action catalog models.
//!
//! Covers `core.automations`, `core.automation_steps`, `core.automation_runs`,
//! `core.extensions`, and `core.action_catalog`. These models support the
//! visual no-code automation builder and the extension SDK infrastructure.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ============================================================================
// Automation
// ============================================================================

/// A no-code automation definition owned by a tenant.
///
/// Each automation is triggered by a specific event type and executes
/// an ordered pipeline of steps (conditions, actions, delays, loops).
///
/// # Examples
///
/// ```rust,ignore
/// let auto = Automation {
///     name: "Welcome new contacts".into(),
///     trigger_type: "form_submitted".into(),
///     ..Default::default()
/// };
/// ```
///
/// # Errors
///
/// Repository methods return `Error::Database` on constraint violations.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct Automation {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Tenant that owns this automation.
    pub tenant_id: Uuid,
    /// Human-readable name of the automation.
    pub name: String,
    /// Optional description of what this automation does.
    pub description: Option<String>,
    /// Event that triggers this automation (e.g. `form_submitted`, `schedule`).
    pub trigger_type: String,
    /// JSON configuration for the trigger (e.g. form ID, cron expression).
    pub trigger_config: serde_json::Value,
    /// Whether this automation is active and will fire on triggers.
    pub is_active: bool,
    /// User who created the automation.
    pub created_by: Uuid,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last-updated timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Request payload to create a new automation.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateAutomation {
    /// Human-readable name of the automation.
    pub name: String,
    /// Optional description of what this automation does.
    pub description: Option<String>,
    /// Event that triggers this automation.
    pub trigger_type: String,
    /// JSON configuration for the trigger.
    pub trigger_config: Option<serde_json::Value>,
}

/// Request payload to update an existing automation.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateAutomation {
    /// Updated name.
    pub name: Option<String>,
    /// Updated description.
    pub description: Option<String>,
    /// Updated trigger type.
    pub trigger_type: Option<String>,
    /// Updated trigger configuration.
    pub trigger_config: Option<serde_json::Value>,
    /// Whether this automation is active.
    pub is_active: Option<bool>,
}

// ============================================================================
// AutomationStep
// ============================================================================

/// A single step in an automation pipeline.
///
/// Steps are executed in `step_order` sequence. Each step has a type
/// (condition, action, delay, loop) and carries its configuration as JSON.
///
/// # Examples
///
/// ```rust,ignore
/// let step = AutomationStep {
///     step_type: "action".into(),
///     action_type: Some("send_email".into()),
///     ..Default::default()
/// };
/// ```
///
/// # Errors
///
/// Repository methods return `Error::Database` on constraint violations.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AutomationStep {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Automation this step belongs to.
    pub automation_id: Uuid,
    /// Position in the execution pipeline (0-based).
    pub step_order: i32,
    /// Step type: `condition`, `action`, `delay`, or `loop`.
    pub step_type: String,
    /// Action identifier from the action catalog (for `action` steps).
    pub action_type: Option<String>,
    /// JSON configuration for this step.
    pub config: serde_json::Value,
    /// Optional condition expression (for `condition` steps).
    pub condition: Option<serde_json::Value>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
}

/// Request payload to create or update a step.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateStep {
    /// Position in the execution pipeline.
    pub step_order: Option<i32>,
    /// Step type: `condition`, `action`, `delay`, or `loop`.
    pub step_type: String,
    /// Action identifier from the action catalog (for `action` steps).
    pub action_type: Option<String>,
    /// JSON configuration for this step.
    pub config: Option<serde_json::Value>,
    /// Optional condition expression (for `condition` steps).
    pub condition: Option<serde_json::Value>,
}

// ============================================================================
// AutomationRun
// ============================================================================

/// A single execution record of an automation.
///
/// Tracks the status, trigger payload, per-step results, timing, and any
/// error that occurred during execution.
///
/// # Examples
///
/// ```rust,ignore
/// let run = AutomationRun {
///     status: "running".into(),
///     ..Default::default()
/// };
/// ```
///
/// # Errors
///
/// Repository methods return `Error::Database` on constraint violations.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AutomationRun {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Automation that was executed.
    pub automation_id: Uuid,
    /// Execution status: `running`, `completed`, `failed`, or `cancelled`.
    pub status: String,
    /// The trigger event payload that started this run.
    pub trigger_payload: Option<serde_json::Value>,
    /// Per-step execution results as a JSON array.
    pub step_results: Option<serde_json::Value>,
    /// Timestamp when the run started.
    pub started_at: DateTime<Utc>,
    /// Timestamp when the run finished (if completed/failed).
    pub completed_at: Option<DateTime<Utc>>,
    /// Error message if the run failed.
    pub error: Option<String>,
    /// Total execution duration in milliseconds.
    pub duration_ms: Option<i32>,
}

// ============================================================================
// Extension
// ============================================================================

/// An installed extension (plugin) within a tenant.
///
/// Extensions must be approved by an admin before they become active.
/// Each extension declares the permissions it needs and the hooks it
/// subscribes to.
///
/// # Examples
///
/// ```rust,ignore
/// let ext = Extension {
///     name: "CRM Sync".into(),
///     version: "1.0.0".into(),
///     ..Default::default()
/// };
/// ```
///
/// # Errors
///
/// Repository methods return `Error::Database` on constraint violations.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct Extension {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Tenant that installed this extension.
    pub tenant_id: Uuid,
    /// Extension name (unique per tenant).
    pub name: String,
    /// Human-readable description.
    pub description: Option<String>,
    /// Semantic version string (e.g. "1.0.0").
    pub version: String,
    /// Entry point path or URL for the extension code.
    pub entry_point: String,
    /// Required permissions (e.g. `["read:contacts", "write:calendar"]`).
    pub permissions: Vec<String>,
    /// Hook subscriptions as JSON (e.g. `{"on_form_submit": true}`).
    pub hooks: serde_json::Value,
    /// Whether this extension is currently active.
    pub is_active: bool,
    /// Whether an admin has approved this extension.
    pub is_approved: bool,
    /// User who installed the extension.
    pub installed_by: Uuid,
    /// Admin who approved the extension (if approved).
    pub approved_by: Option<Uuid>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last-updated timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Request payload to install a new extension.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateExtension {
    /// Extension name (must be unique within the tenant).
    pub name: String,
    /// Human-readable description.
    pub description: Option<String>,
    /// Semantic version string.
    pub version: Option<String>,
    /// Entry point path or URL for the extension code.
    pub entry_point: String,
    /// Required permissions.
    pub permissions: Option<Vec<String>>,
    /// Hook subscriptions as JSON.
    pub hooks: Option<serde_json::Value>,
}

// ============================================================================
// ActionCatalogEntry
// ============================================================================

/// An entry in the action catalog -- a reusable action available to automations.
///
/// Built-in actions are seeded by migration; custom actions can be registered
/// by extensions.
///
/// # Examples
///
/// ```rust,ignore
/// let action = ActionCatalogEntry {
///     name: "send_email".into(),
///     category: "communication".into(),
///     service: "mail".into(),
///     ..Default::default()
/// };
/// ```
///
/// # Errors
///
/// Repository methods return `Error::Database` on constraint violations.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ActionCatalogEntry {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Unique action name (e.g. `send_email`, `create_task`).
    pub name: String,
    /// Human-readable display name.
    pub display_name: String,
    /// Action category (e.g. `communication`, `productivity`, `storage`).
    pub category: String,
    /// Description of what this action does.
    pub description: Option<String>,
    /// JSON schema describing the expected input parameters.
    pub input_schema: serde_json::Value,
    /// JSON schema describing the output produced by this action.
    pub output_schema: serde_json::Value,
    /// Target service that executes this action (e.g. `mail`, `calendar`).
    pub service: String,
    /// Whether this is a built-in (migration-seeded) action.
    pub is_builtin: bool,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
}
