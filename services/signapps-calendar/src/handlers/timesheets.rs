//! Timesheet handlers.
//!
//! Covers listing, updating, validating weeks, exporting, and generating
//! timesheet entries from calendar events.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{Datelike, Duration, NaiveDate};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;
use signapps_db::{models::calendar::TimesheetEntry, repositories::TimesheetRepository};
use uuid::Uuid;

use crate::{AppState, CalendarError};

// ============================================================================
// Request / Response types
// ============================================================================

#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct ListTimesheetsQuery {
    /// Optional user_id filter (admin override). Defaults to the current user.
    pub user_id: Option<Uuid>,
    /// ISO week string, e.g. `2026-W13`. Defaults to the current week.
    pub week: Option<String>,
}

#[derive(Debug, Deserialize)]
/// UpdateTimesheetBody data transfer object.
pub struct UpdateTimesheetBody {
    pub hours: f64,
    pub category_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
/// ValidateWeekBody data transfer object.
pub struct ValidateWeekBody {
    /// ISO week string, e.g. `2026-W13`.
    pub week: String,
}

#[derive(Debug, Serialize)]
/// ValidateWeekResult data transfer object.
pub struct ValidateWeekResult {
    pub week: String,
    pub rows_validated: u64,
}

#[derive(Debug, Deserialize)]
/// ExportTimesheetsBody data transfer object.
pub struct ExportTimesheetsBody {
    pub start: String,
    pub end: String,
}

#[derive(Debug, Serialize)]
/// ExportResult data transfer object.
pub struct ExportResult {
    pub exported_count: u64,
    pub entries: Vec<TimesheetEntry>,
}

#[derive(Debug, Deserialize)]
/// GenerateTimesheetsBody data transfer object.
pub struct GenerateTimesheetsBody {
    pub start: String,
    pub end: String,
}

#[derive(Debug, Serialize)]
/// GenerateResult data transfer object.
pub struct GenerateResult {
    pub created: usize,
}

// ============================================================================
// Helpers
// ============================================================================

/// Parse an ISO week string such as `"2026-W13"` into a `NaiveDate` pointing
/// to the Monday of that week.
fn parse_iso_week(week_str: &str) -> Result<NaiveDate, CalendarError> {
    // Expected format: YYYY-Www
    let parts: Vec<&str> = week_str.splitn(2, '-').collect();
    if parts.len() != 2 || !parts[1].starts_with('W') {
        return Err(CalendarError::InvalidInput(format!(
            "Invalid week format '{}', expected YYYY-Www",
            week_str
        )));
    }

    let year: i32 = parts[0]
        .parse()
        .map_err(|_| CalendarError::InvalidInput(format!("Invalid year in week '{}'", week_str)))?;
    let week_num: u32 = parts[1][1..].parse().map_err(|_| {
        CalendarError::InvalidInput(format!("Invalid week number in week '{}'", week_str))
    })?;

    // Find the Monday of that ISO week: Jan 4 is always in week 1.
    let jan4 = NaiveDate::from_ymd_opt(year, 1, 4)
        .ok_or_else(|| CalendarError::InvalidInput("Invalid year".to_string()))?;
    let week1_monday = jan4 - Duration::days(jan4.weekday().num_days_from_monday() as i64);
    let target_monday = week1_monday + Duration::weeks((week_num as i64) - 1);

    Ok(target_monday)
}

// ============================================================================
// list_timesheets
// ============================================================================

/// `GET /api/v1/timesheets?user_id=&week=YYYY-Www`
///
/// List timesheet entries for the given user and ISO week.
/// `user_id` defaults to the authenticated user. `week` defaults to current.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_timesheets(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListTimesheetsQuery>,
) -> Result<Json<Vec<TimesheetEntry>>, CalendarError> {
    let user_id = params.user_id.unwrap_or(claims.sub);

    let week_date = match &params.week {
        Some(w) => parse_iso_week(w)?,
        None => {
            let today = chrono::Utc::now().date_naive();
            // Monday of current week
            today - Duration::days(today.weekday().num_days_from_monday() as i64)
        },
    };

    let repo = TimesheetRepository::new(&state.pool);
    let entries = repo
        .list_by_user_week(user_id, week_date)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(entries))
}

// ============================================================================
// update_timesheet
// ============================================================================

/// `PUT /api/v1/timesheets/:id`
///
/// Update hours and optional category for a timesheet entry (manual correction).
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn update_timesheet(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Extension(_claims): Extension<Claims>,
    Json(body): Json<UpdateTimesheetBody>,
) -> Result<Json<TimesheetEntry>, CalendarError> {
    if body.hours < 0.0 || body.hours > 24.0 {
        return Err(CalendarError::InvalidInput(
            "hours must be between 0 and 24".to_string(),
        ));
    }

    let repo = TimesheetRepository::new(&state.pool);

    // Verify existence first
    repo.find_by_id(id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    let updated = repo
        .update(id, body.hours, body.category_id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(updated))
}

// ============================================================================
// validate_week
// ============================================================================

/// `POST /api/v1/timesheets/validate`
///
/// Mark all timesheet entries for the current user and given week as validated.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn validate_week(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ValidateWeekBody>,
) -> Result<Json<ValidateWeekResult>, CalendarError> {
    let week_date = parse_iso_week(&body.week)?;

    let repo = TimesheetRepository::new(&state.pool);
    let rows_validated = repo
        .validate_week(claims.sub, week_date)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(ValidateWeekResult {
        week: body.week,
        rows_validated,
    }))
}

// ============================================================================
// export_timesheets
// ============================================================================

/// `POST /api/v1/timesheets/export`
///
/// Fetch all timesheet entries for the current user in the given date range,
/// mark them as exported, and return them as a JSON array.
/// CSV generation is handled on the frontend.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn export_timesheets(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ExportTimesheetsBody>,
) -> Result<Json<ExportResult>, CalendarError> {
    let start: NaiveDate = body.start.parse().map_err(|_| {
        CalendarError::InvalidInput("Invalid start date (expected YYYY-MM-DD)".to_string())
    })?;
    let end: NaiveDate = body.end.parse().map_err(|_| {
        CalendarError::InvalidInput("Invalid end date (expected YYYY-MM-DD)".to_string())
    })?;

    if start > end {
        return Err(CalendarError::InvalidInput(
            "start must be before or equal to end".to_string(),
        ));
    }

    let repo = TimesheetRepository::new(&state.pool);
    let entries = repo
        .list_for_user(claims.sub, start, end)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let ids: Vec<Uuid> = entries.iter().map(|e| e.id).collect();
    let exported_count = if !ids.is_empty() {
        repo.mark_exported(&ids)
            .await
            .map_err(|_| CalendarError::InternalError)?
    } else {
        0
    };

    Ok(Json(ExportResult {
        exported_count,
        entries,
    }))
}

// ============================================================================
// generate_timesheets
// ============================================================================

/// `POST /api/v1/timesheets/generate`
///
/// Query all calendar events (shifts, bookings, tasks) for the current user
/// in the specified date range, and create `timesheet_entries` with
/// `auto_generated = true`. Hours are calculated from event duration.
/// Already-generated entries for the same event are skipped.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn generate_timesheets(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<GenerateTimesheetsBody>,
) -> Result<(StatusCode, Json<GenerateResult>), CalendarError> {
    let start: NaiveDate = body.start.parse().map_err(|_| {
        CalendarError::InvalidInput("Invalid start date (expected YYYY-MM-DD)".to_string())
    })?;
    let end: NaiveDate = body.end.parse().map_err(|_| {
        CalendarError::InvalidInput("Invalid end date (expected YYYY-MM-DD)".to_string())
    })?;

    if start > end {
        return Err(CalendarError::InvalidInput(
            "start must be before or equal to end".to_string(),
        ));
    }

    let start_dt = start
        .and_hms_opt(0, 0, 0)
        .map(|dt| dt.and_utc())
        .ok_or_else(|| CalendarError::InvalidInput("Invalid start date".to_string()))?;
    let end_dt = end
        .and_hms_opt(23, 59, 59)
        .map(|dt| dt.and_utc())
        .ok_or_else(|| CalendarError::InvalidInput("Invalid end date".to_string()))?;

    // Fetch all events for this user in the date range that are relevant for
    // timesheeting: shifts, tasks, and standard events (not all-day leaves).
    let events = sqlx::query_as::<_, signapps_db::models::calendar::Event>(
        r#"
        SELECT e.*
        FROM calendar.events e
        JOIN calendar.calendars c ON c.id = e.calendar_id
        WHERE e.is_deleted = FALSE
          AND e.is_all_day = FALSE
          AND e.event_type IN ('shift', 'task', 'event', 'booking')
          AND e.start_time >= $1
          AND e.end_time <= $2
          AND (e.created_by = $3 OR e.assigned_to = $3
               OR EXISTS (
                   SELECT 1 FROM calendar.event_attendees ea
                   WHERE ea.event_id = e.id AND ea.user_id = $3
               ))
        ORDER BY e.start_time
        "#,
    )
    .bind(start_dt)
    .bind(end_dt)
    .bind(claims.sub)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|_| CalendarError::InternalError)?;

    // Fetch existing auto-generated entries for the range to avoid duplicates.
    let existing_repo = TimesheetRepository::new(&state.pool);
    let existing = existing_repo
        .list_for_user(claims.sub, start, end)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let existing_event_ids: std::collections::HashSet<Uuid> =
        existing.iter().filter_map(|e| e.event_id).collect();

    let repo = TimesheetRepository::new(&state.pool);
    let mut created = 0usize;

    for event in &events {
        if existing_event_ids.contains(&event.id) {
            continue;
        }

        let hours = {
            let duration = event.end_time - event.start_time;
            let h = duration.num_minutes() as f64 / 60.0;
            // Cap at 24h and round to 2 decimal places
            (h.min(24.0) * 100.0).round() / 100.0
        };

        if hours <= 0.0 {
            continue;
        }

        let date = event.start_time.date_naive();

        match repo
            .create(
                claims.sub,
                Some(event.id),
                date,
                hours,
                event.category_id,
                true,
            )
            .await
        {
            Ok(_) => created += 1,
            Err(e) => {
                tracing::warn!(
                    event_id = %event.id,
                    error = %e,
                    "Failed to create auto-generated timesheet entry"
                );
            },
        }
    }

    Ok((StatusCode::CREATED, Json(GenerateResult { created })))
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
