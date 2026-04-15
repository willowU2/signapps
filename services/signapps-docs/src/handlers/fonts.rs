//! Universal fonts catalog handlers.
//!
//! Exposes a read-only JSON manifest (`/fonts/manifest`) and per-file
//! streaming endpoint (`/fonts/files/:family/:variant`). Both routes are
//! public — fonts are static assets meant to be loaded by `<link>` and
//! `@font-face` from any origin.

use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, StatusCode},
    response::Response,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::AppState;

/// JSON manifest describing the full fonts catalog.
///
/// Served as-is from storage at `system-fonts/manifest.json`. The frontend
/// loader consumes this document to know which families and variants are
/// available and where to fetch their `.woff2` files.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct FontsManifest {
    /// ISO 8601 timestamp of the last sync.
    pub generated_at: String,
    /// Manifest schema version (semver).
    pub version: String,
    /// Total number of font families in the catalog.
    pub total: usize,
    /// All available font families.
    pub families: Vec<FontFamily>,
}

/// A single font family entry in the catalog.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct FontFamily {
    /// Slug identifier, e.g. `roboto` or `fira-code-nerd-font`.
    pub id: String,
    /// Human-readable display name.
    pub name: String,
    /// Category, e.g. `sans-serif`, `serif`, `monospace`, `display`.
    pub category: String,
    /// Source feed, e.g. `google-fonts`, `nerd-fonts`, `local`.
    pub source: String,
    /// Foundry or publisher (optional).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub foundry: Option<String>,
    /// License identifier (e.g. SPDX id or `OFL-1.1`).
    pub license: String,
    /// Available variants (weights × styles).
    pub variants: Vec<FontVariant>,
    /// Popularity score used for sort order (optional).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub popularity: Option<u32>,
    /// Unicode subsets supported (optional).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subsets: Option<Vec<String>>,
}

/// A specific variant of a font family (weight + style combination).
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct FontVariant {
    /// CSS font-weight (100–900).
    pub weight: u16,
    /// CSS font-style: `normal` or `italic`.
    pub style: String,
    /// File slug (without extension) used to build the download URL.
    pub file: String,
    /// File size in bytes.
    pub size_bytes: u64,
}
