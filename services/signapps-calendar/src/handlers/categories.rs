//! Category CRUD handlers

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use signapps_common::Claims;
use signapps_db::{models::calendar::*, CategoryRepository};
use uuid::Uuid;

use crate::{AppState, CalendarError};

/// List categories visible to the current user.
pub async fn list_categories(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Category>>, CalendarError> {
    let repo = CategoryRepository::new(&state.pool);
    let categories = repo
        .list(Some(claims.sub), None)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(categories))
}

/// Create a new category.
pub async fn create_category(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateCategory>,
) -> Result<(StatusCode, Json<Category>), CalendarError> {
    let repo = CategoryRepository::new(&state.pool);
    let category = repo
        .create(claims.sub, &payload)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok((StatusCode::CREATED, Json(category)))
}

/// Update an existing category.
pub async fn update_category(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateCategory>,
) -> Result<Json<Category>, CalendarError> {
    let repo = CategoryRepository::new(&state.pool);
    let category = repo
        .update(id, &payload)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(category))
}

/// Delete a category.
pub async fn delete_category(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, CalendarError> {
    let repo = CategoryRepository::new(&state.pool);
    repo.delete(id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(StatusCode::NO_CONTENT)
}
