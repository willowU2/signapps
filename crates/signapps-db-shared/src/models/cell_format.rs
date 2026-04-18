//! Cell format and sheet metadata models for spreadsheet enrichment.
//!
//! Covers `content.cell_formats` and `content.sheet_metadata`.
//! Cell formats use sparse storage -- only cells with non-default formatting
//! are persisted. Sheet metadata stores frozen panes, column widths, filters, etc.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

// ============================================================================
// CellFormat
// ============================================================================

/// Cell format override (sparse -- only non-default cells stored).
///
/// Each row represents a single cell's formatting that deviates from the
/// default or inherited style. The `style_id` references a shared style
/// definition, while `format_override` holds inline property overrides.
///
/// # Examples
///
/// ```rust,ignore
/// let fmt = CellFormat {
///     cell_ref: "A1".into(),
///     format_override: serde_json::json!({"bold": true}),
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
pub struct CellFormat {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Document this cell format belongs to.
    pub document_id: Uuid,
    /// Sheet index within the document (0-based).
    pub sheet_index: i32,
    /// Cell reference string (e.g. "A1", "B5", "AA100").
    pub cell_ref: String,
    /// Optional reference to a shared style definition.
    pub style_id: Option<Uuid>,
    /// Inline format overrides on top of the referenced style.
    pub format_override: serde_json::Value,
    /// Conditional formatting rules: `[{condition, style_override}]`.
    pub conditional_rules: serde_json::Value,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last-updated timestamp.
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// UpsertCellFormat
// ============================================================================

/// Request payload to create or update a cell format.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpsertCellFormat {
    /// Cell reference string (e.g. "A1").
    pub cell_ref: String,
    /// Optional reference to a shared style definition.
    pub style_id: Option<Uuid>,
    /// Inline format overrides.
    pub format_override: Option<serde_json::Value>,
    /// Conditional formatting rules.
    pub conditional_rules: Option<serde_json::Value>,
}

// ============================================================================
// SheetMetadata
// ============================================================================

/// Sheet-level metadata (frozen panes, column widths, filters, etc.).
///
/// Stores layout and display configuration for a single sheet within
/// a spreadsheet document.
///
/// # Examples
///
/// ```rust,ignore
/// let meta = SheetMetadata {
///     sheet_name: "Budget 2026".into(),
///     frozen_rows: 1,
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
pub struct SheetMetadata {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Document this sheet belongs to.
    pub document_id: Uuid,
    /// Sheet index within the document (0-based).
    pub sheet_index: i32,
    /// Display name of the sheet tab.
    pub sheet_name: String,
    /// Number of frozen (pinned) rows at the top.
    pub frozen_rows: i32,
    /// Number of frozen (pinned) columns on the left.
    pub frozen_cols: i32,
    /// Column width overrides: `{"A": 120, "B": 80}`.
    pub col_widths: serde_json::Value,
    /// Row height overrides: `{"1": 30, "5": 50}`.
    pub row_heights: serde_json::Value,
    /// Sort configuration: `[{col, direction}]`.
    pub sort_config: serde_json::Value,
    /// Filter configuration: `[{col, expression}]`.
    pub filter_config: serde_json::Value,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last-updated timestamp.
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// UpsertSheetMetadata
// ============================================================================

/// Request payload to create or update sheet metadata.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpsertSheetMetadata {
    /// Display name of the sheet tab.
    pub sheet_name: Option<String>,
    /// Number of frozen rows at the top.
    pub frozen_rows: Option<i32>,
    /// Number of frozen columns on the left.
    pub frozen_cols: Option<i32>,
    /// Column width overrides.
    pub col_widths: Option<serde_json::Value>,
    /// Row height overrides.
    pub row_heights: Option<serde_json::Value>,
    /// Sort configuration.
    pub sort_config: Option<serde_json::Value>,
    /// Filter configuration.
    pub filter_config: Option<serde_json::Value>,
}
