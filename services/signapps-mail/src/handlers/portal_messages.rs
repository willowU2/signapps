//! Internal portal message handlers.
//!
//! Provides endpoints for the in-app messaging portal: thread-aware messages
//! between persons, read/unread tracking, and unread counts.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use signapps_common::Claims;

use crate::AppState;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/// A portal message.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct PortalMessage {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Thread this message belongs to (equals id for the first message).
    pub thread_id: Uuid,
    /// Sender person UUID.
    pub from_person_id: Uuid,
    /// Recipient person UUID.
    pub to_person_id: Uuid,
    /// Subject line (present on first message in thread).
    pub subject: Option<String>,
    /// Message body.
    pub body: String,
    /// Whether the recipient has read this message.
    pub is_read: Option<bool>,
    /// Row creation timestamp.
    pub created_at: Option<DateTime<Utc>>,
}

/// Request payload to send a portal message.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct SendPortalMessageRequest {
    /// Recipient person UUID.
    pub to_person_id: Uuid,
    /// Subject (required for new threads).
    pub subject: Option<String>,
    /// Message body.
    pub body: String,
    /// Thread UUID to reply into (absent = new thread).
    pub thread_id: Option<Uuid>,
}

/// Unread message count.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct UnreadCount {
    /// Number of unread portal messages for the current user.
    pub count: i64,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Row returned when looking up a person by user_id.
#[derive(Debug, sqlx::FromRow)]
struct PersonRow {
    id: Uuid,
}

/// Look up person_id from claims sub (user_id).
async fn person_id_from_claims(
    pool: &sqlx::PgPool,
    user_id: Uuid,
) -> Result<Uuid, axum::response::Response> {
    sqlx::query_as::<_, PersonRow>("SELECT id FROM core.persons WHERE user_id = $1 LIMIT 1")
        .bind(user_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| {
            tracing::error!(?e, "Failed to resolve person from user_id");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        })?
        .map(|r| r.id)
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Person profile not found for current user" })),
            )
                .into_response()
        })
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// List portal messages for the current user.
///
/// Returns all messages where the user is sender or recipient, ordered by
/// `created_at DESC`.
#[utoipa::path(
    get,
    path = "/api/v1/mail/portal-messages",
    tag = "mail-portal-messages",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "Portal messages", body = Vec<PortalMessage>),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_portal_messages(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let person_id = match person_id_from_claims(&state.pool, claims.sub).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    match sqlx::query_as::<_, PortalMessage>(
        r#"SELECT * FROM mail.portal_messages
           WHERE from_person_id = $1 OR to_person_id = $1
           ORDER BY created_at DESC"#,
    )
    .bind(person_id)
    .fetch_all(&state.pool)
    .await
    {
        Ok(messages) => Json(messages).into_response(),
        Err(e) => {
            tracing::error!(?e, "Failed to list portal messages");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        },
    }
}

/// Send a portal message (or reply into an existing thread).
///
/// For new messages `thread_id` is set equal to the new message's id.
#[utoipa::path(
    post,
    path = "/api/v1/mail/portal-messages",
    tag = "mail-portal-messages",
    request_body = SendPortalMessageRequest,
    security(("bearerAuth" = [])),
    responses(
        (status = 201, description = "Message sent", body = PortalMessage),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn send_portal_message(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SendPortalMessageRequest>,
) -> impl IntoResponse {
    let person_id = match person_id_from_claims(&state.pool, claims.sub).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    // Determine thread_id: provided value or generate a new one (same as message id).
    // We insert with a placeholder thread_id = gen_random_uuid() and then update if
    // it's a new thread, or use the provided thread_id directly.
    let thread_id = body.thread_id.unwrap_or_else(Uuid::new_v4);
    let msg_id = Uuid::new_v4();
    // For new threads: thread_id == msg_id
    let actual_thread_id = if body.thread_id.is_some() {
        thread_id
    } else {
        msg_id
    };

    match sqlx::query_as::<_, PortalMessage>(
        r#"INSERT INTO mail.portal_messages
               (id, thread_id, from_person_id, to_person_id, subject, body, is_read, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, false, NOW())
           RETURNING *"#,
    )
    .bind(msg_id)
    .bind(actual_thread_id)
    .bind(person_id)
    .bind(body.to_person_id)
    .bind(&body.subject)
    .bind(&body.body)
    .fetch_one(&state.pool)
    .await
    {
        Ok(msg) => (StatusCode::CREATED, Json(msg)).into_response(),
        Err(e) => {
            tracing::error!(?e, "Failed to send portal message");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        },
    }
}

/// Get a single portal message.
#[utoipa::path(
    get,
    path = "/api/v1/mail/portal-messages/{id}",
    tag = "mail-portal-messages",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Message UUID")),
    responses(
        (status = 200, description = "Portal message", body = PortalMessage),
        (status = 404, description = "Not found"),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn get_portal_message(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let person_id = match person_id_from_claims(&state.pool, claims.sub).await {
        Ok(pid) => pid,
        Err(resp) => return resp,
    };

    match sqlx::query_as::<_, PortalMessage>(
        r#"SELECT * FROM mail.portal_messages
           WHERE id = $1 AND (from_person_id = $2 OR to_person_id = $2)"#,
    )
    .bind(id)
    .bind(person_id)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(msg)) => Json(msg).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Message not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!(?e, "Failed to fetch portal message");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        },
    }
}

/// Mark a portal message as read.
#[utoipa::path(
    put,
    path = "/api/v1/mail/portal-messages/{id}/read",
    tag = "mail-portal-messages",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Message UUID")),
    responses(
        (status = 200, description = "Message marked as read", body = PortalMessage),
        (status = 404, description = "Not found"),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn mark_portal_read(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let person_id = match person_id_from_claims(&state.pool, claims.sub).await {
        Ok(pid) => pid,
        Err(resp) => return resp,
    };

    match sqlx::query_as::<_, PortalMessage>(
        r#"UPDATE mail.portal_messages
           SET is_read = true
           WHERE id = $1 AND to_person_id = $2
           RETURNING *"#,
    )
    .bind(id)
    .bind(person_id)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(msg)) => Json(msg).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Message not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!(?e, "Failed to mark portal message as read");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        },
    }
}

/// Get all messages in a thread, ordered by `created_at ASC`.
#[utoipa::path(
    get,
    path = "/api/v1/mail/portal-messages/threads/{thread_id}",
    tag = "mail-portal-messages",
    security(("bearerAuth" = [])),
    params(("thread_id" = Uuid, Path, description = "Thread UUID")),
    responses(
        (status = 200, description = "Thread messages", body = Vec<PortalMessage>),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn get_portal_thread(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(thread_id): Path<Uuid>,
) -> impl IntoResponse {
    let person_id = match person_id_from_claims(&state.pool, claims.sub).await {
        Ok(pid) => pid,
        Err(resp) => return resp,
    };

    match sqlx::query_as::<_, PortalMessage>(
        r#"SELECT * FROM mail.portal_messages
           WHERE thread_id = $1
             AND (from_person_id = $2 OR to_person_id = $2)
           ORDER BY created_at ASC"#,
    )
    .bind(thread_id)
    .bind(person_id)
    .fetch_all(&state.pool)
    .await
    {
        Ok(messages) => Json(messages).into_response(),
        Err(e) => {
            tracing::error!(?e, "Failed to fetch portal thread");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        },
    }
}

/// Get the unread portal message count for the current user.
#[utoipa::path(
    get,
    path = "/api/v1/mail/portal-messages/unread-count",
    tag = "mail-portal-messages",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "Unread count", body = UnreadCount),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn portal_unread_count(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let person_id = match person_id_from_claims(&state.pool, claims.sub).await {
        Ok(pid) => pid,
        Err(resp) => return resp,
    };

    match sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM mail.portal_messages WHERE to_person_id = $1 AND is_read = false",
    )
    .bind(person_id)
    .fetch_one(&state.pool)
    .await
    {
        Ok(count) => Json(UnreadCount { count }).into_response(),
        Err(e) => {
            tracing::error!(?e, "Failed to get unread portal message count");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        },
    }
}
