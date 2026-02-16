//! iCalendar import/export handlers

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use signapps_db::{models::*, EventRepository, CalendarRepository};
use uuid::Uuid;

use crate::{services::icalendar as ical, AppState, CalendarError};

#[derive(Debug, Deserialize)]
pub struct ImportCalendarRequest {
    pub ics_content: String,
    pub calendar_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct ImportResult {
    pub imported: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

/// Export calendar to iCalendar format (RFC 5545)
pub async fn export_calendar(
    State(state): State<AppState>,
    Path(calendar_id): Path<Uuid>,
) -> Result<(StatusCode, [(String, String); 2], String), CalendarError> {
    let cal_repo = CalendarRepository::new(&state.pool);
    let event_repo = EventRepository::new(&state.pool);

    // Get calendar
    let calendar = cal_repo
        .find_by_id(calendar_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    // Get all events for calendar
    let events = event_repo
        .list_by_calendar(calendar_id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    // Convert to iCalendar format
    let ical_events: Vec<ical::ICalendarEvent> = events
        .iter()
        .map(|e| ical::ICalendarEvent {
            uid: e.id.to_string(),
            title: e.title.clone(),
            description: e.description.clone(),
            location: e.location.clone(),
            start_time: e.start_time,
            end_time: e.end_time,
            rrule: e.rrule.clone(),
            created_at: e.created_at,
            modified_at: e.updated_at,
        })
        .collect();

    // Generate iCalendar format
    let ics = ical::export_calendar_to_ics(&calendar.name, ical_events);

    // Return as file with appropriate headers
    let filename = format!(
        "attachment; filename=\"{}.ics\"",
        calendar.name.replace(' ', "_")
    );

    Ok((
        StatusCode::OK,
        [
            ("Content-Type".to_string(), "text/calendar; charset=utf-8".to_string()),
            ("Content-Disposition".to_string(), filename),
        ],
        ics,
    ))
}

/// Get calendar as iCalendar feed (public URL like Google Calendar)
pub async fn get_calendar_feed(
    State(state): State<AppState>,
    Path(calendar_id): Path<Uuid>,
) -> Result<(StatusCode, [(String, String); 1], String), CalendarError> {
    let cal_repo = CalendarRepository::new(&state.pool);
    let event_repo = EventRepository::new(&state.pool);

    // Get calendar
    let calendar = cal_repo
        .find_by_id(calendar_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    // Get all events for next 90 days
    let now = chrono::Utc::now();
    let future = now + chrono::Duration::days(90);

    let events = event_repo
        .list_by_date_range(calendar_id, now, future)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    // Convert to iCalendar format
    let ical_events: Vec<ical::ICalendarEvent> = events
        .iter()
        .map(|e| ical::ICalendarEvent {
            uid: e.id.to_string(),
            title: e.title.clone(),
            description: e.description.clone(),
            location: e.location.clone(),
            start_time: e.start_time,
            end_time: e.end_time,
            rrule: e.rrule.clone(),
            created_at: e.created_at,
            modified_at: e.updated_at,
        })
        .collect();

    // Generate iCalendar format
    let ics = ical::export_calendar_to_ics(&calendar.name, ical_events);

    Ok((
        StatusCode::OK,
        [("Content-Type".to_string(), "text/calendar; charset=utf-8".to_string())],
        ics,
    ))
}

/// Import calendar from iCalendar format (RFC 5545) - Placeholder for Phase 6
/// TODO: Implement full import logic with conflict detection
pub async fn import_calendar() -> Result<Json<ImportResult>, CalendarError> {
    // Phase 6: Import functionality
    // This endpoint will:
    // 1. Accept iCalendar format (.ics file upload)
    // 2. Parse RFC 5545 RRULE events
    // 3. Check for duplicates using UID
    // 4. Import events to specified calendar
    // 5. Return import statistics

    Ok(Json(ImportResult {
        imported: 0,
        skipped: 0,
        errors: vec!["Import not yet implemented - Phase 6 feature".to_string()],
    }))
}

#[derive(Debug, Deserialize)]
pub struct ValidateICalendarRequest {
    pub ics_content: String,
}

/// Validate iCalendar format
#[derive(serde::Serialize)]
pub struct ValidateICalendarResponse {
    pub valid: bool,
    pub event_count: usize,
    pub errors: Vec<String>,
}

pub async fn validate_icalendar(
    Json(payload): Json<ValidateICalendarRequest>,
) -> Result<Json<ValidateICalendarResponse>, CalendarError> {
    match ical::import_calendar_from_ics(&payload.ics_content) {
        Ok(events) => Ok(Json(ValidateICalendarResponse {
            valid: true,
            event_count: events.len(),
            errors: vec![],
        })),
        Err(e) => Ok(Json(ValidateICalendarResponse {
            valid: false,
            event_count: 0,
            errors: vec![e],
        })),
    }
}
