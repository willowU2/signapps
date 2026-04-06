//! Channel CRUD handlers (DB-backed).

use crate::state::AppState;
use crate::types::{Channel, CreateChannelRequest};
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use signapps_common::Claims;
use uuid::Uuid;

/// List channels visible to the current user (created by or member of).
pub async fn list_channels(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, Channel>(
        "SELECT id, name, topic, is_private, created_by, created_at, updated_at \
         FROM chat.channels \
         WHERE created_by = $1 \
            OR id IN (SELECT channel_id FROM chat.channel_members WHERE user_id = $1) \
         ORDER BY created_at ASC",
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await
    {
        Ok(channels) => (
            StatusCode::OK,
            Json(serde_json::to_value(channels).unwrap_or_default()),
        ),
        Err(e) => {
            tracing::error!("list_channels DB error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
        },
    }
}

/// Get a single channel by ID.
///
/// Only the creator or a member can view the channel.
pub async fn get_channel(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, Channel>(
        "SELECT id, name, topic, is_private, created_by, created_at, updated_at \
         FROM chat.channels \
         WHERE id = $1 \
           AND (created_by = $2 \
                OR id IN (SELECT channel_id FROM chat.channel_members WHERE user_id = $2))",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(channel)) => (
            StatusCode::OK,
            Json(serde_json::to_value(channel).unwrap_or_default()),
        ),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Channel not found" })),
        ),
        Err(e) => {
            tracing::error!("get_channel DB error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
        },
    }
}

/// Create a new channel.
pub async fn create_channel(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateChannelRequest>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, Channel>(
        r#"
        INSERT INTO chat.channels (name, topic, is_private, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, topic, is_private, created_by, created_at, updated_at
        "#,
    )
    .bind(&payload.name)
    .bind(&payload.topic)
    .bind(payload.is_private.unwrap_or(false))
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await
    {
        Ok(channel) => {
            tracing::info!(id = %channel.id, name = %channel.name, "Channel created");
            (
                StatusCode::CREATED,
                Json(serde_json::to_value(channel).unwrap_or_default()),
            )
        },
        Err(e) => {
            tracing::error!("create_channel DB error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to create channel" })),
            )
        },
    }
}

/// Update an existing channel.
///
/// Only the channel creator can update it.
pub async fn update_channel(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateChannelRequest>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, Channel>(
        r#"
        UPDATE chat.channels
        SET name = $1,
            topic = COALESCE($2, topic),
            is_private = COALESCE($3, is_private),
            updated_at = NOW()
        WHERE id = $4 AND created_by = $5
        RETURNING id, name, topic, is_private, created_by, created_at, updated_at
        "#,
    )
    .bind(&payload.name)
    .bind(&payload.topic)
    .bind(payload.is_private)
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(channel)) => {
            tracing::info!(id = %id, "Channel updated");
            (
                StatusCode::OK,
                Json(serde_json::to_value(channel).unwrap_or_default()),
            )
        },
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Channel not found or not owned by user" })),
        ),
        Err(e) => {
            tracing::error!("update_channel DB error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
        },
    }
}

/// Delete a channel.
///
/// Only the channel creator can delete it.
pub async fn delete_channel(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query("DELETE FROM chat.channels WHERE id = $1 AND created_by = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(&state.pool)
        .await
    {
        Ok(r) if r.rows_affected() > 0 => {
            tracing::info!(id = %id, "Channel deleted");
            (StatusCode::NO_CONTENT, Json(serde_json::json!({})))
        },
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Channel not found or not owned by user" })),
        ),
        Err(e) => {
            tracing::error!("delete_channel DB error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
        },
    }
}
