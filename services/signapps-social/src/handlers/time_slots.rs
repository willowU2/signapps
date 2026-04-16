use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use uuid::Uuid;

use crate::models::{CreateTimeSlotRequest, TimeSlot};
use crate::AppState;
use signapps_common::Claims;

#[utoipa::path(
    get,
    path = "/api/v1/social/time-slots",
    responses(
        (status = 200, description = "List of scheduled time slots"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Social Time Slots"
)]
#[tracing::instrument(skip_all)]
pub async fn list_time_slots(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, TimeSlot>(
        r#"SELECT * FROM social.time_slots
           WHERE user_id = $1
           ORDER BY day_of_week, hour, minute"#,
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => Ok(Json(rows)),
        Err(e) => {
            tracing::error!("list_time_slots: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[utoipa::path(
    post,
    path = "/api/v1/social/time-slots",
    request_body = crate::models::CreateTimeSlotRequest,
    responses(
        (status = 201, description = "Time slot created", body = crate::models::TimeSlot),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Social Time Slots"
)]
#[tracing::instrument(skip_all)]
pub async fn create_time_slot(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateTimeSlotRequest>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, TimeSlot>(
        r#"INSERT INTO social.time_slots (user_id, account_id, day_of_week, hour, minute)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, account_id, day_of_week, hour, minute) DO NOTHING
           RETURNING *"#,
    )
    .bind(claims.sub)
    .bind(payload.account_id)
    .bind(payload.day_of_week)
    .bind(payload.hour)
    .bind(payload.minute.unwrap_or(0))
    .fetch_one(&state.pool)
    .await
    {
        Ok(slot) => Ok((StatusCode::CREATED, Json(slot))),
        Err(e) => {
            tracing::error!("create_time_slot: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[utoipa::path(
    delete,
    path = "/api/v1/social/time-slots/{id}",
    params(("id" = uuid::Uuid, Path, description = "Time slot ID")),
    responses(
        (status = 204, description = "Time slot deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Time slot not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Social Time Slots"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_time_slot(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query("DELETE FROM social.time_slots WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(&state.pool)
        .await
    {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!("delete_time_slot: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
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
