//! Template variable models for dynamic document generation.
//!
//! Covers `core.template_variables`, `core.template_datasets`, and
//! `core.social_presets`. Variables use `{{name}}` placeholders that
//! are resolved at export time via simple string replacement.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ============================================================================
// TemplateVariable
// ============================================================================

/// A variable placeholder defined on a document template.
///
/// Variables are referenced in document content as `{{name}}` and resolved
/// at export time by replacing occurrences with caller-supplied values.
///
/// # Examples
///
/// ```rust,ignore
/// let var = TemplateVariable {
///     name: "company_name".into(),
///     variable_type: "text".into(),
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
pub struct TemplateVariable {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Tenant that owns this variable.
    pub tenant_id: Uuid,
    /// Template this variable belongs to.
    pub template_id: Uuid,
    /// Variable name (used in `{{name}}` placeholders).
    pub name: String,
    /// Variable type: `text`, `image`, `date`, or `list`.
    pub variable_type: String,
    /// Default value if none is provided at resolve time.
    pub default_value: Option<String>,
    /// Human-readable description of the variable.
    pub description: Option<String>,
    /// Whether a value must be provided at resolve time.
    pub required: bool,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
}

// ============================================================================
// CreateTemplateVariable
// ============================================================================

/// Request payload to create a new template variable.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateTemplateVariable {
    /// Variable name (used in `{{name}}` placeholders).
    pub name: String,
    /// Variable type: `text`, `image`, `date`, or `list`.
    pub variable_type: String,
    /// Default value if none is provided at resolve time.
    pub default_value: Option<String>,
    /// Human-readable description of the variable.
    pub description: Option<String>,
    /// Whether a value must be provided at resolve time.
    pub required: Option<bool>,
}

// ============================================================================
// TemplateDataset
// ============================================================================

/// A named dataset attached to a template for batch variable resolution.
///
/// The `data` field contains a JSON array of objects, where each object
/// maps variable names to values for one batch row.
///
/// # Examples
///
/// ```rust,ignore
/// // data: [{"name": "Alice", "email": "alice@example.com"}, ...]
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
pub struct TemplateDataset {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Tenant that owns this dataset.
    pub tenant_id: Uuid,
    /// Template this dataset belongs to.
    pub template_id: Uuid,
    /// Human-readable name of the dataset.
    pub name: String,
    /// Array of row objects (each maps variable name to value).
    pub data: serde_json::Value,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
}

// ============================================================================
// CreateDataset
// ============================================================================

/// Request payload to create a new template dataset.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateDataset {
    /// Human-readable name of the dataset.
    pub name: String,
    /// Array of row objects (each maps variable name to value).
    pub data: serde_json::Value,
}

// ============================================================================
// SocialPreset
// ============================================================================

/// A social media format preset (platform + dimensions).
///
/// Pre-populated from the `core.social_presets` seed data. Used by
/// the template system to offer standard social-media canvas sizes.
///
/// # Examples
///
/// ```rust,ignore
/// // Instagram Post: 1080x1080, aspect_ratio "1:1"
/// ```
///
/// # Errors
///
/// Repository methods return `Error::Database` on query failure.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct SocialPreset {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Social platform name (e.g. `instagram`, `facebook`).
    pub platform: String,
    /// Format name within the platform (e.g. `Post`, `Story`).
    pub format_name: String,
    /// Canvas width in pixels.
    pub width: i32,
    /// Canvas height in pixels.
    pub height: i32,
    /// Aspect ratio string (e.g. `1:1`, `16:9`).
    pub aspect_ratio: Option<String>,
    /// Human-readable description.
    pub description: Option<String>,
}
