//! Style definition models for the cascade inheritance system.
//!
//! Covers `core.style_definitions` and `core.template_styles`.
//! Styles follow a cascade chain: base -> org -> template -> local override.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

// ============================================================================
// StyleDefinition
// ============================================================================

/// A style definition with optional parent for cascade inheritance.
///
/// Represents paragraph, character, cell, or slide styles that can form
/// an inheritance chain via `parent_id`. Properties are merged from root
/// to leaf, with child properties overriding parent values.
///
/// # Examples
///
/// ```rust,ignore
/// let style = StyleDefinition {
///     name: "Heading 1".into(),
///     style_type: "paragraph".into(),
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
pub struct StyleDefinition {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Tenant that owns this style.
    pub tenant_id: Uuid,
    /// Display name of the style.
    pub name: String,
    /// Style category: `paragraph`, `character`, `cell`, `slide`.
    pub style_type: String,
    /// Optional parent style for cascade inheritance.
    pub parent_id: Option<Uuid>,
    /// Style properties (JSON object merged during resolution).
    pub properties: serde_json::Value,
    /// Whether this style is a built-in default (cannot be modified).
    pub is_builtin: bool,
    /// Visibility scope: `global`, `template`, `document`.
    pub scope: String,
    /// Optional document this style is scoped to.
    pub document_id: Option<Uuid>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last-updated timestamp.
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// CreateStyle
// ============================================================================

/// Request payload to create a new style definition.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateStyle {
    /// Display name.
    pub name: String,
    /// Style category: `paragraph`, `character`, `cell`, `slide`.
    pub style_type: String,
    /// Optional parent style for inheritance.
    pub parent_id: Option<Uuid>,
    /// Style properties (JSON object).
    pub properties: serde_json::Value,
    /// Visibility scope (defaults to `global`).
    pub scope: Option<String>,
    /// Optional document this style is scoped to.
    pub document_id: Option<Uuid>,
}

// ============================================================================
// UpdateStyle
// ============================================================================

/// Request payload to update an existing style definition.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateStyle {
    /// Display name.
    pub name: Option<String>,
    /// Parent style for inheritance.
    pub parent_id: Option<Uuid>,
    /// Style properties (JSON object).
    pub properties: Option<serde_json::Value>,
}

// ============================================================================
// ResolvedStyle
// ============================================================================

/// Resolved style -- all properties merged from the inheritance chain.
///
/// Produced by walking the `parent_id` chain from leaf to root and merging
/// properties root-first (child properties override parent values, like CSS).
///
/// # Errors
///
/// `StyleRepository::resolve` returns `Error::NotFound` if the style ID does not exist.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ResolvedStyle {
    /// Style ID (the leaf of the chain).
    pub id: Uuid,
    /// Display name of the leaf style.
    pub name: String,
    /// Style category.
    pub style_type: String,
    /// Merged properties from the entire inheritance chain.
    pub properties: serde_json::Value,
    /// IDs of styles in the chain, from leaf to root.
    pub inheritance_chain: Vec<Uuid>,
}
