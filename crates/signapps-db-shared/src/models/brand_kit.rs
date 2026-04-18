//! Brand kit model -- per-tenant visual identity.
//!
//! Stores colors, fonts, logos, and brand guidelines for a tenant so that
//! all generated documents, presentations, and exports use a consistent
//! visual identity.
//!
//! # Examples
//!
//! ```rust,ignore
//! let kit = BrandKit {
//!     name: "Acme Corp".into(),
//!     primary_color: "#1a73e8".into(),
//!     ..Default::default()
//! };
//! ```
//!
//! # Errors
//!
//! Repository methods return `Error::Database` on constraint violations.
//!
//! # Panics
//!
//! No panics possible -- all errors are propagated via `Result`.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

/// Per-tenant brand kit with colors, fonts, and logos.
///
/// Each tenant has exactly one brand kit (enforced by `UNIQUE` on `tenant_id`).
/// The kit is auto-created with sensible defaults when first accessed.
///
/// # Examples
///
/// ```rust,ignore
/// let kit = BrandKitRepository::get(&pool, tenant_id).await?;
/// println!("Primary color: {}", kit.primary_color);
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
pub struct BrandKit {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Tenant that owns this brand kit.
    pub tenant_id: Uuid,
    /// Display name for this brand kit.
    pub name: String,
    /// Primary brand color (CSS hex, e.g. `"#3b82f6"`).
    pub primary_color: String,
    /// Secondary brand color (CSS hex).
    pub secondary_color: String,
    /// Accent color for highlights (CSS hex).
    pub accent_color: String,
    /// Danger / error color (CSS hex).
    pub danger_color: String,
    /// Success / positive color (CSS hex).
    pub success_color: String,
    /// Additional palette colors (JSON array of hex strings).
    pub colors: serde_json::Value,
    /// Font family map: `{"heading": "...", "body": "...", "mono": "..."}`.
    pub fonts: serde_json::Value,
    /// Logo URLs: `{"primary": "...", "secondary": "...", "icon": "..."}`.
    pub logos: serde_json::Value,
    /// Free-form brand usage guidelines (Markdown or plain text).
    pub guidelines: String,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last-updated timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Request payload to update a brand kit.
///
/// All fields are optional -- only supplied fields are updated (COALESCE pattern).
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateBrandKit {
    /// Display name.
    pub name: Option<String>,
    /// Primary brand color (CSS hex).
    pub primary_color: Option<String>,
    /// Secondary brand color (CSS hex).
    pub secondary_color: Option<String>,
    /// Accent color (CSS hex).
    pub accent_color: Option<String>,
    /// Danger color (CSS hex).
    pub danger_color: Option<String>,
    /// Success color (CSS hex).
    pub success_color: Option<String>,
    /// Additional palette colors (JSON array).
    pub colors: Option<serde_json::Value>,
    /// Font family map.
    pub fonts: Option<serde_json::Value>,
    /// Logo URLs.
    pub logos: Option<serde_json::Value>,
    /// Brand usage guidelines.
    pub guidelines: Option<String>,
}
