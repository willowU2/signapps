//! Reaction handlers (IDEA-131, DB-backed with DM in-memory fallback).

use crate::state::{broadcast, AppState};
use crate::types::{AddReactionRequest, MessageRow};
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use signapps_common::Claims;
use uuid::Uuid;

/// Add an emoji reaction to a message.
pub async fn add_reaction(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(message_id): Path<Uuid>,
    Json(payload): Json<AddReactionRequest>,
) -> impl IntoResponse {
    // Try channel messages first
    let result = sqlx::query_as::<_, MessageRow>(
        r#"
        UPDATE chat.messages
        SET reactions = jsonb_set(
            reactions,
            ARRAY[$1],
            to_jsonb(COALESCE((reactions->$1)::int, 0) + 1)
        ),
        updated_at = NOW()
        WHERE id = $2
        RETURNING id, channel_id, user_id, username, content, parent_id,
                  reactions, attachment, is_pinned, created_at, updated_at
        "#,
    )
    .bind(&payload.emoji)
    .bind(message_id)
    .fetch_optional(&state.pool)
    .await;

    match result {
        Ok(Some(row)) => {
            broadcast(
                &state,
                "reaction_added",
                serde_json::json!({
                    "message_id": message_id,
                    "emoji": payload.emoji,
                    "user_id": claims.sub,
                    "count": row.reactions.get(&payload.emoji),
                }),
            );
            return (
                StatusCode::CREATED,
                Json(serde_json::json!({ "status": "ok" })),
            );
        },
        Ok(None) => {
            // Message not in DB channel messages — fall through to DM in-memory
        },
        Err(e) => {
            tracing::error!("add_reaction DB error: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            );
        },
    }

    // Check DM messages (still in-memory)
    for mut entry in state.dm_messages.iter_mut() {
        if let Some(msg) = entry.value_mut().iter_mut().find(|m| m.id == message_id) {
            if !msg.reactions.is_object() {
                msg.reactions = serde_json::json!({});
            }
            if let Some(reactions) = msg.reactions.as_object_mut() {
                let count = reactions
                    .entry(payload.emoji.clone())
                    .or_insert(serde_json::json!(0));
                *count = serde_json::json!(count.as_u64().unwrap_or(0) + 1);
            }
            msg.updated_at = Utc::now().to_rfc3339();
            return (
                StatusCode::CREATED,
                Json(serde_json::json!({ "status": "ok" })),
            );
        }
    }

    (
        StatusCode::NOT_FOUND,
        Json(serde_json::json!({ "error": "Message not found" })),
    )
}
