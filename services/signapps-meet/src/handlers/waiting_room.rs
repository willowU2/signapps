//! Waiting room management handlers

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;
use sqlx::FromRow;
use uuid::Uuid;

use crate::{models::Room, AppState};

/// A waiting room entry
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
/// WaitingRoomEntry data transfer object.
pub struct WaitingRoomEntry {
    pub id: Uuid,
    pub room_id: Uuid,
    pub user_id: Option<Uuid>,
    pub display_name: String,
    pub status: String, // "waiting", "admitted", "denied"
    pub requested_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
/// Response for WaitingRoom.
pub struct WaitingRoomResponse {
    pub id: Uuid,
    pub room_id: Uuid,
    pub user_id: Option<Uuid>,
    pub display_name: String,
    pub status: String,
    pub requested_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
}

impl From<WaitingRoomEntry> for WaitingRoomResponse {
    fn from(e: WaitingRoomEntry) -> Self {
        Self {
            id: e.id,
            room_id: e.room_id,
            user_id: e.user_id,
            display_name: e.display_name,
            status: e.status,
            requested_at: e.requested_at,
            resolved_at: e.resolved_at,
        }
    }
}

/// List users in the waiting room for a given room (host only)
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/waiting_room",
    responses((status = 200, description = "Success")),
    tag = "Meet"
)]
#[tracing::instrument(skip_all)]
pub async fn list_waiting(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(room_id): Path<Uuid>,
) -> Result<Json<Vec<WaitingRoomResponse>>, (StatusCode, String)> {
    let room = sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;

    if room.created_by != claims.sub {
        return Err((
            StatusCode::FORBIDDEN,
            "Only host can view the waiting room".to_string(),
        ));
    }

    let entries = sqlx::query_as::<_, WaitingRoomEntry>(
        r#"
        SELECT id, room_id, user_id, display_name, status, requested_at, resolved_at
        FROM meet.waiting_room
        WHERE room_id = $1 AND status = 'waiting'
        ORDER BY requested_at ASC
        "#,
    )
    .bind(room_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(entries.into_iter().map(Into::into).collect()))
}

/// Admit a user from the waiting room (host only)
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/waiting_room",
    responses((status = 200, description = "Success")),
    tag = "Meet"
)]
#[tracing::instrument(skip_all)]
pub async fn admit_user(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((room_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<WaitingRoomResponse>, (StatusCode, String)> {
    let room = sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;

    if room.created_by != claims.sub {
        return Err((
            StatusCode::FORBIDDEN,
            "Only host can admit users".to_string(),
        ));
    }

    let updated = sqlx::query_as::<_, WaitingRoomEntry>(
        r#"
        UPDATE meet.waiting_room
        SET status = 'admitted', resolved_at = NOW()
        WHERE room_id = $1 AND user_id = $2 AND status = 'waiting'
        RETURNING id, room_id, user_id, display_name, status, requested_at, resolved_at
        "#,
    )
    .bind(room_id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((
        StatusCode::NOT_FOUND,
        "User not found in waiting room".to_string(),
    ))?;

    Ok(Json(updated.into()))
}

/// Deny a user from the waiting room (host only)
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/waiting_room",
    responses((status = 200, description = "Success")),
    tag = "Meet"
)]
#[tracing::instrument(skip_all)]
pub async fn deny_user(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((room_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<WaitingRoomResponse>, (StatusCode, String)> {
    let room = sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;

    if room.created_by != claims.sub {
        return Err((
            StatusCode::FORBIDDEN,
            "Only host can deny users".to_string(),
        ));
    }

    let updated = sqlx::query_as::<_, WaitingRoomEntry>(
        r#"
        UPDATE meet.waiting_room
        SET status = 'denied', resolved_at = NOW()
        WHERE room_id = $1 AND user_id = $2 AND status = 'waiting'
        RETURNING id, room_id, user_id, display_name, status, requested_at, resolved_at
        "#,
    )
    .bind(room_id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((
        StatusCode::NOT_FOUND,
        "User not found in waiting room".to_string(),
    ))?;

    Ok(Json(updated.into()))
}

/// DTO for joining the waiting room (called by the participant themselves)
#[derive(Debug, Deserialize)]
/// Request body for JoinWaitingRoom.
pub struct JoinWaitingRoomRequest {
    pub display_name: String,
}

/// Join the waiting room (called by the participant)
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/waiting_room",
    responses((status = 200, description = "Success")),
    tag = "Meet"
)]
#[tracing::instrument(skip_all)]
pub async fn join_waiting_room(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(room_id): Path<Uuid>,
    Json(req): Json<JoinWaitingRoomRequest>,
) -> Result<Json<WaitingRoomResponse>, (StatusCode, String)> {
    let _room = sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;

    let entry = sqlx::query_as::<_, WaitingRoomEntry>(
        r#"
        INSERT INTO meet.waiting_room (room_id, user_id, display_name, status)
        VALUES ($1, $2, $3, 'waiting')
        ON CONFLICT (room_id, user_id) DO UPDATE
            SET status = 'waiting', requested_at = NOW(), resolved_at = NULL
        RETURNING id, room_id, user_id, display_name, status, requested_at, resolved_at
        "#,
    )
    .bind(room_id)
    .bind(claims.sub)
    .bind(&req.display_name)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(entry.into()))
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
