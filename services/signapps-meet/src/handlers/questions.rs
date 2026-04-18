//! Q&A handlers (Phase 3c).
//!
//! Backed by `meet.questions` (migration `286_meet_extensions.sql`).
//! Participants ask questions, upvote them, the host answers or deletes.
//!
//! ## Upvote dedup — deliberate tradeoff
//!
//! We track who has already upvoted a question in a global in-memory
//! `DashMap<question_id, HashSet<identity>>`. **This is per-service-process
//! only** — restarts of `signapps-meet` wipe the set and the same user
//! can upvote again. That's acceptable because the whole meeting usually
//! lives inside a single process uptime. A hard guarantee would require
//! an extra `meet.question_upvotes(question_id, identity)` table — out
//! of scope for Phase 3c.
//!
//! Endpoints:
//! - `POST   /meet/rooms/:code/questions`   (auth) — ask
//! - `GET    /meet/rooms/:code/questions`   (auth) — list (upvotes DESC, created ASC)
//! - `POST   /meet/questions/:id/upvote`    (auth) — +1 (de-duped per session)
//! - `POST   /meet/questions/:id/answer`    (host) — add answer
//! - `DELETE /meet/questions/:id`           (host or asker) — delete

use std::collections::HashSet;
use std::sync::OnceLock;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use signapps_common::pg_events::{NewEvent, PgEventBus};
use signapps_common::Claims;
use sqlx::FromRow;
use uuid::Uuid;

use crate::{models::Room, AppState};

/// Per-session upvote dedup set — see module docs for the tradeoff.
static UPVOTE_DEDUP: OnceLock<DashMap<Uuid, HashSet<String>>> = OnceLock::new();

fn dedup() -> &'static DashMap<Uuid, HashSet<String>> {
    UPVOTE_DEDUP.get_or_init(DashMap::new)
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

/// One question row returned to the frontend.
#[derive(Debug, Clone, Serialize, FromRow, utoipa::ToSchema)]
pub struct Question {
    /// Question id.
    pub id: Uuid,
    /// Room id.
    pub room_id: Uuid,
    /// Identity of the asker.
    pub asked_by: String,
    /// Question text.
    pub question: String,
    /// Host's answer (null until answered).
    pub answer: Option<String>,
    /// Upvote count.
    pub upvotes: i32,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// When the host answered, if any.
    pub answered_at: Option<DateTime<Utc>>,
}

/// Request body for `POST /meet/rooms/:code/questions`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct AskQuestionRequest {
    /// Question text.
    pub question: String,
}

/// Request body for `POST /meet/questions/:id/answer`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct AnswerQuestionRequest {
    /// Answer text.
    pub answer: String,
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

async fn fetch_question(state: &AppState, id: Uuid) -> Result<Question, (StatusCode, String)> {
    sqlx::query_as::<_, Question>("SELECT * FROM meet.questions WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Question not found".to_string()))
}

async fn is_host(
    state: &AppState,
    room_id: Uuid,
    claims: &Claims,
) -> Result<bool, (StatusCode, String)> {
    let room = sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;
    Ok(room.created_by == claims.sub)
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
        tracing::warn!(?err, event_type, "failed to publish question event");
    }
}

// ── Handlers ───────────────────────────────────────────────────────────────────

/// Ask a new question.
///
/// # Errors
///
/// - `400` if the question is empty.
/// - `404` if the room code is unknown.
/// - `500` on DB failure.
#[utoipa::path(
    post,
    path = "/api/v1/meet/rooms/{code}/questions",
    params(("code" = String, Path, description = "Room code")),
    request_body = AskQuestionRequest,
    responses(
        (status = 200, description = "Question created", body = Question),
        (status = 400, description = "Empty question"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Room not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
pub async fn ask_question(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(code): Path<String>,
    Json(req): Json<AskQuestionRequest>,
) -> Result<Json<Question>, (StatusCode, String)> {
    let room = fetch_room_by_code(&state, &code).await?;

    let text = req.question.trim();
    if text.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Question cannot be empty".to_string(),
        ));
    }

    let question: Question = sqlx::query_as(
        r#"
        INSERT INTO meet.questions (room_id, asked_by, question)
        VALUES ($1, $2, $3)
        RETURNING id, room_id, asked_by, question, answer, upvotes, created_at, answered_at
        "#,
    )
    .bind(room.id)
    .bind(claims.sub.to_string())
    .bind(text)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    publish_event(
        &state.pool,
        "meet.question.asked",
        question.id,
        serde_json::json!({
            "room_id": room.id,
            "room_code": code,
            "question_id": question.id,
            "asked_by": question.asked_by,
        }),
    )
    .await;

    Ok(Json(question))
}

/// List questions for a room, ordered by upvotes DESC, created ASC.
///
/// # Errors
///
/// - `404` if the room code is unknown.
/// - `500` on DB failure.
#[utoipa::path(
    get,
    path = "/api/v1/meet/rooms/{code}/questions",
    params(("code" = String, Path, description = "Room code")),
    responses(
        (status = 200, description = "Questions for the room", body = Vec<Question>),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Room not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state))]
pub async fn list_questions(
    State(state): State<AppState>,
    Path(code): Path<String>,
) -> Result<Json<Vec<Question>>, (StatusCode, String)> {
    let room = fetch_room_by_code(&state, &code).await?;

    let questions: Vec<Question> = sqlx::query_as(
        r#"
        SELECT id, room_id, asked_by, question, answer, upvotes, created_at, answered_at
        FROM meet.questions
        WHERE room_id = $1
        ORDER BY upvotes DESC, created_at ASC
        "#,
    )
    .bind(room.id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(questions))
}

/// Upvote a question. De-duped per identity in-process; see module docs.
///
/// # Errors
///
/// - `404` if the question does not exist.
/// - `500` on DB failure.
#[utoipa::path(
    post,
    path = "/api/v1/meet/questions/{id}/upvote",
    params(("id" = Uuid, Path, description = "Question ID")),
    responses(
        (status = 200, description = "Upvote registered", body = Question),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Question not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
pub async fn upvote_question(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(question_id): Path<Uuid>,
) -> Result<Json<Question>, (StatusCode, String)> {
    let identity = claims.sub.to_string();
    let already_voted = {
        let mut entry = dedup().entry(question_id).or_default();
        !entry.insert(identity.clone())
    };

    let question = if already_voted {
        // Return current state without incrementing.
        fetch_question(&state, question_id).await?
    } else {
        let q: Option<Question> = sqlx::query_as(
            r#"
            UPDATE meet.questions
               SET upvotes = upvotes + 1
             WHERE id = $1
            RETURNING id, room_id, asked_by, question, answer, upvotes, created_at, answered_at
            "#,
        )
        .bind(question_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        q.ok_or((StatusCode::NOT_FOUND, "Question not found".to_string()))?
    };

    publish_event(
        &state.pool,
        "meet.question.upvoted",
        question_id,
        serde_json::json!({
            "room_id": question.room_id,
            "question_id": question_id,
            "identity": identity,
            "upvotes": question.upvotes,
        }),
    )
    .await;

    Ok(Json(question))
}

/// Answer a question (host only).
///
/// # Errors
///
/// - `400` if the answer is empty.
/// - `403` if the caller is not the host.
/// - `404` if the question does not exist.
/// - `500` on DB failure.
#[utoipa::path(
    post,
    path = "/api/v1/meet/questions/{id}/answer",
    params(("id" = Uuid, Path, description = "Question ID")),
    request_body = AnswerQuestionRequest,
    responses(
        (status = 200, description = "Question answered", body = Question),
        (status = 400, description = "Empty answer"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — host only"),
        (status = 404, description = "Question not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
pub async fn answer_question(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(question_id): Path<Uuid>,
    Json(req): Json<AnswerQuestionRequest>,
) -> Result<Json<Question>, (StatusCode, String)> {
    let question = fetch_question(&state, question_id).await?;
    if !is_host(&state, question.room_id, &claims).await? {
        return Err((
            StatusCode::FORBIDDEN,
            "Only host can answer questions".to_string(),
        ));
    }

    let answer = req.answer.trim();
    if answer.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Answer cannot be empty".to_string(),
        ));
    }

    let updated: Question = sqlx::query_as(
        r#"
        UPDATE meet.questions
           SET answer = $1, answered_at = NOW()
         WHERE id = $2
        RETURNING id, room_id, asked_by, question, answer, upvotes, created_at, answered_at
        "#,
    )
    .bind(answer)
    .bind(question_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    publish_event(
        &state.pool,
        "meet.question.answered",
        question_id,
        serde_json::json!({
            "room_id": updated.room_id,
            "question_id": question_id,
        }),
    )
    .await;

    Ok(Json(updated))
}

/// Delete a question (host or the original asker).
///
/// # Errors
///
/// - `403` if the caller is neither the host nor the asker.
/// - `404` if the question does not exist.
/// - `500` on DB failure.
#[utoipa::path(
    delete,
    path = "/api/v1/meet/questions/{id}",
    params(("id" = Uuid, Path, description = "Question ID")),
    responses(
        (status = 204, description = "Question deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Question not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
pub async fn delete_question(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(question_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let question = fetch_question(&state, question_id).await?;
    let caller = claims.sub.to_string();
    let host = is_host(&state, question.room_id, &claims).await?;
    if !host && question.asked_by != caller {
        return Err((
            StatusCode::FORBIDDEN,
            "Only host or the asker can delete".to_string(),
        ));
    }

    sqlx::query("DELETE FROM meet.questions WHERE id = $1")
        .bind(question_id)
        .execute(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Housekeeping on the dedup map — tiny RAM gain, also avoids leaking
    // identities for long-lived processes.
    dedup().remove(&question_id);

    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dedup_returns_same_instance() {
        let a = dedup() as *const _;
        let b = dedup() as *const _;
        assert_eq!(a, b, "OnceLock must memoise");
    }

    #[test]
    fn dedup_inserts_once() {
        let q = Uuid::new_v4();
        let mut entry = dedup().entry(q).or_default();
        assert!(entry.insert("alice".to_string()));
        assert!(!entry.insert("alice".to_string()));
        drop(entry);
        dedup().remove(&q);
    }
}
