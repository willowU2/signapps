//! Message handlers: list, send, edit, delete, and file upload (DB-backed).

use crate::state::{broadcast, AppState};
use crate::types::{Attachment, ChatMessage, EditMessageRequest, MessageRow, SendMessageRequest};
use axum::{
    extract::{Extension, Multipart, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use signapps_common::pg_events::NewEvent;
use signapps_common::Claims;
use uuid::Uuid;

/// List all messages in a channel.
///
/// Requires the caller to be the channel creator or a member — previously
/// any authenticated user could read any channel's history.
pub async fn list_messages(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(channel_id): Path<Uuid>,
) -> impl IntoResponse {
    // Verify channel exists AND caller is creator-or-member (same visibility
    // rule as get_channel).
    match sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS( \
            SELECT 1 FROM chat.channels \
            WHERE id = $1 \
              AND (created_by = $2 \
                   OR id IN (SELECT channel_id FROM chat.channel_members WHERE user_id = $2)) \
         )",
    )
    .bind(channel_id)
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await
    {
        Ok(false) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Channel not found" })),
            )
        },
        Err(e) => {
            tracing::error!("list_messages channel check error: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            );
        },
        Ok(true) => {},
    }

    match sqlx::query_as::<_, MessageRow>(
        "SELECT id, channel_id, user_id, username, content, parent_id, \
                reactions, attachment, is_pinned, created_at, updated_at \
         FROM chat.messages WHERE channel_id = $1 ORDER BY created_at ASC",
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
            tracing::error!("list_messages DB error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
        },
    }
}

/// Send a message to a channel.
pub async fn send_message(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(channel_id): Path<Uuid>,
    Json(payload): Json<SendMessageRequest>,
) -> impl IntoResponse {
    // Verify channel exists
    match sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM chat.channels WHERE id = $1)")
        .bind(channel_id)
        .fetch_one(&state.pool)
        .await
    {
        Ok(false) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Channel not found" })),
            )
        },
        Err(e) => {
            tracing::error!("send_message channel check error: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            );
        },
        Ok(true) => {},
    }

    match sqlx::query_as::<_, MessageRow>(
        r#"
        INSERT INTO chat.messages (channel_id, user_id, username, content, parent_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, channel_id, user_id, username, content, parent_id,
                  reactions, attachment, is_pinned, created_at, updated_at
        "#,
    )
    .bind(channel_id)
    .bind(claims.sub)
    .bind(&claims.username)
    .bind(&payload.content)
    .bind(payload.parent_id)
    .fetch_one(&state.pool)
    .await
    {
        Ok(row) => {
            let msg = ChatMessage::from(row);
            tracing::info!(id = %msg.id, channel = %channel_id, "Message sent");
            // Broadcast with the shape expected by the frontend WS handler:
            // { type: "new_message", message: <ChatMessage> }
            broadcast(&state, "new_message", serde_json::json!({ "message": msg }));
            let _ = state
                .event_bus
                .publish(NewEvent {
                    event_type: "chat.message.created".into(),
                    aggregate_id: Some(msg.id),
                    payload: serde_json::json!({
                        "channel_id": channel_id,
                        "user_id": claims.sub,
                    }),
                })
                .await;
            (
                StatusCode::CREATED,
                Json(serde_json::to_value(&msg).unwrap_or_default()),
            )
        },
        Err(e) => {
            tracing::error!("send_message DB error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to save message" })),
            )
        },
    }
}

/// Edit a message (own messages only; falls back to DM in-memory).
pub async fn edit_message(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((channel_id, message_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<EditMessageRequest>,
) -> impl IntoResponse {
    if payload.content.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Content cannot be empty" })),
        );
    }

    // Try DB-backed channel messages first (only own messages)
    let result = sqlx::query_as::<_, MessageRow>(
        r#"
        UPDATE chat.messages
        SET content = $1, updated_at = NOW()
        WHERE id = $2 AND channel_id = $3 AND user_id = $4
        RETURNING id, channel_id, user_id, username, content, parent_id,
                  reactions, attachment, is_pinned, created_at, updated_at
        "#,
    )
    .bind(&payload.content)
    .bind(message_id)
    .bind(channel_id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await;

    match result {
        Ok(Some(row)) => {
            let msg = ChatMessage::from(row);
            broadcast(
                &state,
                "message_edited",
                serde_json::json!({ "message": msg }),
            );
            return (
                StatusCode::OK,
                Json(serde_json::to_value(&msg).unwrap_or_default()),
            );
        },
        Ok(None) => {},
        Err(e) => {
            tracing::error!("edit_message DB error: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            );
        },
    }

    // Try DM in-memory
    for mut entry in state.dm_messages.iter_mut() {
        if let Some(msg) = entry
            .value_mut()
            .iter_mut()
            .find(|m| m.id == message_id && m.user_id == claims.sub)
        {
            msg.content = payload.content.clone();
            msg.updated_at = Utc::now().to_rfc3339();
            let val = serde_json::to_value(msg.clone()).unwrap_or_default();
            broadcast(
                &state,
                "message_edited",
                serde_json::json!({ "message": msg.clone() }),
            );
            return (StatusCode::OK, Json(val));
        }
    }

    (
        StatusCode::NOT_FOUND,
        Json(serde_json::json!({ "error": "Message not found or not yours" })),
    )
}

/// Delete a message (own messages only; falls back to DM in-memory).
pub async fn delete_message(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((channel_id, message_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    // Try DB-backed channel messages first (only own messages)
    let result =
        sqlx::query("DELETE FROM chat.messages WHERE id = $1 AND channel_id = $2 AND user_id = $3")
            .bind(message_id)
            .bind(channel_id)
            .bind(claims.sub)
            .execute(&state.pool)
            .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            tracing::info!(id = %message_id, channel = %channel_id, "Message deleted");
            // Broadcast with shape expected by frontend: { type: "message_deleted", message_id }
            broadcast(
                &state,
                "message_deleted",
                serde_json::json!({ "message_id": message_id, "channel_id": channel_id }),
            );
            return (StatusCode::NO_CONTENT, Json(serde_json::json!({})));
        },
        Ok(_) => {},
        Err(e) => {
            tracing::error!("delete_message DB error: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            );
        },
    }

    // Try DM in-memory
    for mut entry in state.dm_messages.iter_mut() {
        let msgs = entry.value_mut();
        if let Some(pos) = msgs
            .iter()
            .position(|m| m.id == message_id && m.user_id == claims.sub)
        {
            msgs.remove(pos);
            broadcast(
                &state,
                "message_deleted",
                serde_json::json!({ "message_id": message_id }),
            );
            return (StatusCode::NO_CONTENT, Json(serde_json::json!({})));
        }
    }

    (
        StatusCode::NOT_FOUND,
        Json(serde_json::json!({ "error": "Message not found or not yours" })),
    )
}

/// Upload a file attachment to a channel (IDEA-134).
pub async fn upload_file(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(channel_id): Path<Uuid>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let mut filename = String::from("file");
    let mut content_type = String::from("application/octet-stream");
    let mut size: u64 = 0;

    while let Ok(Some(field)) = multipart.next_field().await {
        if let Some(name) = field.file_name() {
            filename = name.to_string();
        }
        if let Some(ct) = field.content_type() {
            content_type = ct.to_string();
        }
        if let Ok(bytes) = field.bytes().await {
            size = bytes.len() as u64;
        }
    }

    // In a real implementation this would upload to signapps-storage
    let attachment = Attachment {
        url: format!("/api/v1/channels/{}/files/{}", channel_id, Uuid::new_v4()),
        filename,
        content_type,
        size,
    };

    (
        StatusCode::CREATED,
        Json(serde_json::to_value(attachment).unwrap_or_default()),
    )
}
