//! Participant management handlers

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use signapps_common::middleware::Claims;
use uuid::Uuid;

use crate::{
    models::{MuteRequest, ParticipantResponse, Room, RoomParticipant},
    AppState,
};

/// List participants in a room
pub async fn list_participants(
    State(state): State<AppState>,
    Path(room_id): Path<Uuid>,
) -> Result<Json<Vec<ParticipantResponse>>, (StatusCode, String)> {
    // Check room exists
    let _room = sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;

    let participants = sqlx::query_as::<_, RoomParticipant>(
        r#"
        SELECT * FROM meet.room_participants
        WHERE room_id = $1 AND left_at IS NULL
        ORDER BY joined_at ASC
        "#,
    )
    .bind(room_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(
        participants
            .into_iter()
            .map(|p| ParticipantResponse {
                id: p.id,
                user_id: p.user_id,
                display_name: p.display_name,
                role: p.role,
                joined_at: p.joined_at,
                is_muted: p.is_muted,
                is_video_off: p.is_video_off,
                is_screen_sharing: p.is_screen_sharing,
            })
            .collect(),
    ))
}

/// Kick a participant from a room
pub async fn kick_participant(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((room_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Check room exists and user is host
    let room = sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;

    // Check if caller is host or moderator
    let caller_participant = sqlx::query_as::<_, RoomParticipant>(
        "SELECT * FROM meet.room_participants WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL",
    )
    .bind(room_id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let is_host = room.created_by == claims.sub;
    let is_moderator = caller_participant
        .as_ref()
        .map(|p| p.role == "moderator")
        .unwrap_or(false);

    if !is_host && !is_moderator {
        return Err((
            StatusCode::FORBIDDEN,
            "Only host or moderator can kick participants".to_string(),
        ));
    }

    // Can't kick the host
    if user_id == room.created_by {
        return Err((StatusCode::FORBIDDEN, "Cannot kick the host".to_string()));
    }

    // Mark participant as left
    let result = sqlx::query(
        "UPDATE meet.room_participants SET left_at = NOW() WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL",
    )
    .bind(room_id)
    .bind(user_id)
    .execute(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Participant not found".to_string()));
    }

    // In a real implementation, we would also send a signal to LiveKit
    // to remove the participant from the room

    Ok(StatusCode::NO_CONTENT)
}

/// Mute/unmute a participant
pub async fn mute_participant(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((room_id, user_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<MuteRequest>,
) -> Result<Json<ParticipantResponse>, (StatusCode, String)> {
    // Check room exists
    let room = sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;

    // Check if caller is host, moderator, or the participant themselves
    let is_host = room.created_by == claims.sub;
    let is_self = user_id == claims.sub;

    let caller_participant = sqlx::query_as::<_, RoomParticipant>(
        "SELECT * FROM meet.room_participants WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL",
    )
    .bind(room_id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let is_moderator = caller_participant
        .as_ref()
        .map(|p| p.role == "moderator")
        .unwrap_or(false);

    if !is_host && !is_moderator && !is_self {
        return Err((
            StatusCode::FORBIDDEN,
            "Only host, moderator, or self can mute/unmute".to_string(),
        ));
    }

    // Update participant state
    let updated = sqlx::query_as::<_, RoomParticipant>(
        r#"
        UPDATE meet.room_participants SET
            is_muted = COALESCE($1, is_muted),
            is_video_off = COALESCE($2, is_video_off)
        WHERE room_id = $3 AND user_id = $4 AND left_at IS NULL
        RETURNING *
        "#,
    )
    .bind(req.audio)
    .bind(req.video)
    .bind(room_id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Participant not found".to_string()))?;

    // In a real implementation, we would also send a signal to LiveKit
    // to mute the participant's tracks

    Ok(Json(ParticipantResponse {
        id: updated.id,
        user_id: updated.user_id,
        display_name: updated.display_name,
        role: updated.role,
        joined_at: updated.joined_at,
        is_muted: updated.is_muted,
        is_video_off: updated.is_video_off,
        is_screen_sharing: updated.is_screen_sharing,
    }))
}
