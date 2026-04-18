//! Live polls handlers (Phase 3c).
//!
//! Backed by `meet.polls` (migration `286_meet_extensions.sql`). Host
//! creates a poll, every authenticated participant can vote once (keyed
//! by their `claims.sub` — a re-vote overwrites the previous answer),
//! host closes the poll and the UI locks results.
//!
//! Endpoints:
//! - `POST   /meet/rooms/:code/polls`       (host) — create
//! - `GET    /meet/rooms/:code/polls`       (auth) — list for a room
//! - `POST   /meet/polls/:id/vote`          (auth) — vote (upsert)
//! - `POST   /meet/polls/:id/close`         (host) — close
//!
//! `votes` is a JSONB object shaped `{ "<identity>": <option_index> }`.
//! Results are computed client-side by iterating over the object values
//! — no materialised tallies.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::pg_events::{NewEvent, PgEventBus};
use signapps_common::Claims;
use sqlx::FromRow;
use uuid::Uuid;

use crate::{models::Room, AppState};

// ── DTOs ──────────────────────────────────────────────────────────────────────

/// One poll row (DB-shaped) returned to the frontend.
#[derive(Debug, Clone, Serialize, FromRow, utoipa::ToSchema)]
pub struct Poll {
    /// Poll id.
    pub id: Uuid,
    /// Room this poll belongs to.
    pub room_id: Uuid,
    /// Identity of the host that created the poll.
    pub created_by: String,
    /// Poll question.
    pub question: String,
    /// Options as a JSON array of strings (kept loose — the client is
    /// responsible for rendering).
    pub options: serde_json::Value,
    /// Vote map `{ "<identity>": <option_index> }`.
    pub votes: serde_json::Value,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// When the poll was closed, if any.
    pub closed_at: Option<DateTime<Utc>>,
}

/// Request body for `POST /meet/rooms/:code/polls`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreatePollRequest {
    /// Poll question.
    pub question: String,
    /// Options — minimum 2, maximum 6.
    pub options: Vec<String>,
}

/// Request body for `POST /meet/polls/:id/vote`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct VotePollRequest {
    /// Index into the poll's `options` array.
    pub option_index: i32,
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

async fn fetch_poll(state: &AppState, id: Uuid) -> Result<Poll, (StatusCode, String)> {
    sqlx::query_as::<_, Poll>("SELECT * FROM meet.polls WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Poll not found".to_string()))
}

async fn host_only_by_code(
    state: &AppState,
    code: &str,
    claims: &Claims,
) -> Result<Room, (StatusCode, String)> {
    let room = fetch_room_by_code(state, code).await?;
    if room.created_by != claims.sub {
        return Err((StatusCode::FORBIDDEN, "Only host can perform this".into()));
    }
    Ok(room)
}

async fn host_only_by_poll(
    state: &AppState,
    poll: &Poll,
    claims: &Claims,
) -> Result<(), (StatusCode, String)> {
    let room = sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE id = $1")
        .bind(poll.room_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;
    if room.created_by != claims.sub {
        return Err((
            StatusCode::FORBIDDEN,
            "Only host can perform this".to_string(),
        ));
    }
    Ok(())
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
        tracing::warn!(?err, event_type, "failed to publish poll event");
    }
}

// ── Handlers ───────────────────────────────────────────────────────────────────

/// Create a new poll (host only).
///
/// # Errors
///
/// - `400` if the options list is < 2 or > 6 entries, or the question is empty.
/// - `403` if the caller is not the host.
/// - `404` if the room code is unknown.
/// - `500` on DB failure.
#[utoipa::path(
    post,
    path = "/api/v1/meet/rooms/{code}/polls",
    params(("code" = String, Path, description = "Room code")),
    request_body = CreatePollRequest,
    responses(
        (status = 200, description = "Poll created", body = Poll),
        (status = 400, description = "Invalid question or options"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — host only"),
        (status = 404, description = "Room not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
pub async fn create_poll(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(code): Path<String>,
    Json(req): Json<CreatePollRequest>,
) -> Result<Json<Poll>, (StatusCode, String)> {
    let room = host_only_by_code(&state, &code, &claims).await?;

    let question = req.question.trim();
    if question.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Question cannot be empty".to_string(),
        ));
    }
    if req.options.len() < 2 || req.options.len() > 6 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Poll must have between 2 and 6 options".to_string(),
        ));
    }

    let options_json = serde_json::to_value(&req.options)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let poll: Poll = sqlx::query_as(
        r#"
        INSERT INTO meet.polls (room_id, created_by, question, options, votes)
        VALUES ($1, $2, $3, $4, '{}'::jsonb)
        RETURNING id, room_id, created_by, question, options, votes, created_at, closed_at
        "#,
    )
    .bind(room.id)
    .bind(claims.sub.to_string())
    .bind(question)
    .bind(options_json)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    publish_event(
        &state.pool,
        "meet.poll.created",
        poll.id,
        serde_json::json!({
            "room_id": room.id,
            "room_code": code,
            "poll_id": poll.id,
        }),
    )
    .await;

    Ok(Json(poll))
}

/// List polls for the given room (most recent first).
///
/// # Errors
///
/// - `404` if the room code is unknown.
/// - `500` on DB failure.
#[utoipa::path(
    get,
    path = "/api/v1/meet/rooms/{code}/polls",
    params(("code" = String, Path, description = "Room code")),
    responses(
        (status = 200, description = "Polls for the room", body = Vec<Poll>),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Room not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state))]
pub async fn list_polls(
    State(state): State<AppState>,
    Path(code): Path<String>,
) -> Result<Json<Vec<Poll>>, (StatusCode, String)> {
    let room = fetch_room_by_code(&state, &code).await?;

    let polls: Vec<Poll> = sqlx::query_as(
        r#"
        SELECT id, room_id, created_by, question, options, votes, created_at, closed_at
        FROM meet.polls
        WHERE room_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(room.id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(polls))
}

/// Vote (or re-vote) on a poll.
///
/// # Errors
///
/// - `400` if the option index is out of range or the poll is closed.
/// - `404` if the poll does not exist.
/// - `500` on DB failure.
#[utoipa::path(
    post,
    path = "/api/v1/meet/polls/{id}/vote",
    params(("id" = Uuid, Path, description = "Poll ID")),
    request_body = VotePollRequest,
    responses(
        (status = 200, description = "Vote recorded", body = Poll),
        (status = 400, description = "Invalid option or poll closed"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Poll not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
pub async fn vote_poll(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(poll_id): Path<Uuid>,
    Json(req): Json<VotePollRequest>,
) -> Result<Json<Poll>, (StatusCode, String)> {
    let poll = fetch_poll(&state, poll_id).await?;
    if poll.closed_at.is_some() {
        return Err((StatusCode::BAD_REQUEST, "Poll is closed".to_string()));
    }

    // Validate option_index.
    let options_len = poll.options.as_array().map(|a| a.len() as i32).unwrap_or(0);
    if req.option_index < 0 || req.option_index >= options_len {
        return Err((
            StatusCode::BAD_REQUEST,
            "option_index out of range".to_string(),
        ));
    }

    let identity = claims.sub.to_string();
    // Merge the vote into `votes` JSONB via jsonb_set.
    let updated: Poll = sqlx::query_as(
        r#"
        UPDATE meet.polls
           SET votes = jsonb_set(votes, ARRAY[$2], to_jsonb($3::int), true)
         WHERE id = $1
        RETURNING id, room_id, created_by, question, options, votes, created_at, closed_at
        "#,
    )
    .bind(poll_id)
    .bind(&identity)
    .bind(req.option_index)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    publish_event(
        &state.pool,
        "meet.poll.voted",
        poll_id,
        serde_json::json!({
            "room_id": updated.room_id,
            "poll_id": poll_id,
            "identity": identity,
            "option_index": req.option_index,
        }),
    )
    .await;

    Ok(Json(updated))
}

/// Close a poll (host only).
///
/// # Errors
///
/// - `400` if the poll is already closed.
/// - `403` if the caller is not the host.
/// - `404` if the poll does not exist.
/// - `500` on DB failure.
#[utoipa::path(
    post,
    path = "/api/v1/meet/polls/{id}/close",
    params(("id" = Uuid, Path, description = "Poll ID")),
    responses(
        (status = 200, description = "Poll closed", body = Poll),
        (status = 400, description = "Poll already closed"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — host only"),
        (status = 404, description = "Poll not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
pub async fn close_poll(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(poll_id): Path<Uuid>,
) -> Result<Json<Poll>, (StatusCode, String)> {
    let poll = fetch_poll(&state, poll_id).await?;
    host_only_by_poll(&state, &poll, &claims).await?;
    if poll.closed_at.is_some() {
        return Err((StatusCode::BAD_REQUEST, "Poll already closed".to_string()));
    }

    let updated: Poll = sqlx::query_as(
        r#"
        UPDATE meet.polls
           SET closed_at = NOW()
         WHERE id = $1
        RETURNING id, room_id, created_by, question, options, votes, created_at, closed_at
        "#,
    )
    .bind(poll_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    publish_event(
        &state.pool,
        "meet.poll.closed",
        poll_id,
        serde_json::json!({
            "room_id": updated.room_id,
            "poll_id": poll_id,
        }),
    )
    .await;

    Ok(Json(updated))
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }
}
