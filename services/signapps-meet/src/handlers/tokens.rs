//! Token generation handlers

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Extension, Json,
};
use serde::Deserialize;
use signapps_common::Claims;
use signapps_livekit_client::TokenGrants;
use uuid::Uuid;

use crate::{
    models::{JoinRoomRequest, Room, TokenResponse},
    AppState,
};

/// Build LiveKit token grants for a given participant role.
fn grants_for(room: &str, identity: &str, display_name: &str, is_host: bool) -> TokenGrants {
    TokenGrants {
        room: room.to_string(),
        identity: identity.to_string(),
        name: Some(display_name.to_string()),
        can_publish: true,
        can_subscribe: true,
        can_publish_data: true,
        room_admin: is_host,
    }
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Query parameters for filtering results.
pub struct TokenQuery {
    pub room: Option<String>,
    pub display_name: Option<String>,
}

/// Get a token for joining any room (by room code or ID)
#[utoipa::path(
    get,
    path = "/api/v1/meet/token",
    params(
        ("room" = Option<String>, Query, description = "Room code or UUID"),
        ("display_name" = Option<String>, Query, description = "Display name override"),
    ),
    responses(
        (status = 200, description = "LiveKit token for the room", body = crate::models::TokenResponse),
        (status = 400, description = "Missing room parameter"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Room not found"),
        (status = 410, description = "Room has ended"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip_all)]
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

    // Generate LiveKit token via shared client
    let token = state
        .livekit
        .generate_token(grants_for(
            &room.room_code,
            &claims.sub.to_string(),
            &display_name,
            is_host,
        ))
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
        livekit_url: state.livekit.base_url.clone(),
        room_name: room.room_code,
    }))
}

/// Get a token for a specific room by ID
#[utoipa::path(
    get,
    path = "/api/v1/meet/rooms/{id}/token",
    params(("id" = Uuid, Path, description = "Room ID")),
    request_body(content = Option<crate::models::JoinRoomRequest>, description = "Optional join request with password and display name"),
    responses(
        (status = 200, description = "LiveKit token for the room", body = crate::models::TokenResponse),
        (status = 401, description = "Unauthorized or invalid password"),
        (status = 404, description = "Room not found"),
        (status = 409, description = "Room is full"),
        (status = 410, description = "Room has ended"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip_all)]
pub async fn get_room_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    // `Option<Json<T>>` makes the body optional (no-body GET returns None)
    // whereas `Json<Option<T>>` *requires* a body. The route is GET, so the
    // body is optional.
    req: Option<Json<JoinRoomRequest>>,
) -> Result<Json<TokenResponse>, (StatusCode, String)> {
    let req = req.map(|Json(r)| r);
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

    // Generate LiveKit token via shared client
    let token = state
        .livekit
        .generate_token(grants_for(
            &room.room_code,
            &claims.sub.to_string(),
            &display_name,
            is_host,
        ))
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
        livekit_url: state.livekit.base_url.clone(),
        room_name: room.room_code,
    }))
}

/// Join a room by its short code (used by the frontend after instant-create
/// or when navigating to `/meet/:code`).
#[utoipa::path(
    post,
    path = "/api/v1/meet/rooms/{code}/join",
    params(("code" = String, Path, description = "Room short code")),
    request_body(content = JoinRoomRequest, content_type = "application/json"),
    responses(
        (status = 200, description = "Joined room", body = TokenResponse),
        (status = 404, description = "Room not found"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state), fields(user_id = %claims.sub))]
pub async fn join_by_code(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(code): Path<String>,
    body: Option<Json<JoinRoomRequest>>,
) -> Result<Json<TokenResponse>, (StatusCode, String)> {
    let body = body.map(|Json(b)| b);

    let room = sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE room_code = $1")
        .bind(&code)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;

    if room.status == "ended" {
        return Err((StatusCode::GONE, "Room has ended".to_string()));
    }

    let display_name = body
        .as_ref()
        .and_then(|r| r.display_name.clone())
        .unwrap_or_else(|| claims.username.clone());

    let is_host = room.created_by == claims.sub;

    let token = state
        .livekit
        .generate_token(grants_for(
            &room.room_code,
            &claims.sub.to_string(),
            &display_name,
            is_host,
        ))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

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
        livekit_url: state.livekit.base_url.clone(),
        room_name: room.room_code,
    }))
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }
}
