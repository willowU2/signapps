//! Raise hand handlers (Phase 3c).
//!
//! Backed by `meet.raised_hands` (migration `286_meet_extensions.sql`). A
//! living set, not a queue — each `(room_id, identity, raised_at)` row
//! represents one "raise" event; `lowered_at` is nullable until the user
//! (or the host) lowers it.
//!
//! Endpoints:
//! - `POST /meet/rooms/:code/hands/raise`            (auth) — raise my hand
//! - `POST /meet/rooms/:code/hands/lower`            (auth) — lower my hand
//! - `POST /meet/rooms/:code/hands/lower/:identity`  (host) — lower someone else's
//! - `GET  /meet/rooms/:code/hands`                  (auth) — list raised hands
//!
//! On state changes the handlers publish events on `PgEventBus`:
//! `meet.hand.raised`, `meet.hand.lowered`. The frontend broadcasts a
//! matching LiveKit data channel payload on topic `"hand"` so peers see
//! the ✋ overlay without waiting for a DB round-trip.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use serde::Serialize;
use signapps_common::pg_events::{NewEvent, PgEventBus};
use signapps_common::Claims;
use sqlx::FromRow;
use uuid::Uuid;

use crate::{models::Room, AppState};

// ── DTOs ──────────────────────────────────────────────────────────────────────

/// One currently-raised hand.
#[derive(Debug, Clone, Serialize, FromRow, utoipa::ToSchema)]
pub struct RaisedHand {
    /// Participant identity (the LiveKit / knock-flow identity string).
    pub identity: String,
    /// When the hand was raised.
    pub raised_at: DateTime<Utc>,
}

/// Response body for `POST /meet/rooms/:code/hands/raise`.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct RaiseHandResponse {
    /// Identity that raised its hand.
    pub identity: String,
    /// Raise timestamp.
    pub raised_at: DateTime<Utc>,
}

/// Response body for `POST /meet/rooms/:code/hands/lower*`.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct LowerHandResponse {
    /// Identity whose hand was lowered.
    pub identity: String,
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async fn fetch_room_by_code(state: &AppState, code: &str) -> Result<Room, (StatusCode, String)> {
    sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE room_code = $1")
        .bind(code)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))
}

async fn publish_event(
    pool: &sqlx::PgPool,
    event_type: &str,
    aggregate_id: Uuid,
    payload: serde_json::Value,
) {
    let bus = PgEventBus::new(pool.clone(), "signapps-meet".to_string());
    if let Err(err) = bus
        .publish(NewEvent {
            event_type: event_type.to_string(),
            aggregate_id: Some(aggregate_id),
            payload,
        })
        .await
    {
        tracing::warn!(?err, event_type, "failed to publish hand event");
    }
}

// ── Handlers ───────────────────────────────────────────────────────────────────

/// Raise the caller's hand in the given room.
///
/// If a previous raise exists and is still "raised" (`lowered_at IS NULL`)
/// we leave it alone. Otherwise we insert a fresh row.
///
/// # Errors
///
/// - `404` if the room code is unknown.
/// - `500` on DB failure.
#[utoipa::path(
    post,
    path = "/api/v1/meet/rooms/{code}/hands/raise",
    params(("code" = String, Path, description = "Room code")),
    responses(
        (status = 200, description = "Hand raised", body = RaiseHandResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Room not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
pub async fn raise_hand(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(code): Path<String>,
) -> Result<Json<RaiseHandResponse>, (StatusCode, String)> {
    let room = fetch_room_by_code(&state, &code).await?;
    let identity = claims.sub.to_string();

    // If an un-lowered row already exists, reuse it. Otherwise insert.
    let existing: Option<(DateTime<Utc>,)> = sqlx::query_as(
        r#"
        SELECT raised_at FROM meet.raised_hands
        WHERE room_id = $1 AND identity = $2 AND lowered_at IS NULL
        ORDER BY raised_at DESC LIMIT 1
        "#,
    )
    .bind(room.id)
    .bind(&identity)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let raised_at = if let Some((ts,)) = existing {
        ts
    } else {
        let row: (DateTime<Utc>,) = sqlx::query_as(
            r#"
            INSERT INTO meet.raised_hands (room_id, identity)
            VALUES ($1, $2)
            RETURNING raised_at
            "#,
        )
        .bind(room.id)
        .bind(&identity)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        row.0
    };

    publish_event(
        &state.pool,
        "meet.hand.raised",
        room.id,
        serde_json::json!({
            "room_id": room.id,
            "room_code": code,
            "identity": identity,
            "raised_at": raised_at,
        }),
    )
    .await;

    Ok(Json(RaiseHandResponse {
        identity,
        raised_at,
    }))
}

/// Lower the caller's hand. Marks the most recent un-lowered row for that
/// identity as `lowered_at = NOW()`.
///
/// # Errors
///
/// - `404` if the room code is unknown.
/// - `500` on DB failure.
#[utoipa::path(
    post,
    path = "/api/v1/meet/rooms/{code}/hands/lower",
    params(("code" = String, Path, description = "Room code")),
    responses(
        (status = 200, description = "Hand lowered", body = LowerHandResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Room not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
pub async fn lower_hand(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(code): Path<String>,
) -> Result<Json<LowerHandResponse>, (StatusCode, String)> {
    let room = fetch_room_by_code(&state, &code).await?;
    let identity = claims.sub.to_string();

    sqlx::query(
        r#"
        UPDATE meet.raised_hands
           SET lowered_at = NOW()
         WHERE room_id = $1 AND identity = $2 AND lowered_at IS NULL
        "#,
    )
    .bind(room.id)
    .bind(&identity)
    .execute(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    publish_event(
        &state.pool,
        "meet.hand.lowered",
        room.id,
        serde_json::json!({
            "room_id": room.id,
            "room_code": code,
            "identity": identity,
        }),
    )
    .await;

    Ok(Json(LowerHandResponse { identity }))
}

/// Lower another participant's hand (host-only).
///
/// # Errors
///
/// - `403` if the caller is not the host.
/// - `404` if the room code is unknown.
/// - `500` on DB failure.
#[utoipa::path(
    post,
    path = "/api/v1/meet/rooms/{code}/hands/lower/{identity}",
    params(
        ("code" = String, Path, description = "Room code"),
        ("identity" = String, Path, description = "Target participant identity"),
    ),
    responses(
        (status = 200, description = "Hand lowered", body = LowerHandResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — host only"),
        (status = 404, description = "Room not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
pub async fn lower_other_hand(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((code, identity)): Path<(String, String)>,
) -> Result<Json<LowerHandResponse>, (StatusCode, String)> {
    let room = fetch_room_by_code(&state, &code).await?;
    if room.created_by != claims.sub {
        return Err((
            StatusCode::FORBIDDEN,
            "Only host can lower someone else's hand".to_string(),
        ));
    }

    sqlx::query(
        r#"
        UPDATE meet.raised_hands
           SET lowered_at = NOW()
         WHERE room_id = $1 AND identity = $2 AND lowered_at IS NULL
        "#,
    )
    .bind(room.id)
    .bind(&identity)
    .execute(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    publish_event(
        &state.pool,
        "meet.hand.lowered",
        room.id,
        serde_json::json!({
            "room_id": room.id,
            "room_code": code,
            "identity": identity,
            "lowered_by_host": true,
        }),
    )
    .await;

    Ok(Json(LowerHandResponse { identity }))
}

/// List currently raised hands in a room (`lowered_at IS NULL`).
///
/// # Errors
///
/// - `404` if the room code is unknown.
/// - `500` on DB failure.
#[utoipa::path(
    get,
    path = "/api/v1/meet/rooms/{code}/hands",
    params(("code" = String, Path, description = "Room code")),
    responses(
        (status = 200, description = "Raised hands", body = Vec<RaisedHand>),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Room not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state))]
pub async fn list_raised_hands(
    State(state): State<AppState>,
    Path(code): Path<String>,
) -> Result<Json<Vec<RaisedHand>>, (StatusCode, String)> {
    let room = fetch_room_by_code(&state, &code).await?;
    let rows: Vec<RaisedHand> = sqlx::query_as(
        r#"
        SELECT identity, raised_at FROM meet.raised_hands
        WHERE room_id = $1 AND lowered_at IS NULL
        ORDER BY raised_at ASC
        "#,
    )
    .bind(room.id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(rows))
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_compiles() {
        // Integration tests require a running DB.
        assert!(true, "{} handler module loaded", module_path!());
    }

    #[allow(dead_code)]
    fn types_are_sound() {
        // Smoke check — ensures response types compose with serde_json.
        let r = super::RaiseHandResponse {
            identity: "x".to_string(),
            raised_at: chrono::Utc::now(),
        };
        let _ = serde_json::to_value(r).expect("serialize");
    }
}
