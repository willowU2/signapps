//! Trash/recycle bin handlers - Soft delete with recovery.
#![allow(dead_code)]

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use sqlx::Row;
use uuid::Uuid;

use crate::handlers::quotas;
use crate::AppState;

/// Trash item information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrashItem {
    pub id: Uuid,
    pub original_bucket: String,
    pub original_key: String,
    pub trash_key: String,
    pub filename: String,
    pub size: i64,
    pub content_type: Option<String>,
    pub deleted_by: Uuid,
    pub deleted_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

/// Move to trash request.
#[derive(Debug, Deserialize)]
pub struct MoveToTrashRequest {
    pub bucket: String,
    pub keys: Vec<String>,
}

/// Move to trash response.
#[derive(Debug, Serialize)]
pub struct MoveToTrashResponse {
    pub moved: Vec<TrashItem>,
    pub failed: Vec<TrashFailure>,
}

/// Trash operation failure.
#[derive(Debug, Serialize)]
pub struct TrashFailure {
    pub key: String,
    pub error: String,
}

/// Restore from trash request.
#[derive(Debug, Deserialize)]
pub struct RestoreRequest {
    pub items: Vec<Uuid>,
    /// Restore to original location or new location
    pub destination: Option<RestoreDestination>,
}

/// Restore destination.
#[derive(Debug, Deserialize)]
pub struct RestoreDestination {
    pub bucket: String,
    pub prefix: Option<String>,
}

/// Restore response.
#[derive(Debug, Serialize)]
pub struct RestoreResponse {
    pub restored: Vec<RestoredItem>,
    pub failed: Vec<RestoreFailure>,
}

/// Restored item info.
#[derive(Debug, Serialize)]
pub struct RestoredItem {
    pub id: Uuid,
    pub bucket: String,
    pub key: String,
}

/// Restore failure.
#[derive(Debug, Serialize)]
pub struct RestoreFailure {
    pub id: Uuid,
    pub error: String,
}

/// List trash query.
#[derive(Debug, Deserialize)]
pub struct ListTrashQuery {
    pub bucket: Option<String>,
    pub search: Option<String>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

/// List trash response.
#[derive(Debug, Serialize)]
pub struct ListTrashResponse {
    pub items: Vec<TrashItem>,
    pub total: i64,
    pub total_size: i64,
}

/// Trash stats.
#[derive(Debug, Serialize)]
pub struct TrashStats {
    pub total_items: i64,
    pub total_size: i64,
    pub oldest_item: Option<DateTime<Utc>>,
    pub items_expiring_soon: i64,
}

const TRASH_BUCKET: &str = "signapps-trash";
const TRASH_RETENTION_DAYS: i64 = 30;

/// Move files to trash (soft delete).
#[tracing::instrument(skip_all)]
pub async fn move_to_trash(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
    Json(request): Json<MoveToTrashRequest>,
) -> Result<Json<MoveToTrashResponse>> {
    let mut moved = Vec::new();
    let mut failed = Vec::new();

    // Ensure trash bucket exists
    if let Err(e) = state.storage.create_bucket(TRASH_BUCKET).await {
        tracing::warn!("Trash bucket creation warning: {}", e);
    }

    for key in &request.keys {
        match move_single_to_trash(&state, &request.bucket, key, user_id).await {
            Ok(item) => moved.push(item),
            Err(e) => failed.push(TrashFailure {
                key: key.clone(),
                error: e.to_string(),
            }),
        }
    }

    tracing::info!(
        bucket = %request.bucket,
        moved = moved.len(),
        failed = failed.len(),
        "Items moved to trash"
    );

    Ok(Json(MoveToTrashResponse { moved, failed }))
}

/// Move a single file to trash.
async fn move_single_to_trash(
    state: &AppState,
    bucket: &str,
    key: &str,
    user_id: Uuid,
) -> Result<TrashItem> {
    // Get file info before moving
    let info = state.storage.get_object_info(bucket, key).await?;

    let id = Uuid::new_v4();
    let now = Utc::now();
    let expires_at = now + chrono::Duration::days(TRASH_RETENTION_DAYS);

    // Create unique trash key
    let trash_key = format!(
        "{}/{}/{}",
        user_id,
        id,
        key.split('/').next_back().unwrap_or(key)
    );

    // Move file to trash bucket
    state
        .storage
        .move_object(bucket, key, TRASH_BUCKET, &trash_key)
        .await?;

    // Update file record in database
    if let Err(e) = quotas::record_move(state, user_id, bucket, key, TRASH_BUCKET, &trash_key).await
    {
        tracing::error!(error = %e, "Failed to update file record for trash");
    }

    // Persist trash metadata in database
    let item_row = sqlx::query(
        r#"
        INSERT INTO storage.trash (
            id, user_id, original_bucket, original_key, trash_key, size, content_type, deleted_at, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, user_id, original_bucket, original_key, trash_key, size, content_type, deleted_at, expires_at
        "#,
    )
    .bind(id)
    .bind(user_id)
    .bind(bucket)
    .bind(key)
    .bind(trash_key.clone())
    .bind(info.size)
    .bind(info.content_type.clone())
    .bind(now)
    .bind(expires_at)
    .fetch_one(state.pool.inner())
    .await?;

    Ok(TrashItem {
        id: item_row.get::<Uuid, _>("id"),
        original_bucket: item_row.get::<String, _>("original_bucket"),
        original_key: item_row.get::<String, _>("original_key"),
        trash_key: item_row.get::<String, _>("trash_key"),
        filename: key.split('/').next_back().unwrap_or(key).to_string(),
        size: item_row.get::<i64, _>("size"),
        content_type: item_row.get::<Option<String>, _>("content_type"),
        deleted_by: item_row.get::<Uuid, _>("user_id"),
        deleted_at: item_row.get::<DateTime<Utc>, _>("deleted_at"),
        expires_at: item_row.get::<DateTime<Utc>, _>("expires_at"),
    })
}

/// List items in trash.
#[tracing::instrument(skip_all)]
pub async fn list_trash(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
    Query(query): Query<ListTrashQuery>,
) -> Result<Json<ListTrashResponse>> {
    let limit = query.limit.unwrap_or(50);
    let offset = query.offset.unwrap_or(0);

    let rows = sqlx::query(
        r#"
        SELECT 
            id, user_id, original_bucket, original_key, trash_key,
            size, content_type, deleted_at, expires_at
        FROM storage.trash
        WHERE user_id = $1
        ORDER BY deleted_at DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(user_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(state.pool.inner())
    .await?;

    let items = rows
        .into_iter()
        .map(|row| TrashItem {
            id: row.get::<Uuid, _>("id"),
            original_bucket: row.get::<String, _>("original_bucket"),
            original_key: row.get::<String, _>("original_key"),
            trash_key: row.get::<String, _>("trash_key"),
            filename: row
                .get::<String, _>("original_key")
                .split('/')
                .next_back()
                .unwrap_or("")
                .to_string(), // Derive filename
            size: row.get::<i64, _>("size"),
            content_type: row.get::<Option<String>, _>("content_type"),
            deleted_by: row.get::<Uuid, _>("user_id"),
            deleted_at: row.get::<DateTime<Utc>, _>("deleted_at"),
            expires_at: row.get::<DateTime<Utc>, _>("expires_at"),
        })
        .collect();

    let total_items: i64 = sqlx::query("SELECT COUNT(*) FROM storage.trash WHERE user_id = $1")
        .bind(user_id)
        .fetch_one(state.pool.inner())
        .await?
        .get(0);

    let total_size: i64 =
        sqlx::query("SELECT COALESCE(SUM(size), 0) FROM storage.trash WHERE user_id = $1")
            .bind(user_id)
            .fetch_one(state.pool.inner())
            .await?
            .get(0);

    Ok(Json(ListTrashResponse {
        items,
        total: total_items,
        total_size,
    }))
}

/// Get trash statistics.
#[tracing::instrument(skip_all)]
pub async fn get_trash_stats(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
) -> Result<Json<TrashStats>> {
    let row = sqlx::query(
        r#"
        SELECT
            COUNT(*)                                                        AS total_items,
            COALESCE(SUM(size), 0)                                          AS total_size,
            MIN(deleted_at)                                                 AS oldest_item,
            COUNT(*) FILTER (WHERE expires_at <= NOW() + INTERVAL '7 days') AS items_expiring_soon
        FROM storage.trash
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_one(state.pool.inner())
    .await?;

    Ok(Json(TrashStats {
        total_items: row.get::<i64, _>("total_items"),
        total_size: row.get::<i64, _>("total_size"),
        oldest_item: row.get::<Option<DateTime<Utc>>, _>("oldest_item"),
        items_expiring_soon: row.get::<i64, _>("items_expiring_soon"),
    }))
}

/// Restore items from trash.
#[tracing::instrument(skip_all)]
pub async fn restore_from_trash(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
    Json(request): Json<RestoreRequest>,
) -> Result<Json<RestoreResponse>> {
    let mut restored = Vec::new();
    let mut failed = Vec::new();

    for id in &request.items {
        match restore_single_item(&state, *id, user_id, request.destination.as_ref()).await {
            Ok(item) => restored.push(item),
            Err(e) => failed.push(RestoreFailure {
                id: *id,
                error: e.to_string(),
            }),
        }
    }

    tracing::info!(
        restored = restored.len(),
        failed = failed.len(),
        "Items restored from trash"
    );

    Ok(Json(RestoreResponse { restored, failed }))
}

/// Restore a single item from trash.
async fn restore_single_item(
    state: &AppState,
    id: Uuid,
    user_id: Uuid,
    destination: Option<&RestoreDestination>,
) -> Result<RestoredItem> {
    // Fetch trash item from database
    let row = sqlx::query(
        r#"
        SELECT 
            id, user_id, original_bucket, original_key, trash_key,
            size, content_type, deleted_at, expires_at
        FROM storage.trash
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(state.pool.inner())
    .await?
    .ok_or_else(|| Error::NotFound(format!("Trash item {} not found for user {}", id, user_id)))?;

    let trash_item = TrashItem {
        id: row.get::<Uuid, _>("id"),
        original_bucket: row.get::<String, _>("original_bucket"),
        original_key: row.get::<String, _>("original_key"),
        trash_key: row.get::<String, _>("trash_key"),
        filename: row
            .get::<String, _>("original_key")
            .split('/')
            .next_back()
            .unwrap_or("")
            .to_string(), // Derive filename
        size: row.get::<i64, _>("size"),
        content_type: row.get::<Option<String>, _>("content_type"),
        deleted_by: row.get::<Uuid, _>("user_id"),
        deleted_at: row.get::<DateTime<Utc>, _>("deleted_at"),
        expires_at: row.get::<DateTime<Utc>, _>("expires_at"),
    };

    let target_bucket = destination
        .as_ref()
        .map(|d| d.bucket.clone())
        .unwrap_or(trash_item.original_bucket.clone());

    let target_key = destination
        .as_ref()
        .and_then(|d| d.prefix.clone())
        .map(|prefix| {
            format!(
                "{}/{}",
                prefix,
                trash_item
                    .original_key
                    .split('/')
                    .next_back()
                    .unwrap_or(&trash_item.original_key)
            )
        })
        .unwrap_or(trash_item.original_key.clone());

    // Move file back from trash bucket to original/new location
    state
        .storage
        .move_object(
            TRASH_BUCKET,
            &trash_item.trash_key,
            &target_bucket,
            &target_key,
        )
        .await?;

    // Update file record in database
    if let Err(e) = quotas::record_move(
        state,
        user_id,
        TRASH_BUCKET,
        &trash_item.trash_key,
        &target_bucket,
        &target_key,
    )
    .await
    {
        tracing::error!(error = %e, "Failed to update file record for restore");
    }

    // Remove from database
    sqlx::query("DELETE FROM storage.trash WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user_id)
        .execute(state.pool.inner())
        .await?;

    Ok(RestoredItem {
        id: trash_item.id,
        bucket: target_bucket,
        key: target_key,
    })
}

/// Permanently delete items from trash.
#[tracing::instrument(skip_all)]
pub async fn empty_trash(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
    Json(items): Json<Option<Vec<Uuid>>>,
) -> Result<StatusCode> {
    match items {
        Some(ids) => {
            // Delete specific items
            for id in &ids {
                if let Err(e) = delete_trash_item(&state, *id, user_id).await {
                    tracing::warn!(id = %id, error = %e, "Failed to delete trash item");
                }
            }
            tracing::info!(
                count = ids.len(),
                "Specific trash items permanently deleted"
            );
        },
        None => {
            // Empty entire trash for the user
            let rows = sqlx::query(
                r#"
                SELECT 
                    id, user_id, original_bucket, original_key, trash_key,
                    size, content_type, deleted_at, expires_at
                FROM storage.trash
                WHERE user_id = $1
                "#,
            )
            .bind(user_id)
            .fetch_all(state.pool.inner())
            .await?;

            for row in rows {
                let id: Uuid = row.get("id");
                if let Err(e) = delete_trash_item(&state, id, user_id).await {
                    tracing::warn!(id = %id, error = %e, "Failed to delete trash item during empty_trash_all");
                }
            }
            tracing::info!(user_id = %user_id, "Trash emptied for user");
        },
    }

    Ok(StatusCode::NO_CONTENT)
}

/// Delete a single trash item permanently.
async fn delete_trash_item(state: &AppState, id: Uuid, user_id: Uuid) -> Result<()> {
    let row =
        sqlx::query("SELECT trash_key, size FROM storage.trash WHERE id = $1 AND user_id = $2")
            .bind(id)
            .bind(user_id)
            .fetch_optional(state.pool.inner())
            .await?
            .ok_or_else(|| {
                Error::NotFound(format!("Trash item {} not found for user {}", id, user_id))
            })?;

    let trash_key: String = row.get("trash_key");
    let size: i64 = row.get("size");

    // Delete from storage
    if let Err(e) = state.storage.delete_object(TRASH_BUCKET, &trash_key).await {
        tracing::error!(error = %e, "Failed to delete from storage during trash purge");
    }

    // Update quota
    if let Err(e) = quotas::record_delete(state, user_id, TRASH_BUCKET, &trash_key, size).await {
        tracing::error!(error = %e, "Failed to update quota during trash purge");
    }

    // Delete from database
    sqlx::query("DELETE FROM storage.trash WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user_id)
        .execute(state.pool.inner())
        .await?;

    Ok(())
}

/// Get a specific trash item.
#[tracing::instrument(skip_all)]
pub async fn get_trash_item(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
    Path(id): Path<Uuid>,
) -> Result<Json<TrashItem>> {
    let row = sqlx::query(
        r#"
        SELECT 
            id, user_id, original_bucket, original_key, trash_key,
            size, content_type, deleted_at, expires_at
        FROM storage.trash
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(state.pool.inner())
    .await?
    .ok_or_else(|| Error::NotFound(format!("Trash item {} not found for user {}", id, user_id)))?;

    Ok(Json(TrashItem {
        id: row.get("id"),
        original_bucket: row.get("original_bucket"),
        original_key: row.get("original_key"),
        trash_key: row.get("trash_key"),
        filename: row
            .get::<String, _>("original_key")
            .split('/')
            .next_back()
            .unwrap_or("")
            .to_string(),
        size: row.get("size"),
        content_type: row.get("content_type"),
        deleted_by: row.get("user_id"),
        deleted_at: row.get("deleted_at"),
        expires_at: row.get("expires_at"),
    }))
}

/// Permanently delete a single trash item.
#[tracing::instrument(skip_all)]
pub async fn delete_trash_item_handler(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    delete_trash_item(&state, id, user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trash_retention_days() {
        assert_eq!(TRASH_RETENTION_DAYS, 30);
    }
}
