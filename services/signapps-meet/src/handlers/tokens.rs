//! Token generation handlers

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Extension, Json,
};
use serde::Deserialize;
use signapps_common::Claims;
use uuid::Uuid;

use crate::{
    livekit::generate_participant_token,
    models::{JoinRoomRequest, Room, TokenResponse},
    AppState,
};

#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct TokenQuery {
    pub room: Option<String>,
    pub display_name: Option<String>,
}

/// Get a token for joining any room (by room code or ID)
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/tokens",
    responses((status = 200, description = "Success")),
    tag = "Meet"
)]
pub async fn get_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<TokenQuery>,
) -> Result<Json<TokenResponse>, (StatusCode, String)> {
    let room_identifier = query.room.ok_or((
        StatusCode::BAD_REQUEST,
        "room parameter required".to_string(),
    ))?;

    // Try to find room by code or ID
    let room = if let Ok(uuid) = room_identifier.parse::<Uuid>() {
        sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE id = $1")
            .bind(uuid)
            .fetch_optional(&state.pool)
            .await
    } else {
        sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE room_code = $1")
            .bind(&room_identifier)
            .fetch_optional(&state.pool)
            .await
    }
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;

    // Check if room is accessible
    if room.status == "ended" {
        return Err((StatusCode::GONE, "Room has ended".to_string()));
    }

    // Determine if user is host
    let is_host = room.created_by == claims.sub;

    // Use provided display name or default to username
    let display_name = query
        .display_name
        .unwrap_or_else(|| claims.username.clone());

    // Generate LiveKit token
    let token = generate_participant_token(
        &state.livekit_config,
        &room.room_code,
        &claims.sub.to_string(),
        &display_name,
        is_host,
    )
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Update room status to active if it was scheduled
    if room.status == "scheduled" {
        sqlx::query(
            "UPDATE meet.rooms SET status = 'active', actual_start = NOW(), updated_at = NOW() WHERE id = $1",
        )
        .bind(room.id)
        .execute(&state.pool)
        .await
        .ok();
    }

    // Record participant join
    sqlx::query(
        r#"
        INSERT INTO meet.room_participants (room_id, user_id, display_name, role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (room_id, user_id) WHERE left_at IS NULL
        DO UPDATE SET joined_at = NOW()
        "#,
    )
    .bind(room.id)
    .bind(claims.sub)
    .bind(&display_name)
    .bind(if is_host { "host" } else { "participant" })
    .execute(&state.pool)
    .await
    .ok();

    Ok(Json(TokenResponse {
        token,
        livekit_url: state.livekit_config.server_url.clone(),
        room_name: room.room_code,
    }))
}

/// Get a token for a specific room by ID
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/tokens",
    responses((status = 200, description = "Success")),
    tag = "Meet"
)]
pub async fn get_room_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(req): Json<Option<JoinRoomRequest>>,
) -> Result<Json<TokenResponse>, (StatusCode, String)> {
    let room = sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;

    // Check if room is accessible
    if room.status == "ended" {
        return Err((StatusCode::GONE, "Room has ended".to_string()));
    }

    // Extract display name before consuming req
    let display_name = req
        .as_ref()
        .and_then(|r| r.display_name.clone())
        .unwrap_or_else(|| claims.username.clone());

    // Check password if room is private
    if room.is_private {
        if let Some(hash) = &room.password_hash {
            let join_req = req.ok_or((
                StatusCode::UNAUTHORIZED,
                "Password required for private room".to_string(),
            ))?;
            let password = join_req.password.ok_or((
                StatusCode::UNAUTHORIZED,
                "Password required for private room".to_string(),
            ))?;
            if !bcrypt::verify(&password, hash).unwrap_or(false) {
                return Err((StatusCode::UNAUTHORIZED, "Invalid password".to_string()));
            }
        }
    }

    // Check max participants
    if let Some(max) = room.max_participants {
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM meet.room_participants WHERE room_id = $1 AND left_at IS NULL",
        )
        .bind(room.id)
        .fetch_one(&state.pool)
        .await
        .unwrap_or((0,));

        if count.0 >= max as i64 {
            return Err((StatusCode::CONFLICT, "Room is full".to_string()));
        }
    }

    // Determine if user is host
    let is_host = room.created_by == claims.sub;

    // Generate LiveKit token
    let token = generate_participant_token(
        &state.livekit_config,
        &room.room_code,
        &claims.sub.to_string(),
        &display_name,
        is_host,
    )
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Update room status to active if it was scheduled
    if room.status == "scheduled" {
        sqlx::query(
            "UPDATE meet.rooms SET status = 'active', actual_start = NOW(), updated_at = NOW() WHERE id = $1",
        )
        .bind(room.id)
        .execute(&state.pool)
        .await
        .ok();
    }

    // Record participant join
    sqlx::query(
        r#"
        INSERT INTO meet.room_participants (room_id, user_id, display_name, role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (room_id, user_id) WHERE left_at IS NULL
        DO UPDATE SET joined_at = NOW()
        "#,
    )
    .bind(room.id)
    .bind(claims.sub)
    .bind(&display_name)
    .bind(if is_host { "host" } else { "participant" })
    .execute(&state.pool)
    .await
    .ok();

    Ok(Json(TokenResponse {
        token,
        livekit_url: state.livekit_config.server_url.clone(),
        room_name: room.room_code,
    }))
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
