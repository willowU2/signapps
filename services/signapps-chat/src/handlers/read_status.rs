//! Read status and unread count handlers (IDEA-140, in-memory).

use crate::state::AppState;
use crate::types::ReadStatus;
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use signapps_common::Claims;
use uuid::Uuid;

/// Get read status for a channel.
pub async fn get_read_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(channel_id): Path<Uuid>,
) -> impl IntoResponse {
    let key = format!("{}:{}", channel_id, claims.sub);
    match state.read_status.get(&key) {
        Some(s) => (
            StatusCode::OK,
            Json(serde_json::to_value(s.clone()).unwrap_or_default()),
        ),
        None => {
            // Count unread from DB
            let msg_count: i64 =
                sqlx::query_scalar("SELECT COUNT(*) FROM chat.messages WHERE channel_id = $1")
                    .bind(channel_id)
                    .fetch_one(&state.pool)
                    .await
                    .unwrap_or(0);

            let status = ReadStatus {
                channel_id,
                user_id: claims.sub,
                unread_count: msg_count as u64,
                last_read_at: Utc::now().to_rfc3339(),
            };
            (
                StatusCode::OK,
                Json(serde_json::to_value(status).unwrap_or_default()),
            )
        },
    }
}

/// Mark all messages in a channel as read.
pub async fn mark_channel_read(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(channel_id): Path<Uuid>,
) -> impl IntoResponse {
    let key = format!("{}:{}", channel_id, claims.sub);
    let status = ReadStatus {
        channel_id,
        user_id: claims.sub,
        unread_count: 0,
        last_read_at: Utc::now().to_rfc3339(),
    };
    state.read_status.insert(key, status.clone());
    (
        StatusCode::OK,
        Json(serde_json::to_value(status).unwrap_or_default()),
    )
}

/// Get all unread counts for the authenticated user.
pub async fn get_all_unread(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let statuses: Vec<ReadStatus> = state
        .read_status
        .iter()
        .filter(|e| e.value().user_id == claims.sub)
        .map(|e| e.value().clone())
        .collect();
    Json(statuses)
}
