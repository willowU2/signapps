//! Document versioning models -- command log and snapshots.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// A single mutation command in the document command log.
///
/// Each command records a before/after pair so that undo is possible
/// by reverting to `before_value`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct DocumentCommand {
    /// Auto-incremented sequence number.
    pub id: i64,
    /// The document this command belongs to.
    pub document_id: Uuid,
    /// The user who performed the command.
    pub user_id: Uuid,
    /// Type of mutation (e.g. "insert", "delete", "update", "format").
    pub command_type: String,
    /// JSON-path-like target within the document (optional).
    pub target_path: Option<String>,
    /// State before the command was applied (for undo).
    pub before_value: Option<serde_json::Value>,
    /// State after the command was applied.
    pub after_value: Option<serde_json::Value>,
    /// Timestamp of the command.
    pub created_at: DateTime<Utc>,
}

/// Input for appending a command to the log.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AppendCommand {
    /// Type of mutation (e.g. "insert", "delete", "update", "format").
    pub command_type: String,
    /// JSON-path-like target within the document (optional).
    pub target_path: Option<String>,
    /// State before the command was applied (for undo).
    pub before_value: Option<serde_json::Value>,
    /// State after the command was applied.
    pub after_value: Option<serde_json::Value>,
}

/// A document snapshot (compacted state at a point in time).
///
/// Snapshots are created periodically to avoid replaying the entire
/// command log. The `version` field auto-increments per document.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct DocumentSnapshot {
    /// Unique snapshot identifier.
    pub id: Uuid,
    /// The document this snapshot belongs to.
    pub document_id: Uuid,
    /// Monotonically increasing version number within a document.
    pub version: i32,
    /// Full document content at this point in time.
    pub content: serde_json::Value,
    /// Optional human-readable label (e.g. "Before reformat").
    pub label: Option<String>,
    /// The user who created the snapshot (if any).
    pub created_by: Option<Uuid>,
    /// Timestamp of snapshot creation.
    pub created_at: DateTime<Utc>,
}

/// Input for creating a snapshot.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateSnapshot {
    /// Full document content to snapshot.
    pub content: serde_json::Value,
    /// Optional human-readable label.
    pub label: Option<String>,
}

/// A diff entry between two snapshots.
///
/// Produced by comparing the top-level keys of two snapshot JSONB objects.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct DiffEntry {
    /// The top-level key that changed.
    pub path: String,
    /// Type of change: "added", "removed", or "changed".
    pub change_type: String,
    /// Value in the first (older) snapshot, if present.
    pub old_value: Option<serde_json::Value>,
    /// Value in the second (newer) snapshot, if present.
    pub new_value: Option<serde_json::Value>,
}
