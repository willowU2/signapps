//! Message search handler (IDEA-138, DB-backed).

use crate::state::AppState;
use crate::types::{ChatMessage, MessageRow, SearchQuery};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use uuid::Uuid;

/// Search messages in a channel by content.
pub async fn search_messages(
    State(state): State<AppState>,
    Path(channel_id): Path<Uuid>,
    Query(params): Query<SearchQuery>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, MessageRow>(
        "SELECT id, channel_id, user_id, username, content, parent_id, \
                reactions, attachment, is_pinned, created_at, updated_at \
         FROM chat.messages \
         WHERE channel_id = $1 AND content ILIKE $2 \
         ORDER BY created_at DESC \
         LIMIT 100",
    )
    .bind(channel_id)
    .bind(format!("%{}%", params.q))
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
            tracing::error!("search_messages DB error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
        },
    }
}
