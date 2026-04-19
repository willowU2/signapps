//! Photo upload handlers — SO4 IN4.
//!
//! Endpoints :
//! - `POST   /api/v1/org/persons/:id/photo`    — upload + resize 512x512
//! - `DELETE /api/v1/org/persons/:id/photo`    — clear `photo_url`
//! - `POST   /api/v1/org/nodes/:id/group-photo` — same for a node
//! - `DELETE /api/v1/org/nodes/:id/group-photo`
//!
//! Storage : the resized PNG/JPEG/WebP is uploaded under
//! `org-photos/{tenant}/{kind}/{id}.png` via the FS storage backend.
//! In dev the FS backend writes to `STORAGE_FS_ROOT` (default
//! `./data/storage/`).

use std::path::PathBuf;

use axum::{
    extract::{Multipart, Path, State},
    http::StatusCode,
    routing::{delete as axum_delete, post},
    Json, Router,
};
use image::{imageops::FilterType, ImageFormat};
use serde::Serialize;
use signapps_common::{Error, Result};
use uuid::Uuid;

use crate::AppState;

/// Maximum upload size (5 MB).
pub const MAX_UPLOAD_BYTES: usize = 5 * 1024 * 1024;
/// Target resize dimension (square crop).
pub const RESIZE_DIM: u32 = 512;

/// Build the photos router (mounted at `/api/v1/org`).
pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/persons/:id/photo",
            post(upload_person_photo).delete(delete_person_photo),
        )
        .route(
            "/nodes/:id/group-photo",
            post(upload_node_photo).delete(delete_node_photo),
        )
        // Allow plain DELETE alias used by the UI (`/persons/:id/photo`).
        .route(
            "/persons/:id/photo/clear",
            axum_delete(delete_person_photo),
        )
}

/// Same routes but absolute paths under `/api/v1/org`, so the parent
/// router can `.merge(...)` without nesting (avoids collisions with
/// the persons / nodes nested routers).
pub fn routes_absolute() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/org/persons/:id/photo",
            post(upload_person_photo).delete(delete_person_photo),
        )
        .route(
            "/api/v1/org/nodes/:id/group-photo",
            post(upload_node_photo).delete(delete_node_photo),
        )
}

// ─── Responses ────────────────────────────────────────────────────────

/// JSON returned by the upload endpoints.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct PhotoResponse {
    /// Public URL (relative when FS backend, absolute when S3).
    pub url: String,
    /// MIME type stored.
    pub content_type: String,
    /// Final byte size after resize.
    pub size: usize,
}

// ─── Person handlers ──────────────────────────────────────────────────

/// POST /api/v1/org/persons/:id/photo
#[utoipa::path(
    post,
    path = "/api/v1/org/persons/{id}/photo",
    tag = "Org Photos",
    params(("id" = Uuid, Path, description = "Person UUID")),
    responses(
        (status = 200, description = "Photo uploaded", body = PhotoResponse),
        (status = 400, description = "Validation failure (size, mime, image decode)"),
        (status = 404, description = "Person not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, multipart))]
pub async fn upload_person_photo(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    multipart: Multipart,
) -> Result<Json<PhotoResponse>> {
    let tenant_id = fetch_person_tenant(&st, id).await?;
    let (bytes, content_type) = read_image_part(multipart).await?;
    let (resized, mime, size) = resize_to_512(&bytes, &content_type)?;
    let url = persist_photo(tenant_id, "persons", id, &resized, &mime).await?;

    sqlx::query("UPDATE org_persons SET photo_url = $2, updated_at = now() WHERE id = $1")
        .bind(id)
        .bind(&url)
        .execute(st.pool.inner())
        .await
        .map_err(|e| Error::Database(format!("update person photo_url: {e}")))?;

    Ok(Json(PhotoResponse {
        url,
        content_type: mime,
        size,
    }))
}

/// DELETE /api/v1/org/persons/:id/photo
#[utoipa::path(
    delete,
    path = "/api/v1/org/persons/{id}/photo",
    tag = "Org Photos",
    params(("id" = Uuid, Path, description = "Person UUID")),
    responses(
        (status = 204, description = "Photo cleared"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn delete_person_photo(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    sqlx::query("UPDATE org_persons SET photo_url = NULL, updated_at = now() WHERE id = $1")
        .bind(id)
        .execute(st.pool.inner())
        .await
        .map_err(|e| Error::Database(format!("clear person photo_url: {e}")))?;
    Ok(StatusCode::NO_CONTENT)
}

// ─── Node handlers ────────────────────────────────────────────────────

/// POST /api/v1/org/nodes/:id/group-photo
#[utoipa::path(
    post,
    path = "/api/v1/org/nodes/{id}/group-photo",
    tag = "Org Photos",
    params(("id" = Uuid, Path, description = "Node UUID")),
    responses(
        (status = 200, description = "Group photo uploaded", body = PhotoResponse),
        (status = 400, description = "Validation failure"),
        (status = 404, description = "Node not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, multipart))]
pub async fn upload_node_photo(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    multipart: Multipart,
) -> Result<Json<PhotoResponse>> {
    let tenant_id = fetch_node_tenant(&st, id).await?;
    let (bytes, content_type) = read_image_part(multipart).await?;
    let (resized, mime, size) = resize_to_512(&bytes, &content_type)?;
    let url = persist_photo(tenant_id, "nodes", id, &resized, &mime).await?;

    sqlx::query(
        "UPDATE org_nodes SET group_photo_url = $2, updated_at = now() WHERE id = $1",
    )
    .bind(id)
    .bind(&url)
    .execute(st.pool.inner())
    .await
    .map_err(|e| Error::Database(format!("update node group_photo_url: {e}")))?;

    Ok(Json(PhotoResponse {
        url,
        content_type: mime,
        size,
    }))
}

/// DELETE /api/v1/org/nodes/:id/group-photo
#[utoipa::path(
    delete,
    path = "/api/v1/org/nodes/{id}/group-photo",
    tag = "Org Photos",
    params(("id" = Uuid, Path, description = "Node UUID")),
    responses(
        (status = 204, description = "Photo cleared"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn delete_node_photo(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    sqlx::query(
        "UPDATE org_nodes SET group_photo_url = NULL, updated_at = now() WHERE id = $1",
    )
    .bind(id)
    .execute(st.pool.inner())
    .await
    .map_err(|e| Error::Database(format!("clear node group_photo_url: {e}")))?;
    Ok(StatusCode::NO_CONTENT)
}

// ─── Helpers ──────────────────────────────────────────────────────────

async fn fetch_person_tenant(st: &AppState, id: Uuid) -> Result<Uuid> {
    let row: Option<(Uuid,)> = sqlx::query_as(
        "SELECT tenant_id FROM org_persons WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(st.pool.inner())
    .await
    .map_err(|e| Error::Database(format!("fetch person: {e}")))?;
    row.map(|r| r.0)
        .ok_or_else(|| Error::NotFound(format!("org person {id}")))
}

async fn fetch_node_tenant(st: &AppState, id: Uuid) -> Result<Uuid> {
    let row: Option<(Uuid,)> = sqlx::query_as(
        "SELECT tenant_id FROM org_nodes WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(st.pool.inner())
    .await
    .map_err(|e| Error::Database(format!("fetch node: {e}")))?;
    row.map(|r| r.0)
        .ok_or_else(|| Error::NotFound(format!("org node {id}")))
}

/// Pull the first `file=` part out of the multipart payload. Caps at
/// [`MAX_UPLOAD_BYTES`] and validates the content-type.
async fn read_image_part(mut multipart: Multipart) -> Result<(Vec<u8>, String)> {
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| Error::BadRequest(format!("multipart parse: {e}")))?
    {
        if field.name() != Some("file") {
            continue;
        }
        let content_type = field
            .content_type()
            .map(str::to_string)
            .unwrap_or_else(|| "application/octet-stream".to_string());
        if !is_supported_mime(&content_type) {
            return Err(Error::BadRequest(format!(
                "unsupported content_type: {content_type}"
            )));
        }
        let bytes = field
            .bytes()
            .await
            .map_err(|e| Error::BadRequest(format!("read multipart bytes: {e}")))?;
        if bytes.len() > MAX_UPLOAD_BYTES {
            return Err(Error::BadRequest(format!(
                "file too large ({} bytes, max {MAX_UPLOAD_BYTES})",
                bytes.len()
            )));
        }
        return Ok((bytes.to_vec(), content_type));
    }
    Err(Error::BadRequest("missing 'file' part".to_string()))
}

fn is_supported_mime(mime: &str) -> bool {
    matches!(
        mime,
        "image/jpeg" | "image/jpg" | "image/png" | "image/webp"
    )
}

/// Decode + resize to 512x512 (preserve aspect ratio, then center crop).
/// Returns (PNG bytes, "image/png", size).
fn resize_to_512(bytes: &[u8], _orig_mime: &str) -> Result<(Vec<u8>, String, usize)> {
    let img = image::load_from_memory(bytes)
        .map_err(|e| Error::BadRequest(format!("decode image: {e}")))?;
    let resized = img.resize_to_fill(RESIZE_DIM, RESIZE_DIM, FilterType::Lanczos3);
    let mut out = Vec::with_capacity(64 * 1024);
    let mut cursor = std::io::Cursor::new(&mut out);
    resized
        .write_to(&mut cursor, ImageFormat::Png)
        .map_err(|e| Error::Internal(format!("encode PNG: {e}")))?;
    let len = out.len();
    Ok((out, "image/png".to_string(), len))
}

/// Persist the bytes under the FS storage root and return a URL the
/// frontend can fetch through `signapps-storage`.
async fn persist_photo(
    tenant_id: Uuid,
    kind: &'static str,
    entity_id: Uuid,
    bytes: &[u8],
    _mime: &str,
) -> Result<String> {
    let root = std::env::var("STORAGE_FS_ROOT").unwrap_or_else(|_| "./data/storage".to_string());
    let bucket = "org-photos";
    let rel = format!("{tenant_id}/{kind}/{entity_id}.png");
    let abs = PathBuf::from(&root).join(bucket).join(&rel);

    if let Some(parent) = abs.parent() {
        if let Err(e) = tokio::fs::create_dir_all(parent).await {
            return Err(Error::Internal(format!("mkdir {parent:?}: {e}")));
        }
    }
    if let Err(e) = tokio::fs::write(&abs, bytes).await {
        return Err(Error::Internal(format!("write photo {abs:?}: {e}")));
    }

    // Return a stable URL — frontend resolves it through the storage
    // service (`/api/v1/storage/files/{bucket}/{key}`) or directly when
    // dev uses a static-files mount.
    Ok(format!("/storage/{bucket}/{rel}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn supported_mime_matrix() {
        assert!(is_supported_mime("image/png"));
        assert!(is_supported_mime("image/jpeg"));
        assert!(is_supported_mime("image/webp"));
        assert!(!is_supported_mime("image/gif"));
        assert!(!is_supported_mime("application/pdf"));
    }

    #[test]
    fn resize_decodes_png_bytes() {
        // 1x1 transparent PNG.
        let png: &[u8] = &[
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48,
            0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00,
            0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41, 0x54, 0x78,
            0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
        ];
        let (bytes, mime, size) = resize_to_512(png, "image/png").expect("resize 1x1 png");
        assert_eq!(mime, "image/png");
        assert!(size > 0);
        assert_eq!(bytes.len(), size);
    }
}
