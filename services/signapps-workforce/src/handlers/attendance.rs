//! HR2 — Attendance / Clock-in-Clock-out handlers
//!
//! Provides endpoints for recording employee check-in and check-out events.
//! Records are stored in the `workforce_attendance` table (public schema).

use axum::{
    extract::{Extension, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::AppState;
use signapps_common::{Claims, TenantContext};

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, utoipa::ToSchema)]
/// AttendanceRecord data transfer object.
pub struct AttendanceRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub employee_id: Uuid,
    /// Wall-clock time when the employee clocked in.
    pub clock_in: DateTime<Utc>,
    /// Wall-clock time when the employee clocked out (NULL while still clocked in).
    pub clock_out: Option<DateTime<Utc>>,
    /// Optional note supplied at clock-in/out time.
    pub note: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for ClockIn.
pub struct ClockInRequest {
    /// UUID of the employee clocking in.
    pub employee_id: Uuid,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for ClockOut.
pub struct ClockOutRequest {
    /// UUID of the employee clocking out.
    pub employee_id: Uuid,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
/// Query parameters for filtering results.
pub struct AttendanceQueryParams {
    pub employee_id: Option<Uuid>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

// ============================================================================
// Handlers
// ============================================================================

/// POST /api/v1/workforce/attendance/clock-in
///
/// Opens a new attendance record for the given employee.
/// Returns `409 Conflict` if the employee is already clocked in.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/attendance/clock-in",
    request_body = ClockInRequest,
    responses(
        (status = 201, description = "Clock-in recorded", body = AttendanceRecord),
        (status = 401, description = "Unauthorized"),
        (status = 409, description = "Employee already clocked in"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Attendance"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn clock_in(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Json(payload): Json<ClockInRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    // Guard: ensure no open record exists
    let open: Option<Uuid> = sqlx::query_scalar(
        r#"SELECT id FROM workforce_attendance
           WHERE tenant_id = $1 AND employee_id = $2 AND clock_out IS NULL
           LIMIT 1"#,
    )
    .bind(ctx.tenant_id)
    .bind(payload.employee_id)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("clock_in guard query failed: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if open.is_some() {
        return Err(StatusCode::CONFLICT);
    }

    let record: AttendanceRecord = sqlx::query_as(
        r#"INSERT INTO workforce_attendance
           (id, tenant_id, employee_id, clock_in, note, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, NOW(), $3, NOW(), NOW())
           RETURNING *"#,
    )
    .bind(ctx.tenant_id)
    .bind(payload.employee_id)
    .bind(payload.note.as_deref())
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("clock_in insert failed: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!(
        tenant = %ctx.tenant_id,
        employee_id = %payload.employee_id,
        "Employee clocked in"
    );
    Ok((StatusCode::CREATED, Json(record)))
}

/// POST /api/v1/workforce/attendance/clock-out
///
/// Closes the most recent open attendance record for the given employee.
/// Returns `404` if the employee is not currently clocked in.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/attendance/clock-out",
    request_body = ClockOutRequest,
    responses(
        (status = 200, description = "Clock-out recorded", body = AttendanceRecord),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Employee not currently clocked in"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Attendance"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn clock_out(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Json(payload): Json<ClockOutRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let record: Option<AttendanceRecord> = sqlx::query_as(
        r#"UPDATE workforce_attendance
           SET clock_out = NOW(), note = COALESCE($3, note), updated_at = NOW()
           WHERE tenant_id = $1 AND employee_id = $2 AND clock_out IS NULL
           RETURNING *"#,
    )
    .bind(ctx.tenant_id)
    .bind(payload.employee_id)
    .bind(payload.note.as_deref())
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("clock_out update failed: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match record {
        Some(r) => {
            tracing::info!(
                tenant = %ctx.tenant_id,
                employee_id = %payload.employee_id,
                "Employee clocked out"
            );
            Ok(Json(r))
        },
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// GET /api/v1/workforce/attendance
///
/// Returns attendance records for the tenant, optionally filtered by employee.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/attendance",
    responses(
        (status = 200, description = "List of attendance records"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Attendance"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_attendance(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Query(params): Query<AttendanceQueryParams>,
) -> Result<impl IntoResponse, StatusCode> {
    let limit = params.limit.unwrap_or(100);
    let offset = params.offset.unwrap_or(0);

    let records: Vec<AttendanceRecord> = if let Some(emp_id) = params.employee_id {
        sqlx::query_as(
            r#"SELECT * FROM workforce_attendance
               WHERE tenant_id = $1 AND employee_id = $2
               ORDER BY clock_in DESC
               LIMIT $3 OFFSET $4"#,
        )
        .bind(ctx.tenant_id)
        .bind(emp_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&*state.pool)
        .await
    } else {
        sqlx::query_as(
            r#"SELECT * FROM workforce_attendance
               WHERE tenant_id = $1
               ORDER BY clock_in DESC
               LIMIT $2 OFFSET $3"#,
        )
        .bind(ctx.tenant_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&*state.pool)
        .await
    }
    .map_err(|e| {
        tracing::error!("list_attendance failed: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(records))
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
