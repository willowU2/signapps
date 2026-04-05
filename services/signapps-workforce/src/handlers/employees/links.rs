//! Employee user-link handlers.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use uuid::Uuid;

use crate::AppState;
use signapps_common::{Claims, TenantContext};

use super::types::{Employee, LinkUserRequest};

/// Link employee to a user account
#[utoipa::path(
    post,
    path = "/api/v1/workforce/employees/{id}/link-user",
    params(("id" = uuid::Uuid, Path, description = "Employee ID")),
    request_body = LinkUserRequest,
    responses(
        (status = 200, description = "Employee linked to user", body = Employee),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Employee not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Employees"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn link_user(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(req): Json<LinkUserRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let now = Utc::now();

    let employee: Employee = sqlx::query_as(
        r#"
        UPDATE workforce_employees
        SET user_id = $3, updated_at = $4
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .bind(req.user_id)
    .bind(now)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to link user: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(employee))
}

/// Unlink employee from user account
#[utoipa::path(
    post,
    path = "/api/v1/workforce/employees/{id}/unlink-user",
    params(("id" = uuid::Uuid, Path, description = "Employee ID")),
    responses(
        (status = 200, description = "Employee unlinked from user", body = Employee),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Employee not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Employees"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn unlink_user(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let now = Utc::now();

    let employee: Employee = sqlx::query_as(
        r#"
        UPDATE workforce_employees
        SET user_id = NULL, updated_at = $3
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .bind(now)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to unlink user: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(employee))
}
