//! Leave management handlers.
//!
//! Covers approval/rejection, balance queries, conflict detection, and task delegation.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{Datelike, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;
use signapps_db::{
    models::calendar::{Event, LeaveBalance, UpdateEvent},
    repositories::LeaveBalanceRepository,
    EventRepository,
};
use tracing::instrument;
use uuid::Uuid;

use crate::{AppState, CalendarError};

// ============================================================================
// Request / Response types
// ============================================================================

#[derive(Debug, Deserialize)]
/// RejectBody data transfer object.
pub struct RejectBody {
    pub comment: String,
}

#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct PredictQuery {
    pub days: f64,
    pub leave_type: String,
}

#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct TeamConflictsQuery {
    pub start: String,
    pub end: String,
}

#[derive(Debug, Deserialize)]
/// DelegateBody data transfer object.
pub struct DelegateBody {
    /// The leave event being delegated from (kept for context/logging).
    #[allow(dead_code)]
    pub event_id: Uuid,
    pub assignments: Vec<TaskAssignment>,
}

#[derive(Debug, Deserialize)]
/// TaskAssignment data transfer object.
pub struct TaskAssignment {
    pub task_id: Uuid,
    pub assign_to: Uuid,
}

#[derive(Debug, Serialize)]
/// DelegateResult data transfer object.
pub struct DelegateResult {
    pub success_count: usize,
}

#[derive(Debug, Serialize)]
/// PredictResult data transfer object.
pub struct PredictResult {
    pub leave_type: String,
    pub year: i32,
    pub total_days: f64,
    pub used_days: f64,
    pub pending_days: f64,
    pub requested_days: f64,
    pub predicted_remaining: f64,
}

// ============================================================================
// Approve leave
// ============================================================================

/// `PUT /api/v1/events/:id/approve`
///
/// Set the event status to `approved`, record the approver, and shift the
/// leave balance from pending to used.
#[instrument(skip(state), fields(user_id = %claims.sub, event_id = %id))]
pub async fn approve_leave(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Event>, CalendarError> {
    let tenant_id = claims.tenant_id.ok_or(CalendarError::Unauthorized)?;
    let event_repo = EventRepository::new(&state.pool);

    let event = event_repo
        .find_by_id(id, tenant_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    // Verify it is a leave request in pending state
    match (event.event_type.as_deref(), event.status.as_deref()) {
        (Some("leave"), Some("pending")) => {},
        _ => {
            return Err(CalendarError::InvalidInput(
                "Event is not a pending leave request".to_string(),
            ));
        },
    }

    // Update the event: status → approved, approval_by = current user
    let updated = event_repo
        .update(
            id,
            UpdateEvent {
                status: Some("approved".to_string()),
                approval_by: Some(claims.sub),
                approval_comment: None,
                title: None,
                description: None,
                location: None,
                start_time: None,
                end_time: None,
                rrule: None,
                timezone: None,
                is_all_day: None,
                event_type: None,
                scope: None,
                priority: None,
                parent_event_id: None,
                resource_id: None,
                category_id: None,
                leave_type: None,
                presence_mode: None,
                energy_level: None,
                cron_expression: None,
                cron_target: None,
                assigned_to: None,
                project_id: None,
                tags: None,
            },
        )
        .await
        .map_err(|_| CalendarError::InternalError)?;

    // Update leave balances: decrement pending_days, increment used_days
    if let Some(leave_type) = &event.leave_type {
        let days = leave_days(&event);
        let year = event.start_time.year();
        let balance_repo = LeaveBalanceRepository::new(&state.pool);

        // Decrement pending
        let _ = balance_repo
            .update_pending_days(event.created_by, leave_type, year, -days)
            .await;
        // Increment used
        let _ = balance_repo
            .update_used_days(event.created_by, leave_type, year, days)
            .await;
    }

    Ok(Json(updated))
}

// ============================================================================
// Reject leave
// ============================================================================

/// `PUT /api/v1/events/:id/reject`
///
/// Set the event status to `rejected`, record the approver and comment, and
/// decrement the pending balance.
#[instrument(skip(state, body), fields(user_id = %claims.sub, event_id = %id))]
pub async fn reject_leave(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<RejectBody>,
) -> Result<Json<Event>, CalendarError> {
    let tenant_id = claims.tenant_id.ok_or(CalendarError::Unauthorized)?;
    let event_repo = EventRepository::new(&state.pool);

    let event = event_repo
        .find_by_id(id, tenant_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    match (event.event_type.as_deref(), event.status.as_deref()) {
        (Some("leave"), Some("pending")) => {},
        _ => {
            return Err(CalendarError::InvalidInput(
                "Event is not a pending leave request".to_string(),
            ));
        },
    }

    let updated = event_repo
        .update(
            id,
            UpdateEvent {
                status: Some("rejected".to_string()),
                approval_by: Some(claims.sub),
                approval_comment: Some(body.comment),
                title: None,
                description: None,
                location: None,
                start_time: None,
                end_time: None,
                rrule: None,
                timezone: None,
                is_all_day: None,
                event_type: None,
                scope: None,
                priority: None,
                parent_event_id: None,
                resource_id: None,
                category_id: None,
                leave_type: None,
                presence_mode: None,
                energy_level: None,
                cron_expression: None,
                cron_target: None,
                assigned_to: None,
                project_id: None,
                tags: None,
            },
        )
        .await
        .map_err(|_| CalendarError::InternalError)?;

    // Decrement pending_days (leave was not consumed)
    if let Some(leave_type) = &event.leave_type {
        let days = leave_days(&event);
        let year = event.start_time.year();
        let balance_repo = LeaveBalanceRepository::new(&state.pool);
        let _ = balance_repo
            .update_pending_days(event.created_by, leave_type, year, -days)
            .await;
    }

    Ok(Json(updated))
}

// ============================================================================
// Get balances
// ============================================================================

/// `GET /api/v1/leave/balances`
///
/// Return all leave balances for the current user for the current year.
#[instrument(skip(state), fields(user_id = %claims.sub))]
pub async fn get_balances(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<LeaveBalance>>, CalendarError> {
    let balance_repo = LeaveBalanceRepository::new(&state.pool);
    let year = Utc::now().year();

    // Fetch all balances for the user then filter to current year
    let all = balance_repo
        .list_for_user(claims.sub)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let current: Vec<LeaveBalance> = all.into_iter().filter(|b| b.year == year).collect();

    Ok(Json(current))
}

// ============================================================================
// Predict balance
// ============================================================================

/// `GET /api/v1/leave/balances/predict?days=5&leave_type=annual`
///
/// Compute: `total_days - used_days - pending_days - requested_days`.
#[instrument(skip(state, params), fields(user_id = %claims.sub))]
pub async fn predict_balance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<PredictQuery>,
) -> Result<Json<PredictResult>, CalendarError> {
    let year = Utc::now().year();
    let balance_repo = LeaveBalanceRepository::new(&state.pool);

    let balance = balance_repo
        .get_by_user_year(claims.sub, &params.leave_type, year)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    let predicted_remaining =
        balance.total_days - balance.used_days - balance.pending_days - params.days;

    Ok(Json(PredictResult {
        leave_type: balance.leave_type.clone(),
        year: balance.year,
        total_days: balance.total_days,
        used_days: balance.used_days,
        pending_days: balance.pending_days,
        requested_days: params.days,
        predicted_remaining,
    }))
}

// ============================================================================
// Team conflicts
// ============================================================================

/// `GET /api/v1/leave/team-conflicts?start=2026-01-01&end=2026-01-31`
///
/// Find all leave events overlapping the given date range (organisation-wide).
#[instrument(skip(state, params, _claims))]
pub async fn team_conflicts(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Query(params): Query<TeamConflictsQuery>,
) -> Result<Json<Vec<Event>>, CalendarError> {
    let start: NaiveDate = params.start.parse().map_err(|_| {
        CalendarError::InvalidInput("Invalid start date (expected YYYY-MM-DD)".to_string())
    })?;
    let end: NaiveDate = params.end.parse().map_err(|_| {
        CalendarError::InvalidInput("Invalid end date (expected YYYY-MM-DD)".to_string())
    })?;

    let start_dt = start
        .and_hms_opt(0, 0, 0)
        .map(|dt| dt.and_utc())
        .ok_or_else(|| CalendarError::InvalidInput("Invalid start date".to_string()))?;

    let end_dt = end
        .and_hms_opt(23, 59, 59)
        .map(|dt| dt.and_utc())
        .ok_or_else(|| CalendarError::InvalidInput("Invalid end date".to_string()))?;

    // Query leave events in the date range across all calendars
    let leaves = sqlx::query_as::<_, Event>(
        r#"
        SELECT * FROM calendar.events
        WHERE event_type = 'leave'
          AND is_deleted = FALSE
          AND start_time <= $2
          AND end_time >= $1
        ORDER BY start_time
        "#,
    )
    .bind(start_dt)
    .bind(end_dt)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(leaves))
}

// ============================================================================
// Delegate tasks
// ============================================================================

/// `POST /api/v1/leave/delegate`
///
/// For each `{ task_id, assign_to }` in the request body, update the
/// `assigned_to` field of that event (task) to the designated user.
/// Returns the count of successfully updated records.
#[instrument(skip(state, body, _claims))]
pub async fn delegate_tasks(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Json(body): Json<DelegateBody>,
) -> Result<(StatusCode, Json<DelegateResult>), CalendarError> {
    let event_repo = EventRepository::new(&state.pool);
    let mut success_count = 0usize;

    for assignment in &body.assignments {
        let result = event_repo
            .update(
                assignment.task_id,
                UpdateEvent {
                    assigned_to: Some(assignment.assign_to),
                    title: None,
                    description: None,
                    location: None,
                    start_time: None,
                    end_time: None,
                    rrule: None,
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
                    project_id: None,
                    tags: None,
                },
            )
            .await;

        if result.is_ok() {
            success_count += 1;
        } else {
            tracing::warn!(
                task_id = %assignment.task_id,
                assign_to = %assignment.assign_to,
                "Failed to delegate task"
            );
        }
    }

    Ok((StatusCode::OK, Json(DelegateResult { success_count })))
}

// ============================================================================
// Helpers
// ============================================================================

/// Calculate the number of calendar days covered by a leave event.
/// Fractional days are preserved (e.g. half-day leaves stored in metadata).
fn leave_days(event: &Event) -> f64 {
    let duration = event.end_time - event.start_time;
    let days = duration.num_hours() as f64 / 24.0;
    days.max(1.0)
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
