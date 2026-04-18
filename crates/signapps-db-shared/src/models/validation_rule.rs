//! Design validation rule models.
//!
//! Covers `core.validation_rules` — configurable per-tenant rules for
//! checking design compliance (font sizes, allowed colours, DPI, etc.).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

// ============================================================================
// ValidationRule
// ============================================================================

/// A configurable validation rule for design compliance.
///
/// Each rule belongs to a tenant and carries a JSON `config` blob whose
/// shape depends on `rule_type` (e.g. `{"min": 10}` for `min_font_size`).
///
/// # Examples
///
/// ```rust,ignore
/// let rule = ValidationRule {
///     name: "Minimum font size".into(),
///     rule_type: "min_font_size".into(),
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
pub struct ValidationRule {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Tenant that owns this rule.
    pub tenant_id: Uuid,
    /// Human-readable display name.
    pub name: String,
    /// Rule category (e.g. `min_font_size`, `allowed_fonts`).
    pub rule_type: String,
    /// Rule-specific configuration (JSON object).
    pub config: serde_json::Value,
    /// Severity level: `error`, `warning`, or `info`.
    pub severity: String,
    /// Whether the rule is currently active.
    pub is_active: bool,
    /// Document types this rule applies to.
    pub applies_to: Vec<String>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
}

// ============================================================================
// CreateValidationRule
// ============================================================================

/// Input payload to create a new validation rule.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateValidationRule {
    /// Human-readable display name.
    pub name: String,
    /// Rule category (e.g. `min_font_size`, `allowed_fonts`).
    pub rule_type: String,
    /// Rule-specific configuration (JSON object).
    pub config: serde_json::Value,
    /// Severity level (defaults to `warning`).
    pub severity: Option<String>,
    /// Document types this rule applies to (defaults to all).
    pub applies_to: Option<Vec<String>>,
}

// ============================================================================
// UpdateValidationRule
// ============================================================================

/// Input payload to update an existing validation rule.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateValidationRule {
    /// Updated display name.
    pub name: Option<String>,
    /// Updated configuration.
    pub config: Option<serde_json::Value>,
    /// Updated severity.
    pub severity: Option<String>,
    /// Toggle active/inactive.
    pub is_active: Option<bool>,
    /// Updated document types.
    pub applies_to: Option<Vec<String>>,
}

// ============================================================================
// ValidationIssue
// ============================================================================

/// A validation issue found when checking a document against rules.
///
/// Returned by the `/check` endpoint as a list of issues.
///
/// # Errors
///
/// This struct is an output-only DTO -- no error conditions.
///
/// # Panics
///
/// No panics possible.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ValidationIssue {
    /// Name of the rule that triggered this issue.
    pub rule_name: String,
    /// Type of the rule (e.g. `min_font_size`).
    pub rule_type: String,
    /// Severity: `error`, `warning`, or `info`.
    pub severity: String,
    /// Human-readable description of the issue.
    pub message: String,
    /// JSON path to the offending element (if applicable).
    pub element_path: Option<String>,
}
