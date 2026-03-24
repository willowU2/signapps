use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use signapps_common::{Claims, TenantContext};
use signapps_db::models::calendar::{CreateCalendar, UpdateCalendar};
use signapps_db::repositories::calendar_repository::CalendarRepository;
use uuid::Uuid;

use crate::AppState;

pub async fn list_calendars(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = CalendarRepository::new(&state.pool);
    let user_id = claims.sub;
    match repo.list_for_user(user_id).await {
        Ok(calendars) => Ok(Json(json!(calendars))),
        Err(e) => {
            tracing::error!("Failed to list calendars: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

pub async fn get_calendar(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = CalendarRepository::new(&state.pool);
    match repo.find_by_id(id).await {
        Ok(Some(calendar)) => Ok(Json(json!(calendar))),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!("Failed to get calendar: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

pub async fn create_calendar(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Json(payload): Json<CreateCalendar>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = CalendarRepository::new(&state.pool);
    let user_id = claims.sub;
    match repo.create(payload, user_id).await {
        Ok(calendar) => Ok((StatusCode::CREATED, Json(json!(calendar)))),
        Err(e) => {
            tracing::error!("Failed to create calendar: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

pub async fn update_calendar(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCalendar>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = CalendarRepository::new(&state.pool);
    match repo.update(id, payload).await {
        Ok(calendar) => Ok(Json(json!(calendar))),
        Err(e) => {
            tracing::error!("Failed to update calendar: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

pub async fn delete_calendar(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = CalendarRepository::new(&state.pool);
    match repo.delete(id).await {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!("Failed to delete calendar: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}
