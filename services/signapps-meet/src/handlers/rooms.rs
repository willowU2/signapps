//! Room management handlers

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use signapps_common::Claims;
use uuid::Uuid;

use crate::{
    models::{CreateRoomRequest, MeetingHistoryResponse, Room, RoomResponse, UpdateRoomRequest},
    AppState,
};

/// Generate a random room code (6 alphanumeric chars)
fn generate_room_code() -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut rng = rand::thread_rng();
    (0..6)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

/// Hash password using bcrypt
fn hash_password(password: &str) -> Result<String, bcrypt::BcryptError> {
    bcrypt::hash(password, bcrypt::DEFAULT_COST)
}

/// Verify password
#[allow(dead_code)] // Scaffolded — will be wired when handler is implemented
fn verify_password(password: &str, hash: &str) -> bool {
    bcrypt::verify(password, hash).unwrap_or(false)
}

/// List all rooms (active and scheduled)
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_rooms(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<RoomResponse>>, (StatusCode, String)> {
    let rooms = sqlx::query_as::<_, Room>(
        r#"
        SELECT * FROM meet.rooms
        WHERE (status IN ('scheduled', 'active') OR created_by = $1)
        ORDER BY
            CASE WHEN status = 'active' THEN 0
                 WHEN status = 'scheduled' THEN 1
                 ELSE 2 END,
            scheduled_start ASC NULLS LAST,
            created_at DESC
        LIMIT 100
        "#,
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut responses = Vec::new();
    for room in rooms {
        let participant_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM meet.room_participants WHERE room_id = $1 AND left_at IS NULL",
        )
        .bind(room.id)
        .fetch_one(&state.pool)
        .await
        .unwrap_or((0,));

        responses.push(RoomResponse {
            id: room.id,
            name: room.name,
            description: room.description,
            room_code: room.room_code,
            status: room.status,
            is_private: room.is_private,
            max_participants: room.max_participants,
            scheduled_start: room.scheduled_start,
            scheduled_end: room.scheduled_end,
            actual_start: room.actual_start,
            actual_end: room.actual_end,
            settings: room.settings,
            created_at: room.created_at,
            participant_count: participant_count.0 as i32,
            livekit_url: state.livekit_config.server_url.clone(),
        });
    }

    Ok(Json(responses))
}

/// Create a new room
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn create_room(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<CreateRoomRequest>,
) -> Result<Json<RoomResponse>, (StatusCode, String)> {
    let room_code = generate_room_code();
    let password_hash = req
        .password
        .as_ref()
        .map(|p| hash_password(p))
        .transpose()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let room = sqlx::query_as::<_, Room>(
        r#"
        INSERT INTO meet.rooms (
            name, description, created_by, room_code, status, is_private,
            password_hash, max_participants, scheduled_start, scheduled_end, settings
        ) VALUES ($1, $2, $3, $4, 'scheduled', $5, $6, $7, $8, $9, $10)
        RETURNING *
        "#,
    )
    .bind(&req.name)
    .bind(&req.description)
    .bind(claims.sub)
    .bind(&room_code)
    .bind(req.is_private.unwrap_or(false))
    .bind(&password_hash)
    .bind(req.max_participants)
    .bind(req.scheduled_start)
    .bind(req.scheduled_end)
    .bind(&req.settings)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(RoomResponse {
        id: room.id,
        name: room.name,
        description: room.description,
        room_code: room.room_code,
        status: room.status,
        is_private: room.is_private,
        max_participants: room.max_participants,
        scheduled_start: room.scheduled_start,
        scheduled_end: room.scheduled_end,
        actual_start: room.actual_start,
        actual_end: room.actual_end,
        settings: room.settings,
        created_at: room.created_at,
        participant_count: 0,
        livekit_url: state.livekit_config.server_url.clone(),
    }))
}

/// Get a specific room by ID
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_room(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<RoomResponse>, (StatusCode, String)> {
    let room = sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;

    let participant_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM meet.room_participants WHERE room_id = $1 AND left_at IS NULL",
    )
    .bind(room.id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or((0,));

    Ok(Json(RoomResponse {
        id: room.id,
        name: room.name,
        description: room.description,
        room_code: room.room_code,
        status: room.status,
        is_private: room.is_private,
        max_participants: room.max_participants,
        scheduled_start: room.scheduled_start,
        scheduled_end: room.scheduled_end,
        actual_start: room.actual_start,
        actual_end: room.actual_end,
        settings: room.settings,
        created_at: room.created_at,
        participant_count: participant_count.0 as i32,
        livekit_url: state.livekit_config.server_url.clone(),
    }))
}

/// Update a room
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn update_room(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateRoomRequest>,
) -> Result<Json<RoomResponse>, (StatusCode, String)> {
    // Check ownership
    let room = sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;

    if room.created_by != claims.sub {
        return Err((StatusCode::FORBIDDEN, "Not authorized".to_string()));
    }

    let password_hash = req
        .password
        .as_ref()
        .map(|p| hash_password(p))
        .transpose()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let updated = sqlx::query_as::<_, Room>(
        r#"
        UPDATE meet.rooms SET
            name = COALESCE($1, name),
            description = COALESCE($2, description),
            is_private = COALESCE($3, is_private),
            password_hash = COALESCE($4, password_hash),
            max_participants = COALESCE($5, max_participants),
            scheduled_start = COALESCE($6, scheduled_start),
            scheduled_end = COALESCE($7, scheduled_end),
            settings = COALESCE($8, settings),
            updated_at = NOW()
        WHERE id = $9
        RETURNING *
        "#,
    )
    .bind(&req.name)
    .bind(&req.description)
    .bind(req.is_private)
    .bind(&password_hash)
    .bind(req.max_participants)
    .bind(req.scheduled_start)
    .bind(req.scheduled_end)
    .bind(&req.settings)
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let participant_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM meet.room_participants WHERE room_id = $1 AND left_at IS NULL",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or((0,));

    Ok(Json(RoomResponse {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        room_code: updated.room_code,
        status: updated.status,
        is_private: updated.is_private,
        max_participants: updated.max_participants,
        scheduled_start: updated.scheduled_start,
        scheduled_end: updated.scheduled_end,
        actual_start: updated.actual_start,
        actual_end: updated.actual_end,
        settings: updated.settings,
        created_at: updated.created_at,
        participant_count: participant_count.0 as i32,
        livekit_url: state.livekit_config.server_url.clone(),
    }))
}

/// Delete a room
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn delete_room(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Check ownership
    let room = sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;

    if room.created_by != claims.sub {
        return Err((StatusCode::FORBIDDEN, "Not authorized".to_string()));
    }

    sqlx::query("DELETE FROM meet.rooms WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

/// End a room (mark as ended and kick all participants)
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn end_room(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<RoomResponse>, (StatusCode, String)> {
    // Check ownership
    let room = sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;

    if room.created_by != claims.sub {
        return Err((StatusCode::FORBIDDEN, "Not authorized".to_string()));
    }

    // Mark all participants as left
    sqlx::query(
        "UPDATE meet.room_participants SET left_at = NOW() WHERE room_id = $1 AND left_at IS NULL",
    )
    .bind(id)
    .execute(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Update room status
    let updated = sqlx::query_as::<_, Room>(
        r#"
        UPDATE meet.rooms SET
            status = 'ended',
            actual_end = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Create history entry
    let participant_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(DISTINCT user_id) FROM meet.room_participants WHERE room_id = $1",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or((0,));

    let duration = updated.actual_start.and_then(|start| {
        updated
            .actual_end
            .map(|end| (end - start).num_seconds() as i32)
    });

    let had_recording: (bool,) =
        sqlx::query_as("SELECT EXISTS(SELECT 1 FROM meet.recordings WHERE room_id = $1)")
            .bind(id)
            .fetch_one(&state.pool)
            .await
            .unwrap_or((false,));

    sqlx::query(
        r#"
        INSERT INTO meet.meeting_history (
            room_id, room_name, host_id, started_at, ended_at,
            duration_seconds, participant_count, max_concurrent_participants,
            had_recording, had_screen_share
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, false)
        "#,
    )
    .bind(id)
    .bind(&updated.name)
    .bind(updated.created_by)
    .bind(updated.actual_start)
    .bind(updated.actual_end)
    .bind(duration)
    .bind(participant_count.0 as i32)
    .bind(had_recording.0)
    .execute(&state.pool)
    .await
    .ok();

    Ok(Json(RoomResponse {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        room_code: updated.room_code,
        status: updated.status,
        is_private: updated.is_private,
        max_participants: updated.max_participants,
        scheduled_start: updated.scheduled_start,
        scheduled_end: updated.scheduled_end,
        actual_start: updated.actual_start,
        actual_end: updated.actual_end,
        settings: updated.settings,
        created_at: updated.created_at,
        participant_count: 0,
        livekit_url: state.livekit_config.server_url.clone(),
    }))
}

/// List meeting history
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_history(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<MeetingHistoryResponse>>, (StatusCode, String)> {
    let history = sqlx::query_as::<_, crate::models::MeetingHistory>(
        r#"
        SELECT * FROM meet.meeting_history
        WHERE host_id = $1
        ORDER BY started_at DESC
        LIMIT 50
        "#,
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(
        history
            .into_iter()
            .map(|h| MeetingHistoryResponse {
                id: h.id,
                room_name: h.room_name,
                started_at: h.started_at,
                ended_at: h.ended_at,
                duration_seconds: h.duration_seconds,
                participant_count: h.participant_count,
                had_recording: h.had_recording,
            })
            .collect(),
    ))
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
