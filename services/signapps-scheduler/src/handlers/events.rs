use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::json;
use signapps_common::{Claims, TenantContext};
use signapps_db::models::calendar::{AddEventAttendee, CreateEvent, UpdateEvent};
use signapps_db::repositories::calendar_repository::{EventAttendeeRepository, EventRepository};
use uuid::Uuid;

use crate::AppState;

#[derive(Deserialize)]
/// Query parameters for filtering results.
pub struct DateRangeParams {
    pub start: Option<DateTime<Utc>>,
    pub end: Option<DateTime<Utc>>,
}

#[tracing::instrument(skip_all)]
pub async fn list_events(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(calendar_id): Path<Uuid>,
    Query(params): Query<DateRangeParams>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = EventRepository::new(&state.pool);

    // If start and end are provided, use list_by_date_range, else list_by_calendar
    let result = if let (Some(start), Some(end)) = (params.start, params.end) {
        repo.list_by_date_range(calendar_id, start, end).await
    } else {
        repo.list_by_calendar(calendar_id).await
    };

    match result {
        Ok(events) => Ok(Json(json!(events))),
        Err(e) => {
            tracing::error!("Failed to list events: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[tracing::instrument(skip_all)]
pub async fn get_event(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = EventRepository::new(&state.pool);
    match repo.find_by_id(id).await {
        Ok(Some(event)) => Ok(Json(json!(event))),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!("Failed to get event: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[tracing::instrument(skip_all)]
pub async fn create_event(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(calendar_id): Path<Uuid>,
    Json(payload): Json<CreateEvent>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = EventRepository::new(&state.pool);
    let user_id = claims.sub;
    match repo.create(calendar_id, payload, user_id).await {
        Ok(event) => Ok((StatusCode::CREATED, Json(json!(event)))),
        Err(e) => {
            tracing::error!("Failed to create event: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[tracing::instrument(skip_all)]
pub async fn update_event(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateEvent>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = EventRepository::new(&state.pool);
    match repo.update(id, payload).await {
        Ok(event) => Ok(Json(json!(event))),
        Err(e) => {
            tracing::error!("Failed to update event: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[tracing::instrument(skip_all)]
pub async fn delete_event(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = EventRepository::new(&state.pool);
    match repo.delete(id).await {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!("Failed to delete event: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[tracing::instrument(skip_all)]
pub async fn list_attendees(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(event_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = EventAttendeeRepository::new(&state.pool);
    match repo.list_attendees(event_id).await {
        Ok(attendees) => Ok(Json(json!(attendees))),
        Err(e) => {
            tracing::error!("Failed to list attendees: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[tracing::instrument(skip_all)]
pub async fn add_attendee(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<AddEventAttendee>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = EventAttendeeRepository::new(&state.pool);
    match repo.add_attendee(event_id, payload).await {
        Ok(attendee) => Ok((StatusCode::CREATED, Json(json!(attendee)))),
        Err(e) => {
            tracing::error!("Failed to add attendee: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[derive(Deserialize)]
/// UpdateRsvpPayload data transfer object.
pub struct UpdateRsvpPayload {
    pub rsvp_status: String,
}

#[tracing::instrument(skip_all)]
pub async fn update_rsvp(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(attendee_id): Path<Uuid>,
    Json(payload): Json<UpdateRsvpPayload>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = EventAttendeeRepository::new(&state.pool);
    match repo.update_rsvp(attendee_id, &payload.rsvp_status).await {
        Ok(_) => Ok(StatusCode::OK),
        Err(e) => {
            tracing::error!("Failed to update rsvp: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[tracing::instrument(skip_all)]
pub async fn remove_attendee(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(attendee_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = EventAttendeeRepository::new(&state.pool);
    match repo.remove_attendee(attendee_id).await {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!("Failed to remove attendee: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}
