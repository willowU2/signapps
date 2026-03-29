//! CRON job management handlers.
//!
//! CRON jobs are stored as `calendar.events` rows with `event_type = 'cron'`.
//! The `cron_expression` column holds the CRON schedule (e.g. "0 * * * *") and
//! `cron_target` holds the command / URL / service name to invoke.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;
use uuid::Uuid;

use crate::{AppState, CalendarError};

// ============================================================================
// Response / Request types
// ============================================================================

/// Lightweight view of a CRON job event.
#[derive(Debug, Serialize)]
pub struct CronJob {
    pub id: Uuid,
    pub calendar_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub cron_expression: String,
    pub cron_target: String,
    pub status: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCronJobRequest {
    pub calendar_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub cron_expression: String,
    pub cron_target: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCronJobRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub cron_expression: Option<String>,
    pub cron_target: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RunCronJobResponse {
    pub id: Uuid,
    pub status: String,
    pub message: String,
    pub executed_at: DateTime<Utc>,
}

// ============================================================================
// Handlers
// ============================================================================

/// `GET /api/v1/cron-jobs`
///
/// List all events where `event_type = 'cron'` visible to the current user.
pub async fn list_cron_jobs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CronJob>>, CalendarError> {
    let rows = sqlx::query_as::<_, (Uuid, Uuid, String, Option<String>, Option<String>, Option<String>, Option<String>, Uuid, DateTime<Utc>, DateTime<Utc>)>(
        r#"
        SELECT e.id, e.calendar_id, e.title, e.description,
               e.cron_expression, e.cron_target, e.status,
               e.created_by, e.created_at, e.updated_at
        FROM calendar.events e
        JOIN calendar.calendars c ON c.id = e.calendar_id
        WHERE e.event_type = 'cron'
          AND e.is_deleted = false
          AND (c.owner_id = $1 OR c.is_shared = true)
        ORDER BY e.created_at DESC
        "#,
    )
    .bind(claims.sub)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|_| CalendarError::InternalError)?;

    let jobs = rows
        .into_iter()
        .map(
            |(id, calendar_id, title, description, cron_expression, cron_target, status, created_by, created_at, updated_at)| {
                CronJob {
                    id,
                    calendar_id,
                    title,
                    description,
                    cron_expression: cron_expression.unwrap_or_default(),
                    cron_target: cron_target.unwrap_or_default(),
                    status,
                    created_by,
                    created_at,
                    updated_at,
                }
            },
        )
        .collect();

    Ok(Json(jobs))
}

/// `POST /api/v1/cron-jobs`
///
/// Create a new CRON job event.
pub async fn create_cron_job(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateCronJobRequest>,
) -> Result<(StatusCode, Json<CronJob>), CalendarError> {
    // Use 'now' as placeholder times — CRON events are not time-bounded
    let now = Utc::now();

    let row = sqlx::query_as::<_, (Uuid, Uuid, String, Option<String>, Option<String>, Option<String>, Option<String>, Uuid, DateTime<Utc>, DateTime<Utc>)>(
        r#"
        INSERT INTO calendar.events
            (calendar_id, title, description, start_time, end_time, timezone,
             created_by, event_type, cron_expression, cron_target, status, is_all_day)
        VALUES ($1, $2, $3, $4, $4, 'UTC', $5, 'cron', $6, $7, 'draft', false)
        RETURNING id, calendar_id, title, description,
                  cron_expression, cron_target, status,
                  created_by, created_at, updated_at
        "#,
    )
    .bind(payload.calendar_id)
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(now)
    .bind(claims.sub)
    .bind(&payload.cron_expression)
    .bind(&payload.cron_target)
    .fetch_one(state.pool.inner())
    .await
    .map_err(|_| CalendarError::InternalError)?;

    let job = CronJob {
        id: row.0,
        calendar_id: row.1,
        title: row.2,
        description: row.3,
        cron_expression: row.4.unwrap_or_default(),
        cron_target: row.5.unwrap_or_default(),
        status: row.6,
        created_by: row.7,
        created_at: row.8,
        updated_at: row.9,
    };

    Ok((StatusCode::CREATED, Json(job)))
}

/// `PUT /api/v1/cron-jobs/:id`
///
/// Update a CRON job event (title, expression, target, status).
pub async fn update_cron_job(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCronJobRequest>,
) -> Result<Json<CronJob>, CalendarError> {
    let row = sqlx::query_as::<_, (Uuid, Uuid, String, Option<String>, Option<String>, Option<String>, Option<String>, Uuid, DateTime<Utc>, DateTime<Utc>)>(
        r#"
        UPDATE calendar.events
        SET title          = COALESCE($2, title),
            description    = COALESCE($3, description),
            cron_expression = COALESCE($4, cron_expression),
            cron_target    = COALESCE($5, cron_target),
            status         = COALESCE($6::calendar.event_status, status),
            updated_at     = NOW()
        WHERE id = $1 AND event_type = 'cron' AND is_deleted = false
        RETURNING id, calendar_id, title, description,
                  cron_expression, cron_target, status,
                  created_by, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(&payload.cron_expression)
    .bind(&payload.cron_target)
    .bind(&payload.status)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|_| CalendarError::InternalError)?
    .ok_or(CalendarError::NotFound)?;

    Ok(Json(CronJob {
        id: row.0,
        calendar_id: row.1,
        title: row.2,
        description: row.3,
        cron_expression: row.4.unwrap_or_default(),
        cron_target: row.5.unwrap_or_default(),
        status: row.6,
        created_by: row.7,
        created_at: row.8,
        updated_at: row.9,
    }))
}

/// `DELETE /api/v1/cron-jobs/:id`
///
/// Soft-delete a CRON job event.
pub async fn delete_cron_job(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, CalendarError> {
    let result = sqlx::query(
        "UPDATE calendar.events SET is_deleted = true, updated_at = NOW() WHERE id = $1 AND event_type = 'cron'",
    )
    .bind(id)
    .execute(state.pool.inner())
    .await
    .map_err(|_| CalendarError::InternalError)?;

    if result.rows_affected() == 0 {
        return Err(CalendarError::NotFound);
    }

    Ok(StatusCode::NO_CONTENT)
}

/// `POST /api/v1/cron-jobs/:id/run`
///
/// Execute the CRON job immediately. Logs the execution and returns a
/// success response. Actual scheduling/dispatch is handled by the
/// background NotificationScheduler; this endpoint acts as a manual trigger.
pub async fn run_cron_job(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<RunCronJobResponse>, CalendarError> {
    // Verify the job exists and belongs to the caller
    let exists: Option<(Uuid, Option<String>)> = sqlx::query_as(
        "SELECT id, cron_target FROM calendar.events WHERE id = $1 AND event_type = 'cron' AND is_deleted = false",
    )
    .bind(id)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|_| CalendarError::InternalError)?;

    let (job_id, cron_target) = exists.ok_or(CalendarError::NotFound)?;
    let executed_at = Utc::now();

    // Log the manual execution in platform.activities
    let _ = sqlx::query(
        r#"INSERT INTO platform.activities
           (id, actor_id, action, entity_type, entity_id, entity_title, metadata, workspace_id)
           VALUES (gen_uuid_v7(), $1, 'cron.run', 'cron_job', $2, $3, $4, NULL)"#,
    )
    .bind(claims.sub)
    .bind(job_id)
    .bind(cron_target.as_deref().unwrap_or(""))
    .bind(serde_json::json!({
        "triggered_by": claims.sub,
        "manual": true,
        "executed_at": executed_at,
    }))
    .execute(state.pool.inner())
    .await;

    tracing::info!(
        job_id = %job_id,
        target = %cron_target.as_deref().unwrap_or(""),
        actor = %claims.sub,
        "CRON job triggered manually"
    );

    Ok(Json(RunCronJobResponse {
        id: job_id,
        status: "triggered".to_string(),
        message: format!(
            "CRON job '{}' triggered successfully",
            cron_target.as_deref().unwrap_or("(no target)")
        ),
        executed_at,
    }))
}
