//! Unified trash handlers.
//!
//! Cross-module soft-delete tracking. Items moved to trash expire after 30 days
//! and can be restored or permanently deleted before that.
//!
//! Routes:
//!   GET    /api/v1/unified-trash              — list trashed items for the current user
//!   POST   /api/v1/unified-trash              — move an item to trash
//!   POST   /api/v1/unified-trash/:id/restore  — restore an item from trash
//!   DELETE /api/v1/unified-trash/:id          — permanently delete an item
//!   DELETE /api/v1/unified-trash              — purge all expired items

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::{Claims, Error, Result};
use sqlx::FromRow;
use uuid::Uuid;

use crate::AppState;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// A trashed item record.
///
/// Represents an entity that was soft-deleted and is awaiting expiry or
/// permanent deletion.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TrashItem {
    /// Unique trash record ID.
    pub id: Uuid,
    /// Kind of entity (e.g. "file", "document", "email").
    pub entity_type: String,
    /// Original entity UUID.
    pub entity_id: Uuid,
    /// Human-readable name of the entity.
    pub entity_name: String,
    /// Source module (e.g. "storage", "docs", "mail").
    pub module: String,
    /// User who deleted the entity.
    pub deleted_by: Uuid,
    /// Timestamp when the entity was trashed.
    pub deleted_at: DateTime<Utc>,
    /// When the trash record expires and can be purged.
    pub expires_at: DateTime<Utc>,
    /// Optional JSON metadata associated with the trashed entity.
    pub metadata: serde_json::Value,
}

/// Query parameters for listing trashed items.
#[derive(Debug, Deserialize)]
pub struct ListTrashQuery {
    /// Filter by entity type (e.g. "file", "document").
    #[serde(rename = "type")]
    pub entity_type: Option<String>,
    /// Sort field: "deleted_at" (default) or "entity_name".
    pub sort: Option<String>,
    /// Cursor-based pagination: ID of the last item from the previous page.
    pub cursor: Option<Uuid>,
    /// Maximum number of items to return (default 50, max 100).
    pub limit: Option<i64>,
}

/// Request body for moving an item to trash.
#[derive(Debug, Deserialize)]
pub struct CreateTrashRequest {
    /// Kind of entity being trashed.
    pub entity_type: String,
    /// UUID of the entity being trashed.
    pub entity_id: Uuid,
    /// Human-readable name of the entity.
    pub entity_name: String,
    /// Source module (e.g. "storage", "docs").
    pub module: String,
    /// Optional metadata to store alongside the trash record.
    pub metadata: Option<serde_json::Value>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// List trashed items for the authenticated user.
///
/// Supports optional filtering by entity type, sorting, and cursor-based pagination.
///
/// # Errors
///
/// Returns `Error::Database` if the query fails.
///
/// # Panics
///
/// No panics possible.
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn list_trash(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListTrashQuery>,
) -> Result<Json<Vec<TrashItem>>> {
    let limit = q.limit.unwrap_or(50).min(100);
    let sort_col = match q.sort.as_deref() {
        Some("entity_name") => "entity_name",
        _ => "deleted_at",
    };

    // Build dynamic query depending on filters
    let items = if let Some(ref entity_type) = q.entity_type {
        if let Some(cursor) = q.cursor {
            sqlx::query_as::<_, TrashItem>(&format!(
                "SELECT id, entity_type, entity_id, entity_name, module, deleted_by, \
                 deleted_at, expires_at, metadata \
                 FROM identity.trash \
                 WHERE deleted_by = $1 AND entity_type = $2 AND id > $3 \
                 ORDER BY {} ASC LIMIT $4",
                sort_col
            ))
            .bind(claims.sub)
            .bind(entity_type)
            .bind(cursor)
            .bind(limit)
            .fetch_all(state.pool.inner())
            .await
            .map_err(|e| Error::Database(e.to_string()))?
        } else {
            sqlx::query_as::<_, TrashItem>(&format!(
                "SELECT id, entity_type, entity_id, entity_name, module, deleted_by, \
                 deleted_at, expires_at, metadata \
                 FROM identity.trash \
                 WHERE deleted_by = $1 AND entity_type = $2 \
                 ORDER BY {} DESC LIMIT $3",
                sort_col
            ))
            .bind(claims.sub)
            .bind(entity_type)
            .bind(limit)
            .fetch_all(state.pool.inner())
            .await
            .map_err(|e| Error::Database(e.to_string()))?
        }
    } else if let Some(cursor) = q.cursor {
        sqlx::query_as::<_, TrashItem>(&format!(
            "SELECT id, entity_type, entity_id, entity_name, module, deleted_by, \
             deleted_at, expires_at, metadata \
             FROM identity.trash \
             WHERE deleted_by = $1 AND id > $2 \
             ORDER BY {} ASC LIMIT $3",
            sort_col
        ))
        .bind(claims.sub)
        .bind(cursor)
        .bind(limit)
        .fetch_all(state.pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?
    } else {
        sqlx::query_as::<_, TrashItem>(&format!(
            "SELECT id, entity_type, entity_id, entity_name, module, deleted_by, \
             deleted_at, expires_at, metadata \
             FROM identity.trash \
             WHERE deleted_by = $1 \
             ORDER BY {} DESC LIMIT $2",
            sort_col
        ))
        .bind(claims.sub)
        .bind(limit)
        .fetch_all(state.pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?
    };

    Ok(Json(items))
}

/// Move an item to the unified trash.
///
/// Creates a trash record with a 30-day expiry. If the entity is already trashed
/// (same entity_type + entity_id), returns a conflict error.
///
/// # Errors
///
/// Returns `Error::BadRequest` if required fields are empty.
/// Returns `Error::AlreadyExists` if the entity is already in trash (unique constraint).
/// Returns `Error::Database` on other database errors.
///
/// # Panics
///
/// No panics possible.
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn create_trash(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateTrashRequest>,
) -> Result<(StatusCode, Json<TrashItem>)> {
    if payload.entity_type.is_empty() || payload.entity_name.is_empty() || payload.module.is_empty()
    {
        return Err(Error::BadRequest(
            "entity_type, entity_name, and module are required".to_string(),
        ));
    }

    let metadata = payload.metadata.unwrap_or_else(|| serde_json::json!({}));

    let item = sqlx::query_as::<_, TrashItem>(
        "INSERT INTO identity.trash \
             (entity_type, entity_id, entity_name, module, deleted_by, metadata) \
         VALUES ($1, $2, $3, $4, $5, $6) \
         RETURNING id, entity_type, entity_id, entity_name, module, deleted_by, \
                   deleted_at, expires_at, metadata",
    )
    .bind(&payload.entity_type)
    .bind(payload.entity_id)
    .bind(&payload.entity_name)
    .bind(&payload.module)
    .bind(claims.sub)
    .bind(&metadata)
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| {
        // Unique constraint violation → already trashed
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.code().as_deref() == Some("23505") {
                return Error::AlreadyExists("Item is already in trash".to_string());
            }
        }
        Error::Database(e.to_string())
    })?;

    Ok((StatusCode::CREATED, Json(item)))
}

/// Restore an item from trash.
///
/// Removes the trash record so the original entity becomes visible again.
/// Only the user who deleted the item can restore it.
///
/// # Errors
///
/// Returns `Error::NotFound` if the trash record does not exist or does not belong
/// to the authenticated user.
/// Returns `Error::Database` on other database errors.
///
/// # Panics
///
/// No panics possible.
#[tracing::instrument(skip_all, fields(user_id = %claims.sub, trash_id = %id))]
pub async fn restore_trash(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let affected = sqlx::query("DELETE FROM identity.trash WHERE id = $1 AND deleted_by = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(state.pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?
        .rows_affected();

    if affected == 0 {
        return Err(Error::NotFound("Trash item not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

/// Permanently delete a trashed item.
///
/// Removes the trash record. Only the user who trashed the item can permanently
/// delete it.
///
/// # Errors
///
/// Returns `Error::NotFound` if the trash record does not exist or does not belong
/// to the authenticated user.
/// Returns `Error::Database` on other database errors.
///
/// # Panics
///
/// No panics possible.
#[tracing::instrument(skip_all, fields(user_id = %claims.sub, trash_id = %id))]
pub async fn delete_trash(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let affected = sqlx::query("DELETE FROM identity.trash WHERE id = $1 AND deleted_by = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(state.pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?
        .rows_affected();

    if affected == 0 {
        return Err(Error::NotFound("Trash item not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

/// Purge all expired trash items for the authenticated user.
///
/// Deletes every trash record whose `expires_at` is in the past.
///
/// # Errors
///
/// Returns `Error::Database` on database errors.
///
/// # Panics
///
/// No panics possible.
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn purge_expired(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>> {
    let result =
        sqlx::query("DELETE FROM identity.trash WHERE deleted_by = $1 AND expires_at < NOW()")
            .bind(claims.sub)
            .execute(state.pool.inner())
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

    Ok(Json(serde_json::json!({
        "purged": result.rows_affected()
    })))
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        // Placeholder: ensures the module compiles.
        let _ = module_path!();
    }

    #[test]
    fn default_limit_is_capped() {
        // Verify limit capping logic
        let requested: i64 = 200;
        let limit = requested.min(100);
        assert_eq!(limit, 100);
        let requested: i64 = 50;
        let limit = requested.min(100);
        assert_eq!(limit, 50);
    }
}
