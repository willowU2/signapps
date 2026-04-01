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
/// VideoMessage data transfer object.
pub struct VideoMessage {
    pub id: Uuid,
    pub sender_id: Uuid,
    pub recipient_id: Uuid,
    pub duration_seconds: Option<i32>,
    pub thumbnail_url: Option<String>,
    pub video_storage_key: Option<String>,
    pub is_read: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, serde::Deserialize, utoipa::ToSchema)]
/// Request body for CreateVideoMessage.
pub struct CreateVideoMessageRequest {
    pub recipient_id: Uuid,
    pub duration_seconds: Option<i32>,
    pub thumbnail_url: Option<String>,
    pub video_storage_key: Option<String>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// List video messages for the authenticated user
#[utoipa::path(
    get,
    path = "/api/v1/meet/video-messages",
    responses(
        (status = 200, description = "List of video messages", body = Vec<VideoMessage>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_video_messages(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, VideoMessage>(
        "SELECT id, sender_id, recipient_id, duration_seconds,
                thumbnail_url, video_storage_key, is_read, created_at
         FROM meet.video_messages
         WHERE sender_id = $1 OR recipient_id = $1
         ORDER BY created_at DESC
         LIMIT 200",
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => (StatusCode::OK, Json(serde_json::json!(rows))),
        Err(e) => {
            tracing::error!("list_video_messages: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

/// Create a new video message
#[utoipa::path(
    post,
    path = "/api/v1/meet/video-messages",
    request_body = CreateVideoMessageRequest,
    responses(
        (status = 201, description = "Video message created", body = VideoMessage),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn create_video_message(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateVideoMessageRequest>,
) -> impl IntoResponse {
    let id = Uuid::new_v4();
    let now = Utc::now();

    match sqlx::query_as::<_, VideoMessage>(
        "INSERT INTO meet.video_messages
            (id, sender_id, recipient_id, duration_seconds, thumbnail_url,
             video_storage_key, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, false, $7)
         RETURNING id, sender_id, recipient_id, duration_seconds,
                   thumbnail_url, video_storage_key, is_read, created_at",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(payload.recipient_id)
    .bind(payload.duration_seconds)
    .bind(&payload.thumbnail_url)
    .bind(&payload.video_storage_key)
    .bind(now)
    .fetch_one(&state.pool)
    .await
    {
        Ok(row) => (StatusCode::CREATED, Json(serde_json::json!(row))),
        Err(e) => {
            tracing::error!("create_video_message: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

/// Mark a video message as read
#[utoipa::path(
    post,
    path = "/api/v1/meet/video-messages/{id}/read",
    params(("id" = Uuid, Path, description = "Video message ID")),
    responses(
        (status = 200, description = "Video message marked as read"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Video message not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn mark_video_message_read(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    // Only the recipient can mark as read
    match sqlx::query(
        "UPDATE meet.video_messages SET is_read = true WHERE id = $1 AND recipient_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&state.pool)
    .await
    {
        Ok(r) if r.rows_affected() > 0 => (
            StatusCode::OK,
            Json(serde_json::json!({ "message": "Video message marked as read" })),
        ),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Video message not found" })),
        ),
        Err(e) => {
            tracing::error!("mark_video_message_read: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

/// Delete a video message
#[utoipa::path(
    delete,
    path = "/api/v1/meet/video-messages/{id}",
    params(("id" = Uuid, Path, description = "Video message ID")),
    responses(
        (status = 204, description = "Video message deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Video message not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn delete_video_message(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> StatusCode {
    // Sender or recipient can delete
    match sqlx::query(
        "DELETE FROM meet.video_messages WHERE id = $1 AND (sender_id = $2 OR recipient_id = $2)",
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&state.pool)
    .await
    {
        Ok(r) if r.rows_affected() > 0 => StatusCode::NO_CONTENT,
        Ok(_) => StatusCode::NOT_FOUND,
        Err(e) => {
            tracing::error!("delete_video_message: {e}");
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
