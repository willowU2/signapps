//! Timesheet handlers — time entry CRUD + timer start/stop + stats
//!
//! Manages time entries stored in the `timesheet.entries` table.
//! Supports both manual entries and timer-based recording.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::AppState;
use signapps_common::Claims;

// ============================================================================
// Types
// ============================================================================

/// A timesheet entry record.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, utoipa::ToSchema)]
pub struct TimesheetEntry {
    /// Unique identifier.
    pub id: Uuid,
    /// Name of the task being tracked.
    pub task_name: Option<String>,
    /// When work started.
    pub start_time: DateTime<Utc>,
    /// When work ended (NULL if timer is running).
    pub end_time: Option<DateTime<Utc>>,
    /// Total duration in seconds.
    pub duration_seconds: i32,
    /// Whether this entry is billable.
    pub is_billable: bool,
    /// Optional project association.
    pub project_id: Option<Uuid>,
    /// UUID of the entry owner.
    pub owner_id: Uuid,
    /// Tenant scope.
    pub tenant_id: Option<Uuid>,
    /// Creation timestamp.
    pub created_at: Option<DateTime<Utc>>,
}

/// Request body to create a timesheet entry (manual).
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateEntryRequest {
    /// Task name.
    pub task_name: Option<String>,
    /// Start time (ISO 8601).
    pub start_time: DateTime<Utc>,
    /// End time (ISO 8601).
    pub end_time: Option<DateTime<Utc>>,
    /// Duration in seconds (overrides end_time calculation if provided).
    pub duration_seconds: Option<i32>,
    /// Whether billable.
    pub is_billable: Option<bool>,
    /// Optional project ID.
    pub project_id: Option<Uuid>,
}

/// Request body to update a timesheet entry.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateEntryRequest {
    /// Task name.
    pub task_name: Option<String>,
    /// Start time.
    pub start_time: Option<DateTime<Utc>>,
    /// End time.
    pub end_time: Option<DateTime<Utc>>,
    /// Duration in seconds.
    pub duration_seconds: Option<i32>,
    /// Whether billable.
    pub is_billable: Option<bool>,
    /// Project ID.
    pub project_id: Option<Uuid>,
}

/// Request body to start a timer.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct StartTimerRequest {
    /// Task name for the timer session.
    pub task_name: Option<String>,
    /// Whether the session is billable.
    pub is_billable: Option<bool>,
    /// Optional project ID.
    pub project_id: Option<Uuid>,
}

/// Query parameters for listing timesheet entries.
#[derive(Debug, Deserialize, Default)]
pub struct TimesheetQueryParams {
    /// Start of date range filter.
    pub from: Option<DateTime<Utc>>,
    /// End of date range filter.
    pub to: Option<DateTime<Utc>>,
    /// Maximum results.
    pub limit: Option<i64>,
    /// Offset for pagination.
    pub offset: Option<i64>,
}

/// Query parameters for stats.
#[derive(Debug, Deserialize, Default)]
pub struct StatsQueryParams {
    /// Period: "week", "month", "year". Defaults to "week".
    pub period: Option<String>,
}

/// Aggregated timesheet stats.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct TimesheetStats {
    /// Total seconds logged in the period.
    pub total_seconds: i64,
    /// Total billable seconds in the period.
    pub billable_seconds: i64,
    /// Number of entries in the period.
    pub entry_count: i64,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/workforce/timesheet
///
/// Lists timesheet entries for the authenticated user, optionally filtered by date range.
///
/// # Errors
///
/// Returns 500 on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/timesheet",
    responses(
        (status = 200, description = "List of timesheet entries", body = Vec<TimesheetEntry>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Timesheet"
)]
#[tracing::instrument(skip_all)]
pub async fn list_entries(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<TimesheetQueryParams>,
) -> Result<impl IntoResponse, StatusCode> {
    let owner_id = claims.sub.parse::<Uuid>().map_err(|_| StatusCode::BAD_REQUEST)?;
    let limit = params.limit.unwrap_or(100);
    let offset = params.offset.unwrap_or(0);

    let records: Vec<TimesheetEntry> = match (params.from, params.to) {
        (Some(from), Some(to)) => {
            sqlx::query_as(
                r#"SELECT * FROM timesheet.entries
                   WHERE owner_id = $1 AND start_time >= $2 AND start_time <= $3
                   ORDER BY start_time DESC
                   LIMIT $4 OFFSET $5"#,
            )
            .bind(owner_id)
            .bind(from)
            .bind(to)
            .bind(limit)
            .bind(offset)
            .fetch_all(&*state.pool)
            .await
        },
        (Some(from), None) => {
            sqlx::query_as(
                r#"SELECT * FROM timesheet.entries
                   WHERE owner_id = $1 AND start_time >= $2
                   ORDER BY start_time DESC
                   LIMIT $3 OFFSET $4"#,
            )
            .bind(owner_id)
            .bind(from)
            .bind(limit)
            .bind(offset)
            .fetch_all(&*state.pool)
            .await
        },
        _ => {
            sqlx::query_as(
                r#"SELECT * FROM timesheet.entries
                   WHERE owner_id = $1
                   ORDER BY start_time DESC
                   LIMIT $2 OFFSET $3"#,
            )
            .bind(owner_id)
            .bind(limit)
            .bind(offset)
            .fetch_all(&*state.pool)
            .await
        },
    }
    .map_err(|e| {
        tracing::error!("list_entries failed: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(records))
}

/// POST /api/v1/workforce/timesheet
///
/// Creates a new timesheet entry (manual input).
///
/// # Errors
///
/// Returns 500 on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/timesheet",
    request_body = CreateEntryRequest,
    responses(
        (status = 201, description = "Entry created", body = TimesheetEntry),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Timesheet"
)]
#[tracing::instrument(skip_all)]
pub async fn create_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateEntryRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let owner_id = claims.sub.parse::<Uuid>().map_err(|_| StatusCode::BAD_REQUEST)?;

    // Calculate duration from end_time if not explicitly provided
    let duration = payload.duration_seconds.unwrap_or_else(|| {
        payload
            .end_time
            .map(|end| (end - payload.start_time).num_seconds() as i32)
            .unwrap_or(0)
    });

    let record: TimesheetEntry = sqlx::query_as(
        r#"INSERT INTO timesheet.entries
           (task_name, start_time, end_time, duration_seconds, is_billable, project_id, owner_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *"#,
    )
    .bind(payload.task_name.as_deref())
    .bind(payload.start_time)
    .bind(payload.end_time)
    .bind(duration)
    .bind(payload.is_billable.unwrap_or(false))
    .bind(payload.project_id)
    .bind(owner_id)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("create_entry failed: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!(entry_id = %record.id, "Timesheet entry created");
    Ok((StatusCode::CREATED, Json(record)))
}

/// PUT /api/v1/workforce/timesheet/:id
///
/// Updates an existing timesheet entry. Only the owner can update.
///
/// # Errors
///
/// Returns 404 if not found or not owned.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    put,
    path = "/api/v1/workforce/timesheet/{id}",
    params(("id" = Uuid, Path, description = "Timesheet entry ID")),
    request_body = UpdateEntryRequest,
    responses(
        (status = 200, description = "Entry updated", body = TimesheetEntry),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Entry not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Timesheet"
)]
#[tracing::instrument(skip_all)]
pub async fn update_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateEntryRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let owner_id = claims.sub.parse::<Uuid>().map_err(|_| StatusCode::BAD_REQUEST)?;

    let record: Option<TimesheetEntry> = sqlx::query_as(
        r#"UPDATE timesheet.entries
           SET task_name = COALESCE($3, task_name),
               start_time = COALESCE($4, start_time),
               end_time = COALESCE($5, end_time),
               duration_seconds = COALESCE($6, duration_seconds),
               is_billable = COALESCE($7, is_billable),
               project_id = COALESCE($8, project_id)
           WHERE id = $1 AND owner_id = $2
           RETURNING *"#,
    )
    .bind(id)
    .bind(owner_id)
    .bind(payload.task_name.as_deref())
    .bind(payload.start_time)
    .bind(payload.end_time)
    .bind(payload.duration_seconds)
    .bind(payload.is_billable)
    .bind(payload.project_id)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("update_entry failed: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match record {
        Some(r) => Ok(Json(r)),
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// DELETE /api/v1/workforce/timesheet/:id
///
/// Deletes a timesheet entry. Only the owner can delete.
///
/// # Errors
///
/// Returns 404 if not found or not owned.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    delete,
    path = "/api/v1/workforce/timesheet/{id}",
    params(("id" = Uuid, Path, description = "Timesheet entry ID")),
    responses(
        (status = 204, description = "Entry deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Entry not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Timesheet"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let owner_id = claims.sub.parse::<Uuid>().map_err(|_| StatusCode::BAD_REQUEST)?;

    let result = sqlx::query(
        r#"DELETE FROM timesheet.entries WHERE id = $1 AND owner_id = $2"#,
    )
    .bind(id)
    .bind(owner_id)
    .execute(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("delete_entry failed: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    tracing::info!(entry_id = %id, "Timesheet entry deleted");
    Ok(StatusCode::NO_CONTENT)
}

/// POST /api/v1/workforce/timesheet/start
///
/// Starts a new timer. Creates an entry with start_time=now and no end_time.
/// Returns 409 if a timer is already running.
///
/// # Errors
///
/// Returns 409 if a timer is already running, 500 on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/timesheet/start",
    request_body = StartTimerRequest,
    responses(
        (status = 201, description = "Timer started", body = TimesheetEntry),
        (status = 401, description = "Unauthorized"),
        (status = 409, description = "Timer already running"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Timesheet"
)]
#[tracing::instrument(skip_all)]
pub async fn start_timer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<StartTimerRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let owner_id = claims.sub.parse::<Uuid>().map_err(|_| StatusCode::BAD_REQUEST)?;

    // Check for existing running timer
    let running: Option<Uuid> = sqlx::query_scalar(
        r#"SELECT id FROM timesheet.entries
           WHERE owner_id = $1 AND end_time IS NULL
           LIMIT 1"#,
    )
    .bind(owner_id)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("start_timer guard failed: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if running.is_some() {
        return Err(StatusCode::CONFLICT);
    }

    let record: TimesheetEntry = sqlx::query_as(
        r#"INSERT INTO timesheet.entries
           (task_name, start_time, is_billable, project_id, owner_id)
           VALUES ($1, NOW(), $2, $3, $4)
           RETURNING *"#,
    )
    .bind(payload.task_name.as_deref())
    .bind(payload.is_billable.unwrap_or(false))
    .bind(payload.project_id)
    .bind(owner_id)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("start_timer insert failed: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!(entry_id = %record.id, "Timer started");
    Ok((StatusCode::CREATED, Json(record)))
}

/// POST /api/v1/workforce/timesheet/stop
///
/// Stops the currently running timer. Sets end_time=now and computes duration.
/// Returns 404 if no timer is running.
///
/// # Errors
///
/// Returns 404 if no timer is running, 500 on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/timesheet/stop",
    responses(
        (status = 200, description = "Timer stopped", body = TimesheetEntry),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "No running timer"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Timesheet"
)]
#[tracing::instrument(skip_all)]
pub async fn stop_timer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let owner_id = claims.sub.parse::<Uuid>().map_err(|_| StatusCode::BAD_REQUEST)?;

    let record: Option<TimesheetEntry> = sqlx::query_as(
        r#"UPDATE timesheet.entries
           SET end_time = NOW(),
               duration_seconds = EXTRACT(EPOCH FROM (NOW() - start_time))::INTEGER
           WHERE owner_id = $1 AND end_time IS NULL
           RETURNING *"#,
    )
    .bind(owner_id)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("stop_timer failed: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match record {
        Some(r) => {
            tracing::info!(entry_id = %r.id, duration = r.duration_seconds, "Timer stopped");
            Ok(Json(r))
        },
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// GET /api/v1/workforce/timesheet/stats
///
/// Returns aggregated stats for the authenticated user over a given period.
///
/// # Errors
///
/// Returns 500 on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/timesheet/stats",
    responses(
        (status = 200, description = "Timesheet statistics", body = TimesheetStats),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Timesheet"
)]
#[tracing::instrument(skip_all)]
pub async fn get_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<StatsQueryParams>,
) -> Result<impl IntoResponse, StatusCode> {
    let owner_id = claims.sub.parse::<Uuid>().map_err(|_| StatusCode::BAD_REQUEST)?;

    // Determine interval based on period
    let interval = match params.period.as_deref().unwrap_or("week") {
        "month" => "1 month",
        "year" => "1 year",
        _ => "1 week",
    };

    let row: (Option<i64>, Option<i64>, Option<i64>) = sqlx::query_as(&format!(
        r#"SELECT
             COALESCE(SUM(duration_seconds), 0)::BIGINT,
             COALESCE(SUM(CASE WHEN is_billable THEN duration_seconds ELSE 0 END), 0)::BIGINT,
             COUNT(*)::BIGINT
           FROM timesheet.entries
           WHERE owner_id = $1 AND start_time >= NOW() - INTERVAL '{}'"#,
        interval
    ))
    .bind(owner_id)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("get_stats failed: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(TimesheetStats {
        total_seconds: row.0.unwrap_or(0),
        billable_seconds: row.1.unwrap_or(0),
        entry_count: row.2.unwrap_or(0),
    }))
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }
}
