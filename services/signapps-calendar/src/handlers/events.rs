//! Event CRUD handlers.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, TimeZone, Utc};
use serde::Deserialize;
use signapps_common::Claims;
use signapps_db::{models::*, EventAttendeeRepository, EventRepository};
use uuid::Uuid;

use crate::{AppState, CalendarError};

#[derive(Debug, Deserialize)]
pub struct DateRangeQuery {
    pub start: Option<DateTime<Utc>>,
    pub end: Option<DateTime<Utc>>,
}

/// Create a new event.
pub async fn create_event(
    State(state): State<AppState>,
    Path(calendar_id): Path<Uuid>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateEvent>,
) -> Result<(StatusCode, Json<Event>), CalendarError> {
    // Basic validation
    if payload.end_time <= payload.start_time {
        return Err(CalendarError::InvalidInput(
            "end_time must be after start_time".to_string(),
        ));
    }

    let repo = EventRepository::new(&state.pool);
    let event = repo
        .create(calendar_id, payload, claims.sub)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    // Index event in AI RAG
    let ai_client = state.ai_client.clone();
    let event_id = event.id;
    let title = event.title.clone();
    let desc = event.description.clone();
    tokio::spawn(async move {
        if let Err(e) = ai_client
            .index_entity(event_id, calendar_id, "events", &title, desc.as_deref())
            .await
        {
            tracing::error!("Failed to index new event in AI: {}", e);
        }
    });

    Ok((StatusCode::CREATED, Json(event)))
}

/// Get events in a calendar within a date range.
pub async fn list_events(
    State(state): State<AppState>,
    Path(calendar_id): Path<Uuid>,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<Vec<Event>>, CalendarError> {
    use chrono::Datelike;

    // Default to current month if not provided
    let now = Utc::now();
    let year = now.year();
    let month = now.month();

    let start = query.start.unwrap_or_else(|| {
        now.with_day(1)
            .or_else(|| Utc.with_ymd_and_hms(year, month, 1, 0, 0, 0).single())
            .unwrap_or_else(Utc::now)
    });

    let next_month = if month == 12 { 1 } else { month + 1 };
    let next_year = if month == 12 { year + 1 } else { year };

    let end = query.end.unwrap_or_else(|| {
        Utc.with_ymd_and_hms(next_year, next_month, 1, 0, 0, 0)
            .single()
            .unwrap_or_else(Utc::now)
    });

    let repo = EventRepository::new(&state.pool);
    let events = repo
        .list_by_date_range(calendar_id, start, end)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(events))
}

/// Get event by ID.
pub async fn get_event(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Event>, CalendarError> {
    let repo = EventRepository::new(&state.pool);
    let event = repo
        .find_by_id(id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    Ok(Json(event))
}

/// Update an event.
pub async fn update_event(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateEvent>,
) -> Result<Json<Event>, CalendarError> {
    // Validate dates if both provided
    if let (Some(start), Some(end)) = (payload.start_time, payload.end_time) {
        if end <= start {
            return Err(CalendarError::InvalidInput(
                "end_time must be after start_time".to_string(),
            ));
        }
    }

    let repo = EventRepository::new(&state.pool);
    let event = repo
        .update(id, payload)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    // Update event in AI RAG
    let ai_client = state.ai_client.clone();
    let event_id = event.id;
    let calendar_id = event.calendar_id;
    let title = event.title.clone();
    let desc = event.description.clone();
    tokio::spawn(async move {
        if let Err(e) = ai_client
            .index_entity(event_id, calendar_id, "events", &title, desc.as_deref())
            .await
        {
            tracing::error!("Failed to update event in AI index: {}", e);
        }
    });

    Ok(Json(event))
}

/// Delete an event (soft delete).
pub async fn delete_event(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, CalendarError> {
    let repo = EventRepository::new(&state.pool);
    repo.delete(id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    // Remove event from AI RAG
    let ai_client = state.ai_client.clone();
    tokio::spawn(async move {
        if let Err(e) = ai_client.remove_indexed_entity(id).await {
            tracing::error!("Failed to delete event from AI index: {}", e);
        }
    });

    Ok(StatusCode::NO_CONTENT)
}

/// Invite an attendee to an event.
///
/// Either `user_id` (internal user) or `email` (external attendee) must be supplied.
/// The attendee is created with `rsvp_status = "pending"`.
pub async fn add_attendee(
    State(state): State<AppState>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<AddEventAttendee>,
) -> Result<(StatusCode, Json<EventAttendee>), CalendarError> {
    if payload.user_id.is_none() && payload.email.is_none() {
        return Err(CalendarError::InvalidInput(
            "Either user_id or email must be provided to invite an attendee".to_string(),
        ));
    }

    let repo = EventAttendeeRepository::new(&state.pool);
    let attendee = repo
        .add_attendee(event_id, payload)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok((StatusCode::CREATED, Json(attendee)))
}

/// Get attendees for an event.
pub async fn list_attendees(
    State(state): State<AppState>,
    Path(event_id): Path<Uuid>,
) -> Result<Json<Vec<EventAttendee>>, CalendarError> {
    let repo = EventAttendeeRepository::new(&state.pool);
    let attendees = repo
        .list_attendees(event_id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(attendees))
}

/// Update attendee RSVP status.
///
/// Accepts `{ "rsvp_status": "accepted" | "declined" | "tentative" | "pending" }`.
pub async fn update_rsvp(
    State(state): State<AppState>,
    Path(attendee_id): Path<Uuid>,
    Json(payload): Json<UpdateAttendeeRsvp>,
) -> Result<StatusCode, CalendarError> {
    const VALID_STATUSES: &[&str] = &["pending", "accepted", "declined", "tentative"];
    if !VALID_STATUSES.contains(&payload.rsvp_status.as_str()) {
        return Err(CalendarError::InvalidInput(format!(
            "Invalid rsvp_status '{}'. Must be one of: {}",
            payload.rsvp_status,
            VALID_STATUSES.join(", ")
        )));
    }

    let repo = EventAttendeeRepository::new(&state.pool);
    repo.update_rsvp(attendee_id, &payload.rsvp_status)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(StatusCode::OK)
}

/// Remove an attendee from an event.
pub async fn remove_attendee(
    State(state): State<AppState>,
    Path(attendee_id): Path<Uuid>,
) -> Result<StatusCode, CalendarError> {
    let repo = EventAttendeeRepository::new(&state.pool);
    repo.remove_attendee(attendee_id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(StatusCode::NO_CONTENT)
}
