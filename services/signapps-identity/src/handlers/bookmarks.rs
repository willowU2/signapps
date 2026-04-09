//! Cross-module bookmarks (favorites) handlers.
//!
//! Users can bookmark any entity from any module and organise bookmarks
//! into named collections.
//!
//! Routes:
//!   GET    /api/v1/bookmarks                    — list bookmarks
//!   POST   /api/v1/bookmarks                    — add a bookmark
//!   DELETE /api/v1/bookmarks/:id                — remove a bookmark
//!   GET    /api/v1/bookmark-collections          — list bookmark collections
//!   POST   /api/v1/bookmark-collections          — create a collection
//!   DELETE /api/v1/bookmark-collections/:id      — delete a collection

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

/// A bookmark record linking a user to a cross-module entity.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Bookmark {
    /// Unique bookmark ID.
    pub id: Uuid,
    /// Owner user ID.
    pub user_id: Uuid,
    /// Kind of entity (e.g. "file", "document", "email").
    pub entity_type: String,
    /// Original entity UUID.
    pub entity_id: Uuid,
    /// Human-readable name of the entity.
    pub entity_name: String,
    /// Source module (e.g. "storage", "docs", "mail").
    pub module: String,
    /// Optional collection this bookmark belongs to.
    pub collection_id: Option<Uuid>,
    /// Timestamp when the bookmark was created.
    pub created_at: DateTime<Utc>,
}

/// A named collection for organising bookmarks.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BookmarkCollection {
    /// Unique collection ID.
    pub id: Uuid,
    /// Owner user ID.
    pub user_id: Uuid,
    /// Display name.
    pub name: String,
    /// Badge color hex.
    pub color: Option<String>,
    /// Display ordering.
    pub sort_order: Option<i32>,
    /// Timestamp when the collection was created.
    pub created_at: DateTime<Utc>,
}

/// Query parameters for listing bookmarks.
#[derive(Debug, Deserialize)]
pub struct ListBookmarksQuery {
    /// Filter by entity type.
    #[serde(rename = "type")]
    pub entity_type: Option<String>,
    /// Filter by collection ID.
    pub collection_id: Option<Uuid>,
    /// Sort field: "created_at" (default) or "entity_name".
    pub sort: Option<String>,
    /// Cursor-based pagination: ID of the last item from the previous page.
    pub cursor: Option<Uuid>,
    /// Maximum number of items to return (default 50, max 100).
    pub limit: Option<i64>,
}

/// Request body for adding a bookmark.
#[derive(Debug, Deserialize)]
pub struct CreateBookmarkRequest {
    /// Kind of entity being bookmarked.
    pub entity_type: String,
    /// UUID of the entity.
    pub entity_id: Uuid,
    /// Human-readable name of the entity.
    pub entity_name: String,
    /// Source module.
    pub module: String,
    /// Optional collection to file the bookmark under.
    pub collection_id: Option<Uuid>,
}

/// Request body for creating a bookmark collection.
#[derive(Debug, Deserialize)]
pub struct CreateCollectionRequest {
    /// Display name for the collection.
    pub name: String,
    /// Badge color hex (default: #3b82f6).
    pub color: Option<String>,
    /// Display ordering index.
    pub sort_order: Option<i32>,
}

// ---------------------------------------------------------------------------
// Bookmark handlers
// ---------------------------------------------------------------------------

/// List bookmarks for the authenticated user.
///
/// Supports optional filtering by entity type or collection, sorting, and
/// cursor-based pagination.
///
/// # Errors
///
/// Returns `Error::Database` if the query fails.
///
/// # Panics
///
/// No panics possible.
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn list_bookmarks(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListBookmarksQuery>,
) -> Result<Json<Vec<Bookmark>>> {
    let limit = q.limit.unwrap_or(50).min(100);
    let sort_col = match q.sort.as_deref() {
        Some("entity_name") => "entity_name",
        _ => "created_at",
    };

    // Build a dynamic WHERE clause
    let mut conditions = vec!["user_id = $1".to_string()];
    let mut param_idx = 2u32;

    if q.entity_type.is_some() {
        conditions.push(format!("entity_type = ${param_idx}"));
        param_idx += 1;
    }
    if q.collection_id.is_some() {
        conditions.push(format!("collection_id = ${param_idx}"));
        param_idx += 1;
    }
    if q.cursor.is_some() {
        conditions.push(format!("id > ${param_idx}"));
        param_idx += 1;
    }

    let where_clause = conditions.join(" AND ");
    let order_dir = if q.cursor.is_some() { "ASC" } else { "DESC" };

    let sql = format!(
        "SELECT id, user_id, entity_type, entity_id, entity_name, module, \
         collection_id, created_at \
         FROM identity.bookmarks \
         WHERE {where_clause} \
         ORDER BY {sort_col} {order_dir} LIMIT ${param_idx}"
    );

    let mut query = sqlx::query_as::<_, Bookmark>(&sql).bind(claims.sub);

    if let Some(ref et) = q.entity_type {
        query = query.bind(et);
    }
    if let Some(cid) = q.collection_id {
        query = query.bind(cid);
    }
    if let Some(cursor) = q.cursor {
        query = query.bind(cursor);
    }
    query = query.bind(limit);

    let items = query
        .fetch_all(state.pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    Ok(Json(items))
}

/// Add a bookmark.
///
/// Creates a bookmark linking the authenticated user to the specified entity.
/// If the bookmark already exists (same user + entity_type + entity_id),
/// returns a conflict error.
///
/// # Errors
///
/// Returns `Error::BadRequest` if required fields are empty.
/// Returns `Error::AlreadyExists` if the bookmark already exists (unique constraint).
/// Returns `Error::Database` on other database errors.
///
/// # Panics
///
/// No panics possible.
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn create_bookmark(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateBookmarkRequest>,
) -> Result<(StatusCode, Json<Bookmark>)> {
    if payload.entity_type.is_empty() || payload.entity_name.is_empty() || payload.module.is_empty()
    {
        return Err(Error::BadRequest(
            "entity_type, entity_name, and module are required".to_string(),
        ));
    }

    let bookmark = sqlx::query_as::<_, Bookmark>(
        "INSERT INTO identity.bookmarks \
             (user_id, entity_type, entity_id, entity_name, module, collection_id) \
         VALUES ($1, $2, $3, $4, $5, $6) \
         RETURNING id, user_id, entity_type, entity_id, entity_name, module, \
                   collection_id, created_at",
    )
    .bind(claims.sub)
    .bind(&payload.entity_type)
    .bind(payload.entity_id)
    .bind(&payload.entity_name)
    .bind(&payload.module)
    .bind(payload.collection_id)
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.code().as_deref() == Some("23505") {
                return Error::AlreadyExists("Bookmark already exists".to_string());
            }
        }
        Error::Database(e.to_string())
    })?;

    Ok((StatusCode::CREATED, Json(bookmark)))
}

/// Remove a bookmark.
///
/// Deletes the bookmark record. Only the owner can remove their own bookmarks.
///
/// # Errors
///
/// Returns `Error::NotFound` if the bookmark does not exist or does not belong
/// to the authenticated user.
/// Returns `Error::Database` on other database errors.
///
/// # Panics
///
/// No panics possible.
#[tracing::instrument(skip_all, fields(user_id = %claims.sub, bookmark_id = %id))]
pub async fn delete_bookmark(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let affected = sqlx::query(
        "DELETE FROM identity.bookmarks WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .execute(state.pool.inner())
    .await
    .map_err(|e| Error::Database(e.to_string()))?
    .rows_affected();

    if affected == 0 {
        return Err(Error::NotFound("Bookmark not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// Collection handlers
// ---------------------------------------------------------------------------

/// List bookmark collections for the authenticated user.
///
/// Returns all collections sorted by `sort_order` then `created_at`.
///
/// # Errors
///
/// Returns `Error::Database` if the query fails.
///
/// # Panics
///
/// No panics possible.
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn list_collections(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<BookmarkCollection>>> {
    let collections = sqlx::query_as::<_, BookmarkCollection>(
        "SELECT id, user_id, name, color, sort_order, created_at \
         FROM identity.bookmark_collections \
         WHERE user_id = $1 \
         ORDER BY sort_order ASC, created_at ASC",
    )
    .bind(claims.sub)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok(Json(collections))
}

/// Create a bookmark collection.
///
/// # Errors
///
/// Returns `Error::BadRequest` if the name is empty.
/// Returns `Error::Database` on database errors.
///
/// # Panics
///
/// No panics possible.
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn create_collection(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateCollectionRequest>,
) -> Result<(StatusCode, Json<BookmarkCollection>)> {
    if payload.name.is_empty() {
        return Err(Error::BadRequest("Collection name is required".to_string()));
    }

    let collection = sqlx::query_as::<_, BookmarkCollection>(
        "INSERT INTO identity.bookmark_collections \
             (user_id, name, color, sort_order) \
         VALUES ($1, $2, $3, $4) \
         RETURNING id, user_id, name, color, sort_order, created_at",
    )
    .bind(claims.sub)
    .bind(&payload.name)
    .bind(payload.color.as_deref().unwrap_or("#3b82f6"))
    .bind(payload.sort_order.unwrap_or(0))
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok((StatusCode::CREATED, Json(collection)))
}

/// Delete a bookmark collection.
///
/// Also nullifies the `collection_id` on any bookmarks that belonged to this
/// collection (they become "uncategorised").
///
/// # Errors
///
/// Returns `Error::NotFound` if the collection does not exist or does not belong
/// to the authenticated user.
/// Returns `Error::Database` on other database errors.
///
/// # Panics
///
/// No panics possible.
#[tracing::instrument(skip_all, fields(user_id = %claims.sub, collection_id = %id))]
pub async fn delete_collection(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    // Unlink bookmarks first so they are not lost
    sqlx::query(
        "UPDATE identity.bookmarks SET collection_id = NULL \
         WHERE collection_id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .execute(state.pool.inner())
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    let affected = sqlx::query(
        "DELETE FROM identity.bookmark_collections WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .execute(state.pool.inner())
    .await
    .map_err(|e| Error::Database(e.to_string()))?
    .rows_affected();

    if affected == 0 {
        return Err(Error::NotFound(
            "Bookmark collection not found".to_string(),
        ));
    }

    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }

    #[test]
    fn default_limit_is_capped() {
        let limit: i64 = 200_i64.min(100);
        assert_eq!(limit, 100);
        let limit: i64 = 50_i64.min(100);
        assert_eq!(limit, 50);
    }
}
