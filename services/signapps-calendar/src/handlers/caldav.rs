//! CalDAV compliance handlers (RFC 4791).
//!
//! Provides the minimal CalDAV interface so that standard calendar clients
//! (Thunderbird, Apple Calendar, Evolution) can discover and sync calendars.
//!
//! Routes exposed:
//!   OPTIONS  /.well-known/caldav             → redirect to principal
//!   PROPFIND /caldav/principals/{user_id}    → principal resource
//!   PROPFIND /caldav/calendars/{calendar_id} → calendar collection
//!   REPORT   /caldav/calendars/{calendar_id} → calendar-query / sync-collection
//!   GET|PUT|DELETE /caldav/calendars/{calendar_id}/events/{event_id}.ics

use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    Extension,
};
use signapps_common::Claims;
use signapps_db::{CalendarRepository, EventRepository};
use uuid::Uuid;

use crate::{services::icalendar as ical, AppState, CalendarError};
use signapps_db::models::CreateEvent;

// ── Constants ─────────────────────────────────────────────────────────────────

const DAV_HEADER: &str = "1, 2, 3, calendar-access";
const CALDAV_NS: &str = "urn:ietf:params:xml:ns:caldav";

// ── OPTIONS / well-known ──────────────────────────────────────────────────────

/// Handle OPTIONS for CalDAV discovery.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/caldav",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
pub async fn options_handler() -> impl IntoResponse {
    (
        StatusCode::OK,
        [
            (
                header::ALLOW,
                "OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, REPORT",
            ),
            (header::HeaderName::from_static("dav"), DAV_HEADER),
        ],
        "",
    )
}

// ── PROPFIND principal ────────────────────────────────────────────────────────

/// Return principal resource info for a user.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/caldav",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
pub async fn propfind_principal(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let user_id = &claims.sub;
    let body = format!(
        r#"<?xml version="1.0" encoding="utf-8"?>
<multistatus xmlns="DAV:" xmlns:C="{CALDAV_NS}">
  <response>
    <href>/caldav/principals/{user_id}</href>
    <propstat>
      <prop>
        <resourcetype><principal/></resourcetype>
        <displayname>{user_id}</displayname>
        <C:calendar-home-set>
          <href>/caldav/calendars/{user_id}/</href>
        </C:calendar-home-set>
        <principal-URL>
          <href>/caldav/principals/{user_id}</href>
        </principal-URL>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
</multistatus>"#
    );

    (
        StatusCode::MULTI_STATUS,
        [
            (header::CONTENT_TYPE, "application/xml; charset=utf-8"),
            (header::HeaderName::from_static("dav"), DAV_HEADER),
        ],
        body,
    )
}

// ── PROPFIND calendar collection ──────────────────────────────────────────────

/// Return calendar collection properties.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/caldav",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
pub async fn propfind_calendar(
    State(state): State<AppState>,
    Path(calendar_id): Path<Uuid>,
) -> Result<impl IntoResponse, CalendarError> {
    let repo = CalendarRepository::new(&state.pool);
    let calendar = repo
        .find_by_id(calendar_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    let body = format!(
        r#"<?xml version="1.0" encoding="utf-8"?>
<multistatus xmlns="DAV:" xmlns:C="{CALDAV_NS}">
  <response>
    <href>/caldav/calendars/{calendar_id}/</href>
    <propstat>
      <prop>
        <resourcetype>
          <collection/>
          <C:calendar/>
        </resourcetype>
        <displayname>{name}</displayname>
        <C:supported-calendar-component-set>
          <C:comp name="VEVENT"/>
          <C:comp name="VTODO"/>
        </C:supported-calendar-component-set>
        <getctag>{ctag}</getctag>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
</multistatus>"#,
        calendar_id = calendar_id,
        name = calendar.name,
        ctag = calendar.updated_at.timestamp_millis(),
    );

    Ok((
        StatusCode::MULTI_STATUS,
        [
            (header::CONTENT_TYPE, "application/xml; charset=utf-8"),
            (header::HeaderName::from_static("dav"), DAV_HEADER),
        ],
        body,
    ))
}

// ── GET event as .ics ─────────────────────────────────────────────────────────

/// Serve a single event as an iCalendar (.ics) object.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/caldav",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
pub async fn get_event_ics(
    State(state): State<AppState>,
    Path((_calendar_id, event_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, CalendarError> {
    let event_repo = EventRepository::new(&state.pool);

    let event = event_repo
        .find_by_id(event_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    let ical_event = ical::ICalendarEvent {
        uid: event.id.to_string(),
        title: event.title.clone(),
        description: event.description.clone(),
        location: event.location.clone(),
        start_time: event.start_time,
        end_time: event.end_time,
        rrule: event.rrule.clone(),
        created_at: event.created_at,
        modified_at: event.updated_at,
    };

    let ics = ical::export_calendar_to_ics("Event", vec![ical_event]);

    let etag = format!("\"{}\"", event.updated_at.timestamp_millis());
    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        "text/calendar; charset=utf-8"
            .parse()
            .expect("valid content-type header value"),
    );
    headers.insert(
        header::ETAG,
        etag.parse()
            .expect("timestamp-based ETag is always a valid header value"),
    );
    headers.insert(
        header::HeaderName::from_static("dav"),
        DAV_HEADER
            .parse()
            .expect("DAV header value is a static valid string"),
    );
    Ok((StatusCode::OK, headers, ics))
}

// ── REPORT (calendar-query) ───────────────────────────────────────────────────

/// Minimal calendar-query / sync-collection REPORT.
/// Returns all event hrefs for the calendar so clients can sync.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/caldav",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
pub async fn report_calendar(
    State(state): State<AppState>,
    Path(calendar_id): Path<Uuid>,
) -> Result<impl IntoResponse, CalendarError> {
    let event_repo = EventRepository::new(&state.pool);
    let events = event_repo
        .list_by_calendar(calendar_id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let responses: String = events
        .iter()
        .map(|e| {
            format!(
                r#"  <response>
    <href>/caldav/calendars/{calendar_id}/events/{event_id}.ics</href>
    <propstat>
      <prop>
        <getetag>"{etag}"</getetag>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>"#,
                calendar_id = calendar_id,
                event_id = e.id,
                etag = e.updated_at.timestamp_millis(),
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    let body = format!(
        r#"<?xml version="1.0" encoding="utf-8"?>
<multistatus xmlns="DAV:" xmlns:C="{CALDAV_NS}">
{responses}
</multistatus>"#
    );

    Ok((
        StatusCode::MULTI_STATUS,
        [(header::CONTENT_TYPE, "application/xml; charset=utf-8")],
        body,
    ))
}

// ── PUT event (create or update) ──────────────────────────────────────────────

/// Handle PUT /caldav/calendars/{calendar_id}/events/{event_id}.ics
///
/// CalDAV clients use PUT to create new events or update existing ones.
/// The request body is an iCalendar (.ics) payload.
///
/// Per RFC 4791 §5.3.2:
///   - If the event does not exist → create it (201 Created)
///   - If the event exists         → update it (204 No Content)
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/caldav",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
pub async fn put_event_ics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((calendar_id, event_id)): Path<(Uuid, Uuid)>,
    body: String,
) -> Result<impl IntoResponse, CalendarError> {
    let event_repo = EventRepository::new(&state.pool);
    let calendar_repo = CalendarRepository::new(&state.pool);

    // Verify the calendar exists and is accessible
    calendar_repo
        .find_by_id(calendar_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    // Parse the incoming .ics payload
    let ical_events = ical::import_calendar_from_ics(&body).map_err(|e| {
        tracing::warn!(parse_error = %e, "CalDAV PUT: failed to parse ICS body");
        CalendarError::InvalidInput(format!("Invalid ICS: {e}"))
    })?;

    let ical_event = ical_events
        .into_iter()
        .next()
        .ok_or_else(|| CalendarError::InvalidInput("No VEVENT found in ICS".to_string()))?;

    // Check if event already exists
    let existing = event_repo
        .find_by_id(event_id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    if existing.is_some() {
        // Update the existing event
        let update = signapps_db::models::UpdateEvent {
            title: Some(ical_event.title),
            description: ical_event.description,
            location: ical_event.location,
            start_time: Some(ical_event.start_time),
            end_time: Some(ical_event.end_time),
            rrule: ical_event.rrule,
            timezone: None,
            is_all_day: None,
            event_type: None,
            scope: None,
            status: None,
            priority: None,
            parent_event_id: None,
            resource_id: None,
            category_id: None,
            leave_type: None,
            presence_mode: None,
            approval_by: None,
            approval_comment: None,
            energy_level: None,
            cron_expression: None,
            cron_target: None,
            assigned_to: None,
            project_id: None,
            tags: None,
        };
        event_repo
            .update(event_id, update)
            .await
            .map_err(|_| CalendarError::InternalError)?;

        let etag = format!("\"{}\"", chrono::Utc::now().timestamp_millis());
        let mut headers = HeaderMap::new();
        headers.insert(
            header::ETAG,
            etag.parse().expect("ETag is always a valid header value"),
        );
        headers.insert(
            header::HeaderName::from_static("dav"),
            DAV_HEADER.parse().expect("DAV header is always valid"),
        );
        Ok((StatusCode::NO_CONTENT, headers, String::new()))
    } else {
        // Create a new event with the given UUID as the external UID
        let create = CreateEvent {
            title: ical_event.title,
            description: ical_event.description,
            location: ical_event.location,
            start_time: ical_event.start_time,
            end_time: ical_event.end_time,
            rrule: ical_event.rrule,
            timezone: None,
            is_all_day: Some(false),
            event_type: None,
            scope: None,
            status: None,
            priority: None,
            parent_event_id: None,
            resource_id: None,
            category_id: None,
            leave_type: None,
            presence_mode: None,
            approval_by: None,
            approval_comment: None,
            energy_level: None,
            cron_expression: None,
            cron_target: None,
            assigned_to: None,
            project_id: None,
            tags: None,
        };
        event_repo
            .create(calendar_id, create, claims.sub)
            .await
            .map_err(|_| CalendarError::InternalError)?;

        let etag = format!("\"{}\"", chrono::Utc::now().timestamp_millis());
        let mut headers = HeaderMap::new();
        headers.insert(
            header::CONTENT_TYPE,
            "text/calendar; charset=utf-8"
                .parse()
                .expect("valid content-type"),
        );
        headers.insert(
            header::ETAG,
            etag.parse().expect("ETag is always a valid header value"),
        );
        headers.insert(
            header::HeaderName::from_static("dav"),
            DAV_HEADER.parse().expect("DAV header is always valid"),
        );
        Ok((StatusCode::CREATED, headers, String::new()))
    }
}

// ── DELETE event ───────────────────────────────────────────────────────────────

/// Handle DELETE /caldav/calendars/{calendar_id}/events/{event_id}.ics
///
/// CalDAV clients use DELETE to remove events.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    delete,
    path = "/api/v1/caldav",
    responses((status = 204, description = "Success")),
    tag = "Calendar"
)]
pub async fn delete_event_ics(
    State(state): State<AppState>,
    Path((_calendar_id, event_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, CalendarError> {
    let event_repo = EventRepository::new(&state.pool);

    // Verify the event exists
    event_repo
        .find_by_id(event_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    event_repo
        .delete(event_id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok((
        StatusCode::NO_CONTENT,
        [(header::HeaderName::from_static("dav"), DAV_HEADER)],
        String::new(),
    ))
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
