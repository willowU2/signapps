//! Favorites handlers - Bookmark files and folders.
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

use crate::AppState;

/// Favorite item.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Favorite {
    pub id: Uuid,
    pub user_id: Uuid,
    pub bucket: String,
    pub key: String,
    pub is_folder: bool,
    pub display_name: Option<String>,
    pub color: Option<String>,
    pub added_at: DateTime<Utc>,
    pub sort_order: i32,
}

/// Add favorite request.
#[derive(Debug, Deserialize)]
pub struct AddFavoriteRequest {
    pub bucket: String,
    pub key: String,
    pub is_folder: bool,
    pub display_name: Option<String>,
    pub color: Option<String>,
}

/// Update favorite request.
#[derive(Debug, Deserialize)]
pub struct UpdateFavoriteRequest {
    pub display_name: Option<String>,
    pub color: Option<String>,
    pub sort_order: Option<i32>,
}

/// Reorder favorites request.
#[derive(Debug, Deserialize)]
pub struct ReorderFavoritesRequest {
    pub order: Vec<Uuid>,
}

/// List favorites query.
#[derive(Debug, Deserialize)]
pub struct ListFavoritesQuery {
    pub bucket: Option<String>,
    pub folders_only: Option<bool>,
    pub files_only: Option<bool>,
}

/// List favorites response.
#[derive(Debug, Serialize)]
pub struct ListFavoritesResponse {
    pub favorites: Vec<FavoriteWithInfo>,
    pub total: i64,
}

/// Favorite with file info.
#[derive(Debug, Serialize)]
pub struct FavoriteWithInfo {
    #[serde(flatten)]
    pub favorite: Favorite,
    pub filename: String,
    pub size: Option<i64>,
    pub content_type: Option<String>,
    pub exists: bool,
}

/// Helper to map a row to a Favorite struct
fn map_row_to_favorite(row: &sqlx::postgres::PgRow) -> Result<Favorite> {
    Ok(Favorite {
        id: row.get::<Uuid, _>("id"),
        user_id: row.get::<Uuid, _>("user_id"),
        bucket: row.get::<String, _>("bucket"),
        key: row.get::<String, _>("key"),
        is_folder: row.get::<bool, _>("is_folder"),
        display_name: row.get::<Option<String>, _>("display_name"),
        color: row.get::<Option<String>, _>("color"),
        added_at: row.get::<DateTime<Utc>, _>("added_at"),
        sort_order: row.get::<i32, _>("sort_order"),
    })
}

/// Add a file or folder to favorites.
#[tracing::instrument(skip(state, user_id))]
pub async fn add_favorite(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
    Json(request): Json<AddFavoriteRequest>,
) -> Result<Json<Favorite>> {
    // Verify item exists if not a folder
    if !request.is_folder {
        let _info = state
            .storage
            .get_object_info(&request.bucket, &request.key)
            .await?;
    }

    let row = sqlx::query(
        r#"
        INSERT INTO storage.favorites (user_id, bucket, key, is_folder, display_name, color)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id, bucket, key) DO UPDATE SET
            is_folder = EXCLUDED.is_folder,
            display_name = EXCLUDED.display_name,
            color = EXCLUDED.color
        RETURNING id, user_id, bucket, key, is_folder, display_name, color, added_at, sort_order
        "#,
    )
    .bind(user_id)
    .bind(&request.bucket)
    .bind(&request.key)
    .bind(request.is_folder)
    .bind(&request.display_name)
    .bind(&request.color)
    .fetch_one(state.pool.inner())
    .await?;

    let favorite = map_row_to_favorite(&row)?;

    tracing::info!(
        id = %favorite.id,
        bucket = %favorite.bucket,
        key = %favorite.key,
        "Favorite added"
    );

    Ok(Json(favorite))
}

/// List favorites for current user.
#[tracing::instrument(skip(state, user_id))]
pub async fn list_favorites(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
    Query(query): Query<ListFavoritesQuery>,
) -> Result<Json<ListFavoritesResponse>> {
    let rows = sqlx::query(
        r#"
        SELECT id, user_id, bucket, key, is_folder, display_name, color, added_at, sort_order
        FROM storage.favorites
        WHERE user_id = $1
          AND ($2::TEXT IS NULL OR bucket = $2)
          AND ($3::BOOLEAN IS NULL OR is_folder = $3)
          AND ($4::BOOLEAN IS NULL OR is_folder = NOT $4)
        ORDER BY sort_order ASC, added_at DESC
        "#,
    )
    .bind(user_id)
    .bind(&query.bucket)
    .bind(query.folders_only)
    .bind(query.files_only)
    .fetch_all(state.pool.inner())
    .await?;

    let favorites = rows
        .iter()
        .map(map_row_to_favorite)
        .collect::<Result<Vec<_>>>()?;

    let favorites_with_info = favorites
        .into_iter()
        .map(|fav| FavoriteWithInfo {
            filename: fav
                .key
                .split('/')
                .next_back()
                .unwrap_or(&fav.key)
                .to_string(),
            size: None,
            content_type: None,
            exists: true,
            favorite: fav,
        })
        .collect::<Vec<_>>();

    let total = favorites_with_info.len() as i64;

    Ok(Json(ListFavoritesResponse {
        favorites: favorites_with_info,
        total,
    }))
}

/// Get a specific favorite.
#[tracing::instrument(skip(state, user_id))]
pub async fn get_favorite(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
    Path(id): Path<Uuid>,
) -> Result<Json<FavoriteWithInfo>> {
    let row = sqlx::query(
        r#"
        SELECT id, user_id, bucket, key, is_folder, display_name, color, added_at, sort_order
        FROM storage.favorites
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(state.pool.inner())
    .await?
    .ok_or_else(|| Error::NotFound(format!("Favorite {} not found", id)))?;

    let favorite = map_row_to_favorite(&row)?;

    let favorite_with_info = FavoriteWithInfo {
        filename: favorite
            .key
            .split('/')
            .next_back()
            .unwrap_or(&favorite.key)
            .to_string(),
        size: None,
        content_type: None,
        exists: true,
        favorite,
    };

    Ok(Json(favorite_with_info))
}

/// Update a favorite.
#[tracing::instrument(skip(state, user_id))]
pub async fn update_favorite(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateFavoriteRequest>,
) -> Result<Json<Favorite>> {
    let row = sqlx::query(
        r#"
        UPDATE storage.favorites
        SET
            display_name = COALESCE($1, display_name),
            color = COALESCE($2, color),
            sort_order = COALESCE($3, sort_order)
        WHERE id = $4 AND user_id = $5
        RETURNING id, user_id, bucket, key, is_folder, display_name, color, added_at, sort_order
        "#,
    )
    .bind(&payload.display_name)
    .bind(&payload.color)
    .bind(payload.sort_order)
    .bind(id)
    .bind(user_id)
    .fetch_optional(state.pool.inner())
    .await?
    .ok_or_else(|| Error::NotFound(format!("Favorite {} not found", id)))?;

    let favorite = map_row_to_favorite(&row)?;

    Ok(Json(favorite))
}

/// Remove from favorites.
#[tracing::instrument(skip(state, user_id))]
pub async fn remove_favorite(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let result = sqlx::query("DELETE FROM storage.favorites WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user_id)
        .execute(state.pool.inner())
        .await?;

    if result.rows_affected() == 0 {
        return Err(Error::NotFound(format!("Favorite {} not found", id)));
    }

    tracing::info!(id = %id, user_id = %user_id, "Favorite removed");
    Ok(StatusCode::NO_CONTENT)
}

/// Remove favorite by path.
#[tracing::instrument(skip(state, user_id))]
pub async fn remove_favorite_by_path(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
    Path((bucket, key)): Path<(String, String)>,
) -> Result<StatusCode> {
    let result = sqlx::query(
        "DELETE FROM storage.favorites WHERE user_id = $1 AND bucket = $2 AND key = $3",
    )
    .bind(user_id)
    .bind(&bucket)
    .bind(&key)
    .execute(state.pool.inner())
    .await?;

    if result.rows_affected() == 0 {
        return Err(Error::NotFound(format!(
            "Favorite for {}/{} not found",
            bucket, key
        )));
    }

    Ok(StatusCode::NO_CONTENT)
}

/// Reorder favorites.
#[tracing::instrument(skip(state, user_id))]
pub async fn reorder_favorites(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
    Json(request): Json<ReorderFavoritesRequest>,
) -> Result<StatusCode> {
    let mut tx = state.pool.inner().begin().await?;

    for (index, id) in request.order.iter().enumerate() {
        sqlx::query("UPDATE storage.favorites SET sort_order = $1 WHERE id = $2 AND user_id = $3")
            .bind(index as i32)
            .bind(id)
            .bind(user_id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;

    tracing::info!(count = request.order.len(), user_id = %user_id, "Favorites reordered");
    Ok(StatusCode::OK)
}

/// Check if a path is favorited.
#[tracing::instrument(skip(state, user_id))]
pub async fn check_favorite(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
    Path((bucket, key)): Path<(String, String)>,
) -> Result<Json<bool>> {
    let row = sqlx::query("SELECT EXISTS(SELECT 1 FROM storage.favorites WHERE user_id = $1 AND bucket = $2 AND key = $3)")
        .bind(user_id)
        .bind(&bucket)
        .bind(&key)
        .fetch_one(state.pool.inner())
        .await?;

    let exists: bool = row.get::<bool, _>(0);

    Ok(Json(exists))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_favorite_creation() {
        let fav = Favorite {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            bucket: "test".to_string(),
            key: "file.txt".to_string(),
            is_folder: false,
            display_name: Some("My File".to_string()),
            color: Some("#ff0000".to_string()),
            added_at: Utc::now(),
            sort_order: 0,
        };

        assert!(!fav.is_folder);
        assert_eq!(fav.display_name, Some("My File".to_string()));
    }
}
