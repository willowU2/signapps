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
use uuid::Uuid;

use crate::AppState;

/// Favorite item.
#[derive(Debug, Clone, Serialize, Deserialize)]
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

/// Add a file or folder to favorites.
#[tracing::instrument(skip(state, _user_id))]
pub async fn add_favorite(
    State(state): State<AppState>,
    axum::Extension(_user_id): axum::Extension<Uuid>,
    Json(request): Json<AddFavoriteRequest>,
) -> Result<Json<Favorite>> {
    // Verify item exists
    if !request.is_folder {
        let _info = state.minio.get_object_info(&request.bucket, &request.key).await?;
    }

    let favorite = Favorite {
        id: Uuid::new_v4(),
        user_id: _user_id,
        bucket: request.bucket,
        key: request.key,
        is_folder: request.is_folder,
        display_name: request.display_name,
        color: request.color,
        added_at: Utc::now(),
        sort_order: 0, // TODO: Get next sort order
    };

    // TODO: Store in database

    tracing::info!(
        id = %favorite.id,
        bucket = %favorite.bucket,
        key = %favorite.key,
        "Favorite added"
    );

    Ok(Json(favorite))
}

/// List favorites for current user.
#[tracing::instrument(skip(_state))]
pub async fn list_favorites(
    State(_state): State<AppState>,
    Query(query): Query<ListFavoritesQuery>,
) -> Result<Json<ListFavoritesResponse>> {
    // TODO: Query from database with filters

    Ok(Json(ListFavoritesResponse {
        favorites: vec![],
        total: 0,
    }))
}

/// Get a specific favorite.
#[tracing::instrument(skip(_state))]
pub async fn get_favorite(
    State(_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<FavoriteWithInfo>> {
    // TODO: Fetch from database
    Err(Error::NotFound(format!("Favorite {} not found", id)))
}

/// Update a favorite.
#[tracing::instrument(skip(_state))]
pub async fn update_favorite(
    State(_state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(_request): Json<UpdateFavoriteRequest>,
) -> Result<Json<Favorite>> {
    // TODO: Update in database
    Err(Error::NotFound(format!("Favorite {} not found", id)))
}

/// Remove from favorites.
#[tracing::instrument(skip(_state))]
pub async fn remove_favorite(
    State(_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    // TODO: Delete from database
    tracing::info!(id = %id, "Favorite removed");
    Ok(StatusCode::NO_CONTENT)
}

/// Remove favorite by path.
#[tracing::instrument(skip(_state))]
pub async fn remove_favorite_by_path(
    State(_state): State<AppState>,
    Path((bucket, key)): Path<(String, String)>,
) -> Result<StatusCode> {
    // TODO: Delete from database by bucket/key
    tracing::info!(bucket = %bucket, key = %key, "Favorite removed by path");
    Ok(StatusCode::NO_CONTENT)
}

/// Reorder favorites.
#[tracing::instrument(skip(_state))]
pub async fn reorder_favorites(
    State(_state): State<AppState>,
    Json(request): Json<ReorderFavoritesRequest>,
) -> Result<StatusCode> {
    // TODO: Update sort_order for each favorite
    tracing::info!(count = request.order.len(), "Favorites reordered");
    Ok(StatusCode::OK)
}

/// Check if a path is favorited.
#[tracing::instrument(skip(_state))]
pub async fn check_favorite(
    State(_state): State<AppState>,
    Path((bucket, key)): Path<(String, String)>,
) -> Result<Json<bool>> {
    // TODO: Check in database
    Ok(Json(false))
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
