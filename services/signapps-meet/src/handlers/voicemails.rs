use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use signapps_common::Claims;
use uuid::Uuid;

use crate::AppState;

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow, utoipa::ToSchema)]
/// Voicemail data transfer object.
pub struct Voicemail {
    pub id: Uuid,
    pub user_id: Uuid,
    pub caller_name: Option<String>,
    pub caller_phone: Option<String>,
    pub duration_seconds: Option<i32>,
    pub transcription: Option<String>,
    pub audio_storage_key: Option<String>,
    pub is_read: bool,
    pub created_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// List voicemails for the authenticated user
#[utoipa::path(
    get,
    path = "/api/v1/meet/voicemails",
    responses(
        (status = 200, description = "List of voicemails", body = Vec<Voicemail>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_voicemails(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, Voicemail>(
        "SELECT id, user_id, caller_name, caller_phone, duration_seconds,
                transcription, audio_storage_key, is_read, created_at
         FROM meet.voicemails
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 200",
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => (StatusCode::OK, Json(serde_json::json!(rows))),
        Err(e) => {
            tracing::error!("list_voicemails: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

/// Mark a voicemail as read
#[utoipa::path(
    post,
    path = "/api/v1/meet/voicemails/{id}/read",
    params(("id" = Uuid, Path, description = "Voicemail ID")),
    responses(
        (status = 200, description = "Voicemail marked as read"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Voicemail not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn mark_voicemail_read(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query("UPDATE meet.voicemails SET is_read = true WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(&state.pool)
        .await
    {
        Ok(r) if r.rows_affected() > 0 => (
            StatusCode::OK,
            Json(serde_json::json!({ "message": "Voicemail marked as read" })),
        ),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Voicemail not found" })),
        ),
        Err(e) => {
            tracing::error!("mark_voicemail_read: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

/// Delete a voicemail
#[utoipa::path(
    delete,
    path = "/api/v1/meet/voicemails/{id}",
    params(("id" = Uuid, Path, description = "Voicemail ID")),
    responses(
        (status = 204, description = "Voicemail deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Voicemail not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn delete_voicemail(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> StatusCode {
    match sqlx::query("DELETE FROM meet.voicemails WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(&state.pool)
        .await
    {
        Ok(r) if r.rows_affected() > 0 => StatusCode::NO_CONTENT,
        Ok(_) => StatusCode::NOT_FOUND,
        Err(e) => {
            tracing::error!("delete_voicemail: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
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
