//! Presentation, slide layout, and slide models for the Slides system.
//!
//! Covers `content.presentations`, `content.slide_layouts`, and `content.slides`.
//! A presentation owns a set of reusable layouts and an ordered list of slides.
//! Each slide references an optional layout and carries its own elements (shapes,
//! text boxes, images, charts) as a JSON array.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

// ============================================================================
// Presentation
// ============================================================================

/// A presentation document with theme, dimensions, and optional master reference.
///
/// Presentations are linked to a `document_id` in the content system and scoped
/// to a tenant. The `theme` JSON object carries global styling tokens
/// (background colour, font family, accent colour, palette).
///
/// # Examples
///
/// ```rust,ignore
/// let pres = Presentation {
///     title: "Q2 Review".into(),
///     slide_width: 960.0,
///     slide_height: 540.0,
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
pub struct Presentation {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Associated document in the content system.
    pub document_id: Uuid,
    /// Tenant that owns this presentation.
    pub tenant_id: Uuid,
    /// Display title of the presentation.
    pub title: String,
    /// Optional master presentation ID for style inheritance.
    pub master_id: Option<Uuid>,
    /// Theme tokens: `{backgroundColor, fontFamily, accentColor, palette[]}`.
    pub theme: serde_json::Value,
    /// Canvas width in logical pixels (default 960).
    pub slide_width: f64,
    /// Canvas height in logical pixels (default 540).
    pub slide_height: f64,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last-updated timestamp.
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// CreatePresentation
// ============================================================================

/// Request payload to create a new presentation.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreatePresentation {
    /// Display title (defaults to "Untitled Presentation" if omitted).
    pub title: Option<String>,
    /// Theme tokens (defaults to `{}` if omitted).
    pub theme: Option<serde_json::Value>,
    /// Canvas width in logical pixels (defaults to 960).
    pub slide_width: Option<f64>,
    /// Canvas height in logical pixels (defaults to 540).
    pub slide_height: Option<f64>,
}

// ============================================================================
// SlideLayout
// ============================================================================

/// A reusable slide layout with placeholder definitions.
///
/// Each presentation owns a set of layouts (seeded by default via
/// `content.seed_default_layouts`). A layout defines named placeholders
/// that guide element positioning when a slide is created from it.
///
/// # Examples
///
/// ```rust,ignore
/// let layout = SlideLayout {
///     name: "Title + Content".into(),
///     layout_type: "title_content".into(),
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
pub struct SlideLayout {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Presentation this layout belongs to.
    pub presentation_id: Uuid,
    /// Human-readable name (e.g. "Title Slide", "Two Columns").
    pub name: String,
    /// Layout category: `title_slide`, `title_content`, `two_columns`,
    /// `blank`, `section_header`, `image_text`, `comparison`.
    pub layout_type: String,
    /// Placeholder definitions: `[{type, x, y, width, height, label}]`.
    pub placeholders: serde_json::Value,
    /// Display order among layouts in this presentation.
    pub sort_order: i32,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
}

// ============================================================================
// Slide
// ============================================================================

/// A single slide within a presentation.
///
/// Slides hold an ordered list of elements (shapes, text boxes, images, charts)
/// as a JSON array, optional speaker notes, and transition configuration.
///
/// # Examples
///
/// ```rust,ignore
/// let slide = Slide {
///     sort_order: 0,
///     elements: serde_json::json!([{"type": "text", "x": 40, "y": 20}]),
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
pub struct Slide {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Presentation this slide belongs to.
    pub presentation_id: Uuid,
    /// Optional layout used as a template for this slide.
    pub layout_id: Option<Uuid>,
    /// Position in the slide deck (0-based).
    pub sort_order: i32,
    /// Slide elements: `[{type, x, y, width, height, ...shape data}]`.
    pub elements: serde_json::Value,
    /// Speaker notes (plain text or markdown).
    pub speaker_notes: Option<String>,
    /// Transition effect: `none`, `fade`, `slide`, `zoom`.
    pub transition_type: Option<String>,
    /// Transition duration in milliseconds (default 500).
    pub transition_duration: Option<i32>,
    /// Whether this slide is hidden during playback.
    pub is_hidden: Option<bool>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last-updated timestamp.
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// CreateSlide
// ============================================================================

/// Request payload to create a new slide.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateSlide {
    /// Optional layout to base this slide on.
    pub layout_id: Option<Uuid>,
    /// Position in the slide deck (appended at end if omitted).
    pub sort_order: Option<i32>,
    /// Slide elements (defaults to `[]` if omitted).
    pub elements: Option<serde_json::Value>,
    /// Speaker notes.
    pub speaker_notes: Option<String>,
}

// ============================================================================
// UpdateSlide
// ============================================================================

/// Request payload to update an existing slide.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateSlide {
    /// Layout to associate with this slide.
    pub layout_id: Option<Uuid>,
    /// New position in the slide deck.
    pub sort_order: Option<i32>,
    /// Updated slide elements.
    pub elements: Option<serde_json::Value>,
    /// Updated speaker notes.
    pub speaker_notes: Option<String>,
    /// Transition effect: `none`, `fade`, `slide`, `zoom`.
    pub transition_type: Option<String>,
    /// Transition duration in milliseconds.
    pub transition_duration: Option<i32>,
    /// Whether this slide is hidden during playback.
    pub is_hidden: Option<bool>,
}
