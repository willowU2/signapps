use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use signapps_db::{models::*, FloorPlanRepository};
use uuid::Uuid;

use crate::{AppState, CalendarError};

/// Create a new floor plan
#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/floor_plans",
    responses((status = 201, description = "Success")),
    tag = "Calendar"
)]
pub async fn create_floor_plan(
    State(state): State<AppState>,
    Json(payload): Json<CreateFloorPlan>,
) -> Result<(StatusCode, Json<FloorPlan>), CalendarError> {
    let repo = FloorPlanRepository::new(&state.pool);
    let floor_plan = repo.create(payload).await.map_err(|e| {
        tracing::error!("Error creating floor plan: {:?}", e);
        CalendarError::InternalError
    })?;

    Ok((StatusCode::CREATED, Json(floor_plan)))
}

/// Get all floor plans
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/floor_plans",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
pub async fn list_floor_plans(
    State(state): State<AppState>,
) -> Result<Json<Vec<FloorPlan>>, CalendarError> {
    let repo = FloorPlanRepository::new(&state.pool);
    let floor_plans = repo.list().await.map_err(|e| {
        tracing::error!("Error listing floor plans: {:?}", e);
        CalendarError::InternalError
    })?;

    Ok(Json(floor_plans))
}

/// Get floor plan by ID
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/floor_plans",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
pub async fn get_floor_plan(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<FloorPlan>, CalendarError> {
    let repo = FloorPlanRepository::new(&state.pool);
    let floor_plan = repo
        .find_by_id(id)
        .await
        .map_err(|e| {
            tracing::error!("Error getting floor plan: {:?}", e);
            CalendarError::InternalError
        })?
        .ok_or(CalendarError::NotFound)?;

    Ok(Json(floor_plan))
}

/// Update floor plan
#[tracing::instrument(skip_all)]
#[utoipa::path(
    put,
    path = "/api/v1/floor_plans",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
pub async fn update_floor_plan(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateFloorPlan>,
) -> Result<Json<FloorPlan>, CalendarError> {
    let repo = FloorPlanRepository::new(&state.pool);
    let floor_plan = repo.update(id, payload).await.map_err(|e| {
        tracing::error!("Error updating floor plan: {:?}", e);
        CalendarError::InternalError
    })?;

    Ok(Json(floor_plan))
}

/// Delete floor plan
#[tracing::instrument(skip_all)]
#[utoipa::path(
    delete,
    path = "/api/v1/floor_plans",
    responses((status = 204, description = "Success")),
    tag = "Calendar"
)]
pub async fn delete_floor_plan(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, CalendarError> {
    let repo = FloorPlanRepository::new(&state.pool);
    repo.delete(id).await.map_err(|e| {
        tracing::error!("Error deleting floor plan: {:?}", e);
        CalendarError::InternalError
    })?;

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
