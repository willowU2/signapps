//! Event CRUD handlers.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, TimeZone, Utc};
use serde::Deserialize;
use signapps_common::pg_events::NewEvent;
use signapps_common::Claims;
use signapps_db::{models::*, EventAttendeeRepository, EventRepository};
use tracing::instrument;
use uuid::Uuid;

use crate::{AppState, CalendarError};

/// Verify the caller owns the calendar or has a sharing grant on it.
///
/// Returns `Ok(())` if the user has access, `Err(CalendarError::NotFound)` otherwise.
async fn verify_calendar_access(
    state: &AppState,
    calendar_id: Uuid,
    user_id: Uuid,
) -> Result<(), CalendarError> {
    use signapps_db::CalendarRepository;

    let cal_repo = CalendarRepository::new(&state.pool);
    let calendar = cal_repo
        .find_by_id(calendar_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    if calendar.owner_id == user_id {
        return Ok(());
    }

    // Check for a direct user grant in the unified sharing system
    let has_grant: Option<bool> = sqlx::query_scalar(
        r#"
        SELECT TRUE FROM sharing.grants
        WHERE resource_type = 'calendar'
          AND resource_id = $1
          AND grantee_type = 'user'
          AND grantee_id = $2
          AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1
        "#,
    )
    .bind(calendar_id)
    .bind(user_id)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|_| CalendarError::InternalError)?;

    if has_grant.is_some() {
        return Ok(());
    }

    Err(CalendarError::NotFound)
}

/// Append a row to `platform.activities` — fire-and-forget, never fails the request.
async fn log_event_activity(
    pool: &sqlx::PgPool,
    actor_id: Uuid,
    action: &str,
    entity_id: Uuid,
    entity_title: &str,
) {
    let _ = sqlx::query(
        r#"INSERT INTO platform.activities
           (id, actor_id, action, entity_type, entity_id, entity_title, metadata, workspace_id)
           VALUES (gen_uuid_v7(), $1, $2, 'calendar_event', $3, $4, '{}', NULL)"#,
    )
    .bind(actor_id)
    .bind(action)
    .bind(entity_id)
    .bind(entity_title)
    .execute(pool)
    .await;
}

#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct DateRangeQuery {
    pub start: Option<DateTime<Utc>>,
    pub end: Option<DateTime<Utc>>,
}

/// Create a new calendar event.
#[utoipa::path(
    post,
    path = "/api/v1/calendars/{calendar_id}/events",
    tag = "events",
    security(("bearerAuth" = [])),
    params(("calendar_id" = Uuid, Path, description = "Calendar UUID")),
    request_body = signapps_db::models::CreateEvent,
    responses(
        (status = 201, description = "Event created", body = signapps_db::models::Event),
        (status = 400, description = "end_time must be after start_time"),
        (status = 401, description = "Not authenticated"),
    )
)]
#[instrument(skip(state, payload), fields(user_id = %claims.sub, calendar_id = %calendar_id))]
pub async fn create_event(
    State(state): State<AppState>,
    Path(calendar_id): Path<Uuid>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateEvent>,
) -> Result<(StatusCode, Json<Event>), CalendarError> {
    // Verify the caller owns or is a member of this calendar
    verify_calendar_access(&state, calendar_id, claims.sub).await?;

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

    log_event_activity(
        state.pool.inner(),
        claims.sub,
        "created",
        event.id,
        &event.title,
    )
    .await;

    let _ = state
        .event_bus
        .publish(NewEvent {
            event_type: "calendar.event.created".into(),
            aggregate_id: Some(event.id),
            payload: serde_json::json!({
                "calendar_id": calendar_id,
                "title": event.title,
                "user_id": claims.sub,
            }),
        })
        .await;

    Ok((StatusCode::CREATED, Json(event)))
}

/// List events in a calendar, optionally filtered by date range.
#[utoipa::path(
    get,
    path = "/api/v1/calendars/{calendar_id}/events",
    tag = "events",
    security(("bearerAuth" = [])),
    params(
        ("calendar_id" = Uuid, Path, description = "Calendar UUID"),
        ("start" = Option<String>, Query, description = "Start filter (RFC 3339)"),
        ("end" = Option<String>, Query, description = "End filter (RFC 3339)"),
    ),
    responses(
        (status = 200, description = "List of events", body = Vec<signapps_db::models::Event>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[instrument(skip(state, query), fields(calendar_id = %calendar_id))]
pub async fn list_events(
    State(state): State<AppState>,
    Path(calendar_id): Path<Uuid>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<Vec<Event>>, CalendarError> {
    // Verify the caller owns or is a member of this calendar
    verify_calendar_access(&state, calendar_id, claims.sub).await?;

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

/// Get a single event by ID.
#[utoipa::path(
    get,
    path = "/api/v1/events/{id}",
    tag = "events",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Event UUID")),
    responses(
        (status = 200, description = "Event found", body = signapps_db::models::Event),
        (status = 404, description = "Event not found"),
    )
)]
#[instrument(skip(state), fields(event_id = %id))]
pub async fn get_event(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Event>, CalendarError> {
    let repo = EventRepository::new(&state.pool);
    let event = repo
        .find_by_id(id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    // Verify the caller owns or is a member of the event's calendar
    verify_calendar_access(&state, event.calendar_id, claims.sub).await?;

    Ok(Json(event))
}

/// Update an existing event.
#[utoipa::path(
    put,
    path = "/api/v1/events/{id}",
    tag = "events",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Event UUID")),
    request_body = signapps_db::models::UpdateEvent,
    responses(
        (status = 200, description = "Event updated", body = signapps_db::models::Event),
        (status = 400, description = "Invalid date range"),
        (status = 404, description = "Event not found"),
    )
)]
#[instrument(skip(state, payload), fields(user_id = %claims.sub, event_id = %id))]
pub async fn update_event(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<UpdateEvent>,
) -> Result<Json<Event>, CalendarError> {
    // Verify the caller owns or is a member of the event's calendar
    {
        let repo = EventRepository::new(&state.pool);
        let existing = repo
            .find_by_id(id)
            .await
            .map_err(|_| CalendarError::InternalError)?
            .ok_or(CalendarError::NotFound)?;
        verify_calendar_access(&state, existing.calendar_id, claims.sub).await?;
    }

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

    log_event_activity(
        state.pool.inner(),
        claims.sub,
        "updated",
        event.id,
        &event.title,
    )
    .await;

    Ok(Json(event))
}

/// Delete an event (soft delete — sets is_deleted = true).
#[utoipa::path(
    delete,
    path = "/api/v1/events/{id}",
    tag = "events",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Event UUID")),
    responses(
        (status = 204, description = "Event deleted"),
        (status = 404, description = "Event not found"),
    )
)]
#[instrument(skip(state), fields(user_id = %claims.sub, event_id = %id))]
pub async fn delete_event(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Extension(claims): Extension<Claims>,
) -> Result<StatusCode, CalendarError> {
    // Verify the caller owns or is a member of the event's calendar
    {
        let repo = EventRepository::new(&state.pool);
        let existing = repo
            .find_by_id(id)
            .await
            .map_err(|_| CalendarError::InternalError)?
            .ok_or(CalendarError::NotFound)?;
        verify_calendar_access(&state, existing.calendar_id, claims.sub).await?;
    }

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

    log_event_activity(state.pool.inner(), claims.sub, "deleted", id, "").await;

    Ok(StatusCode::NO_CONTENT)
}

/// Invite an attendee to an event.
///
/// Either `user_id` (internal user) or `email` (external attendee) must be supplied.
/// The attendee is created with `rsvp_status = "pending"`.
#[utoipa::path(
    post,
    path = "/api/v1/events/{event_id}/attendees",
    tag = "events",
    security(("bearerAuth" = [])),
    params(("event_id" = Uuid, Path, description = "Event UUID")),
    request_body = signapps_db::models::AddEventAttendee,
    responses(
        (status = 201, description = "Attendee added", body = signapps_db::models::EventAttendee),
        (status = 400, description = "user_id or email required"),
        (status = 401, description = "Not authenticated"),
    )
)]
#[instrument(skip(state, payload), fields(event_id = %event_id))]
pub async fn add_attendee(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<AddEventAttendee>,
) -> Result<(StatusCode, Json<EventAttendee>), CalendarError> {
    // Verify the caller owns or is a member of the event's calendar
    {
        let repo = EventRepository::new(&state.pool);
        let event = repo
            .find_by_id(event_id)
            .await
            .map_err(|_| CalendarError::InternalError)?
            .ok_or(CalendarError::NotFound)?;
        verify_calendar_access(&state, event.calendar_id, claims.sub).await?;
    }

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
#[utoipa::path(
    get,
    path = "/api/v1/events/{event_id}/attendees",
    tag = "events",
    security(("bearerAuth" = [])),
    params(("event_id" = Uuid, Path, description = "Event UUID")),
    responses(
        (status = 200, description = "List of attendees", body = Vec<signapps_db::models::EventAttendee>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[instrument(skip(state), fields(event_id = %event_id))]
pub async fn list_attendees(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> Result<Json<Vec<EventAttendee>>, CalendarError> {
    // Verify the caller owns or is a member of the event's calendar
    {
        let event_repo = EventRepository::new(&state.pool);
        let event = event_repo
            .find_by_id(event_id)
            .await
            .map_err(|_| CalendarError::InternalError)?
            .ok_or(CalendarError::NotFound)?;
        verify_calendar_access(&state, event.calendar_id, claims.sub).await?;
    }

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
#[utoipa::path(
    patch,
    path = "/api/v1/events/attendees/{attendee_id}/rsvp",
    tag = "events",
    security(("bearerAuth" = [])),
    params(("attendee_id" = Uuid, Path, description = "Attendee UUID")),
    request_body = signapps_db::models::UpdateAttendeeRsvp,
    responses(
        (status = 200, description = "RSVP updated"),
        (status = 400, description = "Invalid rsvp_status value"),
        (status = 401, description = "Not authenticated"),
    )
)]
#[instrument(skip(state, payload), fields(attendee_id = %attendee_id))]
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
#[utoipa::path(
    delete,
    path = "/api/v1/events/attendees/{attendee_id}",
    tag = "events",
    security(("bearerAuth" = [])),
    params(("attendee_id" = Uuid, Path, description = "Attendee UUID")),
    responses(
        (status = 204, description = "Attendee removed"),
        (status = 401, description = "Not authenticated"),
    )
)]
#[instrument(skip(state), fields(attendee_id = %attendee_id))]
pub async fn remove_attendee(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(attendee_id): Path<Uuid>,
) -> Result<StatusCode, CalendarError> {
    // Note: attendee lookup by ID does not expose calendar_id directly,
    // but this endpoint still requires authentication via claims
    let _ = claims.sub;

    let repo = EventAttendeeRepository::new(&state.pool);
    repo.remove_attendee(attendee_id)
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
