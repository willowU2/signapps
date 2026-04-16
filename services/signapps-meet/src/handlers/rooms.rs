//! Room management handlers

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use serde::Serialize;
use signapps_common::Claims;
use signapps_livekit_client::{RoomOptions, TokenGrants};
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

/// Generate a random 6-digit numeric code (used by instant rooms).
fn generate_numeric_code() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    format!("{:06}", rng.gen_range(0..1_000_000u32))
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
#[utoipa::path(
    get,
    path = "/api/v1/meet/rooms",
    responses(
        (status = 200, description = "List of rooms", body = Vec<RoomResponse>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
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
            livekit_url: state.livekit.base_url.clone(),
        });
    }

    Ok(Json(responses))
}

/// Create a new room
#[utoipa::path(
    post,
    path = "/api/v1/meet/rooms",
    request_body = CreateRoomRequest,
    responses(
        (status = 200, description = "Room created", body = RoomResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
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
        livekit_url: state.livekit.base_url.clone(),
    }))
}

/// Get a specific room by ID
#[utoipa::path(
    get,
    path = "/api/v1/meet/rooms/{id}",
    params(("id" = Uuid, Path, description = "Room ID")),
    responses(
        (status = 200, description = "Room details", body = RoomResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Room not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
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
        livekit_url: state.livekit.base_url.clone(),
    }))
}

/// Update a room
#[utoipa::path(
    put,
    path = "/api/v1/meet/rooms/{id}",
    params(("id" = Uuid, Path, description = "Room ID")),
    request_body = UpdateRoomRequest,
    responses(
        (status = 200, description = "Room updated", body = RoomResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Room not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
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
        livekit_url: state.livekit.base_url.clone(),
    }))
}

/// Delete a room
#[utoipa::path(
    delete,
    path = "/api/v1/meet/rooms/{id}",
    params(("id" = Uuid, Path, description = "Room ID")),
    responses(
        (status = 204, description = "Room deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Room not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
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
#[utoipa::path(
    post,
    path = "/api/v1/meet/rooms/{id}/end",
    params(("id" = Uuid, Path, description = "Room ID")),
    responses(
        (status = 200, description = "Room ended", body = RoomResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Room not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
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
        livekit_url: state.livekit.base_url.clone(),
    }))
}

/// List meeting history
#[utoipa::path(
    get,
    path = "/api/v1/meet/history",
    responses(
        (status = 200, description = "Meeting history for the authenticated user", body = Vec<MeetingHistoryResponse>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
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

/// Response payload for the instant-room endpoint.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct InstantRoomResponse {
    /// 6-digit numeric code, also used as the LiveKit room name.
    pub code: String,
    /// LiveKit access token (host grants — `roomAdmin=true`).
    pub token: String,
    /// Base URL of the LiveKit Server.
    pub url: String,
}

/// Create an instant (ad-hoc) room.
///
/// Generates a 6-digit numeric code, asks LiveKit Server to materialise
/// the room with a 10-minute empty-timeout, persists a row in
/// `meet.rooms` (host = authenticated user), then issues a host token.
///
/// # Errors
///
/// Returns 500 if LiveKit rejects the CreateRoom request or the DB
/// insert fails. Returns 500 if token issuance fails.
#[utoipa::path(
    post,
    path = "/api/v1/meet/rooms/instant",
    responses(
        (status = 200, description = "Instant room created", body = InstantRoomResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "LiveKit or DB failure"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state), fields(user_id = %claims.sub))]
pub async fn create_instant_room(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<InstantRoomResponse>, (StatusCode, String)> {
    let code = generate_numeric_code();

    // Ask LiveKit to create the room up-front so we fail fast on
    // configuration errors (rather than at first join).
    state
        .livekit
        .create_room(
            &code,
            RoomOptions {
                empty_timeout: Some(600),
                max_participants: None,
            },
        )
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("livekit: {e}")))?;

    // Persist a `meet.rooms` row so existing endpoints (token lookup,
    // participants, recordings…) can resolve the room.
    let default_name = format!("Instant #{code}");
    sqlx::query(
        r#"
        INSERT INTO meet.rooms (
            name, created_by, room_code, status, is_private,
            max_participants, settings
        ) VALUES ($1, $2, $3, 'active', false, NULL, NULL)
        "#,
    )
    .bind(&default_name)
    .bind(claims.sub)
    .bind(&code)
    .execute(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Host token — roomAdmin=true so kick/mute work immediately.
    let token = state
        .livekit
        .generate_token(TokenGrants {
            room: code.clone(),
            identity: claims.sub.to_string(),
            name: Some(claims.username.clone()),
            can_publish: true,
            can_subscribe: true,
            can_publish_data: true,
            room_admin: true,
        })
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(InstantRoomResponse {
        code,
        token,
        url: state.livekit.base_url.clone(),
    }))
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn numeric_code_is_six_digits() {
        for _ in 0..50 {
            let code = generate_numeric_code();
            assert_eq!(code.len(), 6, "code {code} must be 6 chars");
            assert!(code.chars().all(|c| c.is_ascii_digit()), "digits only");
        }
    }

    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }
}
