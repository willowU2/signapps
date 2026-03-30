//! Recurring email schedules — CRUD handler.
//!
//! Endpoints:
//!   POST   /api/v1/mail/emails/recurring       — create schedule
//!   GET    /api/v1/mail/emails/recurring        — list schedules (auth user)
//!   PATCH  /api/v1/mail/emails/recurring/:id   — update schedule
//!   DELETE /api/v1/mail/emails/recurring/:id   — delete schedule

use crate::AppState;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;
use sqlx::FromRow;
use uuid::Uuid;

// ============================================================================
// Domain type
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
/// RecurringEmail data transfer object.
pub struct RecurringEmail {
    pub id: Uuid,
    pub account_id: Uuid,
    pub user_id: Uuid,
    pub recipient: String,
    pub cc: Option<String>,
    pub bcc: Option<String>,
    pub subject: String,
    pub body_text: Option<String>,
    pub body_html: Option<String>,
    pub cron_expr: String,
    pub ends_at: Option<DateTime<Utc>>,
    pub last_sent_at: Option<DateTime<Utc>>,
    pub next_send_at: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// Request DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
/// Request body for CreateRecurring.
pub struct CreateRecurringRequest {
    pub account_id: Uuid,
    pub recipient: String,
    pub cc: Option<String>,
    pub bcc: Option<String>,
    pub subject: String,
    pub body_text: Option<String>,
    pub body_html: Option<String>,
    /// Cron expression, e.g. "0 9 * * 1" (every Monday at 09:00)
    pub cron_expr: String,
    pub ends_at: Option<DateTime<Utc>>,
    pub next_send_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
/// Request body for UpdateRecurring.
pub struct UpdateRecurringRequest {
    pub recipient: Option<String>,
    pub cc: Option<String>,
    pub bcc: Option<String>,
    pub subject: Option<String>,
    pub body_text: Option<String>,
    pub body_html: Option<String>,
    pub cron_expr: Option<String>,
    pub ends_at: Option<DateTime<Utc>>,
    pub next_send_at: Option<DateTime<Utc>>,
    pub is_active: Option<bool>,
}

// ============================================================================
// Handlers
// ============================================================================

/// POST /api/v1/mail/emails/recurring
#[tracing::instrument(skip_all)]
pub async fn create_recurring(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateRecurringRequest>,
) -> impl IntoResponse {
    // Verify account ownership
    let owns: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM mail.accounts WHERE id = $1 AND user_id = $2)",
    )
    .bind(payload.account_id)
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(false);

    if !owns {
        return (StatusCode::NOT_FOUND, "Account not found").into_response();
    }

    if payload.subject.trim().is_empty() {
        return (StatusCode::BAD_REQUEST, "Subject must not be empty").into_response();
    }
    if payload.cron_expr.trim().is_empty() {
        return (StatusCode::BAD_REQUEST, "cron_expr must not be empty").into_response();
    }

    let result = sqlx::query_as::<_, RecurringEmail>(
        r#"INSERT INTO mail.recurring_emails
               (account_id, user_id, recipient, cc, bcc, subject, body_text, body_html,
                cron_expr, ends_at, next_send_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *"#,
    )
    .bind(payload.account_id)
    .bind(claims.sub)
    .bind(&payload.recipient)
    .bind(&payload.cc)
    .bind(&payload.bcc)
    .bind(&payload.subject)
    .bind(&payload.body_text)
    .bind(&payload.body_html)
    .bind(&payload.cron_expr)
    .bind(payload.ends_at)
    .bind(payload.next_send_at)
    .fetch_one(&state.pool)
    .await;

    match result {
        Ok(r) => (StatusCode::CREATED, Json(r)).into_response(),
        Err(e) => {
            tracing::error!("Failed to create recurring email: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        },
    }
}

/// GET /api/v1/mail/emails/recurring
#[tracing::instrument(skip_all)]
pub async fn list_recurring(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let result = sqlx::query_as::<_, RecurringEmail>(
        "SELECT * FROM mail.recurring_emails WHERE user_id = $1 ORDER BY created_at DESC",
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await;

    match result {
        Ok(rows) => Json(rows).into_response(),
        Err(e) => {
            tracing::error!("Failed to list recurring emails: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        },
    }
}

/// PATCH /api/v1/mail/emails/recurring/:id
#[tracing::instrument(skip_all)]
pub async fn update_recurring(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateRecurringRequest>,
) -> impl IntoResponse {
    let result = sqlx::query_as::<_, RecurringEmail>(
        r#"UPDATE mail.recurring_emails
           SET recipient     = COALESCE($2, recipient),
               cc            = COALESCE($3, cc),
               bcc           = COALESCE($4, bcc),
               subject       = COALESCE($5, subject),
               body_text     = COALESCE($6, body_text),
               body_html     = COALESCE($7, body_html),
               cron_expr     = COALESCE($8, cron_expr),
               ends_at       = COALESCE($9, ends_at),
               next_send_at  = COALESCE($10, next_send_at),
               is_active     = COALESCE($11, is_active),
               updated_at    = NOW()
           WHERE id = $1 AND user_id = $12
           RETURNING *"#,
    )
    .bind(id)
    .bind(&payload.recipient)
    .bind(&payload.cc)
    .bind(&payload.bcc)
    .bind(&payload.subject)
    .bind(&payload.body_text)
    .bind(&payload.body_html)
    .bind(&payload.cron_expr)
    .bind(payload.ends_at)
    .bind(payload.next_send_at)
    .bind(payload.is_active)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await;

    match result {
        Ok(Some(r)) => Json(r).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Recurring schedule not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to update recurring email {}: {}", id, e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        },
    }
}

/// DELETE /api/v1/mail/emails/recurring/:id
#[tracing::instrument(skip_all)]
pub async fn delete_recurring(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let result = sqlx::query("DELETE FROM mail.recurring_emails WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(&state.pool)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => StatusCode::NO_CONTENT.into_response(),
        Ok(_) => (StatusCode::NOT_FOUND, "Recurring schedule not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to delete recurring email {}: {}", id, e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        },
    }
}
