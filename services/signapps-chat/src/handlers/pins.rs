//! Pin/unpin message handlers (IDEA-132, DB-backed).

use crate::state::{broadcast, AppState};
use crate::types::{ChatMessage, MessageRow};
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use signapps_common::Claims;
use uuid::Uuid;

/// Pin a message in a channel.
pub async fn pin_message(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path((channel_id, message_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    match sqlx::query(
        "UPDATE chat.messages SET is_pinned = true, updated_at = NOW() \
         WHERE id = $1 AND channel_id = $2",
    )
    .bind(message_id)
    .bind(channel_id)
    .execute(&state.pool)
    .await
    {
        Ok(r) if r.rows_affected() > 0 => {
            broadcast(
                &state,
                "message_pinned",
                serde_json::json!({
                    "channel_id": channel_id,
                    "message_id": message_id,
                }),
            );
            (
                StatusCode::OK,
                Json(serde_json::json!({ "status": "pinned" })),
            )
        },
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Message not found" })),
        ),
        Err(e) => {
            tracing::error!("pin_message DB error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
        },
    }
}

/// Unpin a message in a channel.
pub async fn unpin_message(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path((channel_id, message_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    match sqlx::query(
        "UPDATE chat.messages SET is_pinned = false, updated_at = NOW() \
         WHERE id = $1 AND channel_id = $2",
    )
    .bind(message_id)
    .bind(channel_id)
    .execute(&state.pool)
    .await
    {
        Ok(r) if r.rows_affected() > 0 => (
            StatusCode::OK,
            Json(serde_json::json!({ "status": "unpinned" })),
        ),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Message not found" })),
        ),
        Err(e) => {
            tracing::error!("unpin_message DB error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
        },
    }
}

/// List pinned messages in a channel.
pub async fn list_pinned(
    State(state): State<AppState>,
    Path(channel_id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, MessageRow>(
        "SELECT id, channel_id, user_id, username, content, parent_id, \
                reactions, attachment, is_pinned, created_at, updated_at \
         FROM chat.messages WHERE channel_id = $1 AND is_pinned = true \
         ORDER BY created_at ASC",
    )
    .bind(channel_id)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => {
            let msgs: Vec<ChatMessage> = rows.into_iter().map(ChatMessage::from).collect();
            (
                StatusCode::OK,
                Json(serde_json::to_value(msgs).unwrap_or_default()),
            )
        },
        Err(e) => {
            tracing::error!("list_pinned DB error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
        },
    }
}
