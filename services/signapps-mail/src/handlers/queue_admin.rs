//! Outbound queue administration handlers.
//!
//! Provides admin endpoints for inspecting and managing the SMTP outbound
//! delivery queue (`mailserver.outbound_queue`).

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/// An entry in the outbound delivery queue.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct QueueEntry {
    /// Unique identifier.
    pub id: Uuid,
    /// Envelope sender address.
    pub sender: String,
    /// Envelope recipient address.
    pub recipient: String,
    /// Message subject (for display).
    pub subject: Option<String>,
    /// Delivery status: `pending`, `deferred`, `delivered`, `failed`.
    pub status: String,
    /// Number of delivery attempts so far.
    pub retry_count: Option<i32>,
    /// Timestamp of the next scheduled delivery attempt.
    pub next_retry_at: Option<DateTime<Utc>>,
    /// Human-readable description of the last delivery error.
    pub last_error: Option<String>,
    /// Row creation timestamp.
    pub created_at: Option<DateTime<Utc>>,
    /// Row last-update timestamp.
    pub updated_at: Option<DateTime<Utc>>,
}

/// Outbound queue statistics.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct QueueStats {
    /// Total entries in the queue.
    pub total: i64,
    /// Number of pending entries.
    pub pending: i64,
    /// Number of deferred entries.
    pub deferred: i64,
    /// Number of failed entries.
    pub failed: i64,
    /// Number of delivered entries.
    pub delivered: i64,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// List all entries in the outbound queue.
///
/// # Errors
///
/// Returns 500 on database failure.
///
/// # Panics
///
/// None.
#[utoipa::path(
    get,
    path = "/api/v1/mailserver/queue",
    tag = "mailserver-queue",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "Queue entries", body = Vec<QueueEntry>),
        (status = 500, description = "Internal server error"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_queue(State(state): State<AppState>) -> impl IntoResponse {
    match sqlx::query_as::<_, QueueEntry>(
        "SELECT id, sender, recipient, subject, status, retry_count, \
         next_retry_at, last_error, created_at, updated_at \
         FROM mailserver.outbound_queue \
         ORDER BY created_at DESC LIMIT 500",
    )
    .fetch_all(&state.pool)
    .await
    {
        Ok(entries) => Json(serde_json::json!({ "queue": entries })).into_response(),
        Err(e) => {
            tracing::error!("Failed to list queue: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to list queue" })),
            )
                .into_response()
        },
    }
}

/// Retry a deferred queue entry.
///
/// Resets the entry to `pending` status and clears the next retry timestamp
/// so it is picked up immediately by the queue worker.
///
/// # Errors
///
/// Returns 404 if entry not found.
///
/// # Panics
///
/// None.
#[utoipa::path(
    post,
    path = "/api/v1/mailserver/queue/{id}/retry",
    tag = "mailserver-queue",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Queue entry ID")),
    responses(
        (status = 200, description = "Entry scheduled for retry"),
        (status = 404, description = "Entry not found"),
    )
)]
#[tracing::instrument(skip(state), fields(queue_id = %id))]
pub async fn retry_queue_entry(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query(
        "UPDATE mailserver.outbound_queue \
         SET status = 'pending', next_retry_at = NOW(), updated_at = NOW() \
         WHERE id = $1 AND status IN ('deferred', 'failed') \
         RETURNING id",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(_)) => {
            tracing::info!(queue_id = %id, "Queue entry scheduled for retry");
            Json(serde_json::json!({ "success": true })).into_response()
        },
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Queue entry not found or not retryable" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("Failed to retry queue entry: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to retry queue entry" })),
            )
                .into_response()
        },
    }
}

/// Delete a queue entry.
///
/// # Errors
///
/// Returns 404 if entry not found.
///
/// # Panics
///
/// None.
#[utoipa::path(
    delete,
    path = "/api/v1/mailserver/queue/{id}",
    tag = "mailserver-queue",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Queue entry ID")),
    responses(
        (status = 200, description = "Entry deleted"),
        (status = 404, description = "Entry not found"),
    )
)]
#[tracing::instrument(skip(state), fields(queue_id = %id))]
pub async fn delete_queue_entry(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query("DELETE FROM mailserver.outbound_queue WHERE id = $1 RETURNING id")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
    {
        Ok(Some(_)) => {
            tracing::info!(queue_id = %id, "Queue entry deleted");
            Json(serde_json::json!({ "success": true })).into_response()
        },
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Queue entry not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("Failed to delete queue entry: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to delete queue entry" })),
            )
                .into_response()
        },
    }
}

/// Get queue statistics.
///
/// # Errors
///
/// Returns 500 on database failure.
///
/// # Panics
///
/// None.
#[utoipa::path(
    get,
    path = "/api/v1/mailserver/queue/stats",
    tag = "mailserver-queue",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "Queue statistics", body = QueueStats),
        (status = 500, description = "Internal server error"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn queue_stats(State(state): State<AppState>) -> impl IntoResponse {
    #[derive(sqlx::FromRow)]
    struct StatsRow {
        total: Option<i64>,
        pending: Option<i64>,
        deferred: Option<i64>,
        failed: Option<i64>,
        delivered: Option<i64>,
    }

    match sqlx::query_as::<_, StatsRow>(
        r#"SELECT
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE status = 'pending') AS pending,
               COUNT(*) FILTER (WHERE status = 'deferred') AS deferred,
               COUNT(*) FILTER (WHERE status = 'failed') AS failed,
               COUNT(*) FILTER (WHERE status = 'delivered') AS delivered
           FROM mailserver.outbound_queue"#,
    )
    .fetch_one(&state.pool)
    .await
    {
        Ok(row) => Json(QueueStats {
            total: row.total.unwrap_or(0),
            pending: row.pending.unwrap_or(0),
            deferred: row.deferred.unwrap_or(0),
            failed: row.failed.unwrap_or(0),
            delivered: row.delivered.unwrap_or(0),
        })
        .into_response(),
        Err(e) => {
            tracing::error!("Failed to get queue stats: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to get queue stats" })),
            )
                .into_response()
        },
    }
}
