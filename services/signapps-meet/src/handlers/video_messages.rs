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

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
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

#[derive(Debug, serde::Deserialize)]
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
