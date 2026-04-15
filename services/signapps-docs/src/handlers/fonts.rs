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

/// Storage bucket holding the universal fonts catalog.
const FONTS_BUCKET: &str = "system-fonts";

/// Key of the manifest JSON inside the `FONTS_BUCKET`.
const MANIFEST_KEY: &str = "manifest.json";

/// Default internal URL of the `signapps-storage` service.
const DEFAULT_STORAGE_URL: &str = "http://localhost:3004";

/// Returns the internal base URL of the storage service.
///
/// Reads `STORAGE_INTERNAL_URL`, falling back to `DEFAULT_STORAGE_URL`.
/// Trailing slashes are trimmed for clean URL concatenation.
fn storage_base_url() -> String {
    std::env::var("STORAGE_INTERNAL_URL")
        .unwrap_or_else(|_| DEFAULT_STORAGE_URL.to_string())
        .trim_end_matches('/')
        .to_string()
}

/// Fetches the raw bytes for a key inside the fonts bucket from storage.
///
/// Returns an `(status, message)` error tuple on any transport error or
/// non-2xx response. The upstream status is preserved for logging but the
/// caller decides how to map it to its own response code.
async fn fetch_from_storage(key: &str) -> Result<(Vec<u8>, String), (StatusCode, String)> {
    let url = format!("{}/api/v1/files/{}/{}", storage_base_url(), FONTS_BUCKET, key);
    let client = reqwest::Client::new();

    let resp = client.get(&url).send().await.map_err(|err| {
        tracing::warn!(?err, key, "failed to reach storage service");
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "storage unreachable".to_string(),
        )
    })?;

    let status = resp.status();
    if !status.is_success() {
        tracing::warn!(key, %status, "storage returned non-success for fonts asset");
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            format!("storage returned {status}"),
        ));
    }

    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();

    let bytes = resp.bytes().await.map_err(|err| {
        tracing::warn!(?err, key, "failed to read storage response body");
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "failed to read storage body".to_string(),
        )
    })?;

    Ok((bytes.to_vec(), content_type))
}

/// Returns the JSON manifest for the universal fonts catalog.
///
/// # Errors
///
/// Returns `503 Service Unavailable` if the manifest is not yet synced,
/// the storage service is unreachable, or its response cannot be read.
///
/// # Panics
///
/// Aucun panic possible — toutes les erreurs sont propagées via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/fonts/manifest",
    responses(
        (status = 200, description = "Fonts catalog", body = FontsManifest),
        (status = 503, description = "Catalog not synced yet"),
    ),
    tag = "fonts"
)]
#[tracing::instrument(skip(state))]
pub async fn get_manifest(
    State(state): State<AppState>,
) -> Result<Response, (StatusCode, String)> {
    let _ = state; // State kept for future caching / DB-backed lookups.

    let (bytes, _content_type) = fetch_from_storage(MANIFEST_KEY).await?;

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::CACHE_CONTROL, "public, max-age=86400")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(Body::from(bytes))
        .map_err(|err| {
            tracing::error!(?err, "failed to build manifest response");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to build response".to_string(),
            )
        })
}
