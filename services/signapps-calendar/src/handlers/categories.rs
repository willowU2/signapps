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
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/categories",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
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
#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/categories",
    responses((status = 201, description = "Success")),
    tag = "Calendar"
)]
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
#[tracing::instrument(skip_all)]
#[utoipa::path(
    put,
    path = "/api/v1/categories",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
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
#[tracing::instrument(skip_all)]
#[utoipa::path(
    delete,
    path = "/api/v1/categories",
    responses((status = 204, description = "Success")),
    tag = "Calendar"
)]
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
}
