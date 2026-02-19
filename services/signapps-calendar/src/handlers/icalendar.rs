//! iCalendar import/export handlers

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono;
use serde::{Deserialize, Serialize};
use signapps_db::{models::*, CalendarRepository, EventRepository};
use uuid::Uuid;

use crate::{services::icalendar as ical, AppState, CalendarError};

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct ImportCalendarRequest {
    pub ics_content: String,
    pub calendar_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub imported: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

/// Export calendar to iCalendar format (RFC 5545)
#[tracing::instrument(skip_all)]
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
            (
                "Content-Type".to_string(),
                "text/calendar; charset=utf-8".to_string(),
            ),
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
        [(
            "Content-Type".to_string(),
            "text/calendar; charset=utf-8".to_string(),
        )],
        ics,
    ))
}

/// Import calendar from iCalendar format (RFC 5545)
#[allow(dead_code)]
pub async fn import_calendar(
    State(state): State<AppState>,
    Path(calendar_id): Path<Uuid>,
    Json(payload): Json<ValidateICalendarRequest>,
) -> Result<Json<ImportResult>, CalendarError> {
    let event_repo = EventRepository::new(&state.pool);
    let system_user_id = Uuid::nil(); // System import user ID

    // Parse iCalendar content
    let ical_events = match ical::import_calendar_from_ics(&payload.ics_content) {
        Ok(events) => events,
        Err(e) => {
            return Ok(Json(ImportResult {
                imported: 0,
                skipped: 0,
                errors: vec![e],
            }))
        },
    };

    let mut imported = 0;
    let mut skipped = 0;
    let mut errors = vec![];

    // Import each event
    for ical_event in ical_events {
        // Create event input
        let event_input = CreateEvent {
            title: ical_event.title.clone(),
            description: ical_event.description,
            location: ical_event.location,
            start_time: ical_event.start_time,
            end_time: ical_event.end_time,
            rrule: ical_event.rrule,
            timezone: Some("UTC".to_string()),
            is_all_day: Some(false),
        };

        // Insert event
        match event_repo
            .create(calendar_id, event_input, system_user_id)
            .await
        {
            Ok(_) => imported += 1,
            Err(e) => {
                errors.push(format!(
                    "Failed to import event '{}': {}",
                    ical_event.title, e
                ));
                skipped += 1;
            },
        }
    }

    Ok(Json(ImportResult {
        imported,
        skipped,
        errors,
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

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct CalendarSession {
    pub id: Uuid,
    pub calendar_id: Uuid,
    pub user_id: Uuid,
    pub tx: tokio::sync::broadcast::Sender<Vec<u8>>,
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
