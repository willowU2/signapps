//! Universal fonts catalog handlers.
//!
//! Exposes a read-only JSON manifest (`/fonts/manifest`) and per-file
//! streaming endpoint (`/fonts/files/:family/:variant`). Both routes are
//! public — fonts are static assets meant to be loaded by `<link>` and
//! `@font-face` from any origin.
//!
//! `FontsManifest`, `FontFamily`, and `FontVariant` describe the shape
//! published in the OpenAPI spec via `utoipa::ToSchema`. The handler
//! streams the JSON straight from storage rather than deserialising,
//! so the types are not constructed at runtime — silence the dead-code
//! lint while keeping the schema discoverable.
#![allow(dead_code)]

use std::sync::OnceLock;
use std::time::Duration;

use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, StatusCode},
    response::Response,
};
use bytes::Bytes;
use serde::{Deserialize, Serialize};
use url::Url;

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

/// Process-wide `reqwest` client used to talk to `signapps-storage`.
///
/// A single client is built lazily and reused across all font requests.
/// Building a fresh client per call leaks a connection pool on every call
/// and costs ~1 ms in TLS setup (see `reqwest::Client::new` docs).
static STORAGE_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

/// Returns the shared [`reqwest::Client`] used to contact storage.
///
/// Configured with:
/// - `timeout(10s)` so a stuck storage backend cannot hang a font request
///   forever.
/// - `redirect::Policy::none()` so an attacker cannot coerce this server-side
///   fetch into following a redirect to an internal URL (SSRF guard).
fn storage_client() -> &'static reqwest::Client {
    STORAGE_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new())
    })
}

/// Returns the internal base URL of the storage service.
///
/// Reads `STORAGE_INTERNAL_URL`, falling back to [`DEFAULT_STORAGE_URL`].
/// The scheme is validated: only `http` and `https` are accepted. Anything
/// else (`file://`, `gopher://`, `javascript:` …) falls back to the default
/// to avoid SSRF via env-var injection in shared-host setups.
/// Trailing slashes are trimmed for clean URL concatenation.
fn validated_storage_base() -> String {
    let raw = std::env::var("STORAGE_INTERNAL_URL")
        .unwrap_or_else(|_| DEFAULT_STORAGE_URL.to_string());
    let trimmed = raw.trim_end_matches('/').to_string();
    match Url::parse(&trimmed) {
        Ok(u) if matches!(u.scheme(), "http" | "https") => trimmed,
        _ => {
            tracing::warn!(value = %raw, "invalid STORAGE_INTERNAL_URL, using default");
            DEFAULT_STORAGE_URL.to_string()
        },
    }
}

/// Fetches the raw bytes for a key inside the fonts bucket from storage.
///
/// The returned `StatusCode` in the error tuple is the status the handler
/// should forward to its client:
/// - upstream `404` is mapped to `NOT_FOUND` so callers can surface a proper
///   "font missing" error;
/// - upstream `401` / `403`, upstream `5xx` and network failures are all
///   mapped to `SERVICE_UNAVAILABLE` — from the public API's perspective the
///   catalog is simply not reachable.
async fn fetch_from_storage(key: &str) -> Result<Bytes, (StatusCode, String)> {
    let url = format!(
        "{}/api/v1/files/{}/{}",
        validated_storage_base(),
        FONTS_BUCKET,
        key
    );

    let resp = storage_client().get(&url).send().await.map_err(|err| {
        tracing::warn!(?err, key, "failed to reach storage service");
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "storage unreachable".to_string(),
        )
    })?;

    let status = resp.status();
    if !status.is_success() {
        tracing::warn!(key, %status, "storage returned non-success for fonts asset");
        let mapped = if status == reqwest::StatusCode::NOT_FOUND {
            StatusCode::NOT_FOUND
        } else {
            StatusCode::SERVICE_UNAVAILABLE
        };
        return Err((mapped, format!("storage returned {status}")));
    }

    let bytes = resp.bytes().await.map_err(|err| {
        tracing::warn!(?err, key, "failed to read storage response body");
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "failed to read storage body".to_string(),
        )
    })?;

    Ok(bytes)
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

    // For the manifest, any failure — missing file or storage down — is
    // reported as 503. We refine the body text based on the upstream status
    // so operators get a useful hint without leaking internal details.
    let bytes = fetch_from_storage(MANIFEST_KEY).await.map_err(|(upstream, _)| {
        let msg = if upstream == StatusCode::NOT_FOUND {
            "Fonts catalog not yet synced — run scripts/sync-fonts".to_string()
        } else {
            "Fonts catalog temporarily unavailable".to_string()
        };
        (StatusCode::SERVICE_UNAVAILABLE, msg)
    })?;

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

/// Validates a URL slug used to build the path to a font file.
///
/// Only accepts ASCII lowercase letters, digits and dashes. This blocks
/// path traversal (`..`, `/`), extension tampering (`.woff2`), mixed case
/// and whitespace — keeping the on-disk lookup strictly flat and
/// predictable.
fn is_valid_slug(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 100
        && s.chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// Streams a single `.woff2` font file from storage.
///
/// The file is looked up at `system-fonts/{family}/{variant}.woff2`.
/// Both slugs are strictly validated (`is_valid_slug`) to prevent path
/// traversal.
///
/// # Errors
///
/// - `400 Bad Request` if either slug is invalid.
/// - `404 Not Found` if the font file does not exist in storage.
/// - `503 Service Unavailable` if storage is down or returns an auth / 5xx error.
///
/// # Panics
///
/// Aucun panic possible — toutes les erreurs sont propagées via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/fonts/files/{family}/{variant}",
    params(
        ("family" = String, Path, description = "Font family slug (lowercase, digits, dashes)"),
        ("variant" = String, Path, description = "Font variant slug (e.g. `regular`, `bold-italic`)"),
    ),
    responses(
        (status = 200, description = "woff2 font file"),
        (status = 400, description = "Invalid slug"),
        (status = 404, description = "Font not found"),
        (status = 503, description = "File not available"),
    ),
    tag = "fonts"
)]
#[tracing::instrument(skip(state))]
pub async fn get_font_file(
    State(state): State<AppState>,
    Path((family, variant)): Path<(String, String)>,
) -> Result<Response, (StatusCode, String)> {
    let _ = state;

    if !is_valid_slug(&family) || !is_valid_slug(&variant) {
        tracing::debug!(family, variant, "rejected invalid font slug");
        return Err((StatusCode::BAD_REQUEST, "invalid slug".into()));
    }

    // Propagate the status decided by `fetch_from_storage`: missing file is
    // reported as 404, other upstream failures as 503.
    let key = format!("{family}/{variant}.woff2");
    let bytes = fetch_from_storage(&key).await?;
    let content_length = bytes.len();

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "font/woff2")
        .header(header::CONTENT_LENGTH, content_length)
        // max-age but NOT immutable: the URL is slug-keyed, not
        // content-hashed, so allow revalidation on user reload.
        .header(header::CACHE_CONTROL, "public, max-age=2592000")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(Body::from(bytes))
        .map_err(|err| {
            tracing::error!(?err, "failed to build font file response");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to build response".to_string(),
            )
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slug_accepts_simple_lowercase() {
        assert!(is_valid_slug("roboto"));
        assert!(is_valid_slug("fira-code-nerd-font"));
        assert!(is_valid_slug("regular"));
        assert!(is_valid_slug("bold-italic"));
    }

    #[test]
    fn slug_rejects_path_traversal() {
        assert!(!is_valid_slug(""));
        assert!(!is_valid_slug("../etc/passwd"));
        assert!(!is_valid_slug("foo/bar"));
        assert!(!is_valid_slug("foo.woff2"));
        assert!(!is_valid_slug("Foo"));
        assert!(!is_valid_slug("foo bar"));
    }
}
