use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use serde::Deserialize;
use signapps_common::Claims;
use uuid::Uuid;

use crate::models::{Attachment, Email};
use crate::AppState;

pub use super::email_send::{send_email, send_via_smtp, SendEmailRequest};

use super::utils::log_mail_activity;

#[derive(Debug, Deserialize)]
/// Query parameters for filtering and pagination.
pub struct EmailQuery {
    pub account_id: Option<Uuid>,
    pub folder_id: Option<Uuid>,
    pub folder_type: Option<String>,
    pub is_read: Option<bool>,
    pub is_starred: Option<bool>,
    pub label: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for UpdateEmail operation.
pub struct UpdateEmailRequest {
    pub is_read: Option<bool>,
    pub is_starred: Option<bool>,
    pub is_important: Option<bool>,
    pub is_archived: Option<bool>,
    pub is_deleted: Option<bool>,
    pub labels: Option<Vec<String>>,
    pub folder_id: Option<Uuid>,
    pub snoozed_until: Option<chrono::DateTime<chrono::Utc>>,
    pub subject: Option<String>,
    pub body_text: Option<String>,
    pub body_html: Option<String>,
}

/// List emails for the current user with optional filtering.
#[utoipa::path(
    get,
    path = "/api/v1/mail/emails",
    tag = "mail-emails",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of emails", body = Vec<crate::models::Email>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_emails(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<EmailQuery>,
) -> impl IntoResponse {
    let limit = query.limit.unwrap_or(50).min(1000);
    let offset = query.offset.unwrap_or(0);

    let emails = sqlx::query_as::<_, Email>(
        r#"
        SELECT e.* FROM mail.emails e
        JOIN mail.accounts a ON a.id = e.account_id
        LEFT JOIN mail.folders f ON f.id = e.folder_id
        WHERE a.user_id = $1
        AND ($2::UUID IS NULL OR e.account_id = $2)
        AND ($3::UUID IS NULL OR e.folder_id = $3)
        AND ($6::TEXT IS NULL OR f.folder_type = $6)
        AND COALESCE(e.is_deleted, false) = false
        ORDER BY COALESCE(e.received_at, e.created_at) DESC
        LIMIT $4 OFFSET $5
        "#,
    )
    .bind(claims.sub)
    .bind(query.account_id)
    .bind(query.folder_id)
    .bind(limit)
    .bind(offset)
    .bind(query.folder_type.as_deref())
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    Json(emails)
}

/// Get a single email by ID (marks it as read).
#[utoipa::path(
    get,
    path = "/api/v1/mail/emails/{id}",
    tag = "mail-emails",
    security(("bearerAuth" = [])),
    params(("id" = uuid::Uuid, Path, description = "Email UUID")),
    responses(
        (status = 200, description = "Email message", body = crate::models::Email),
        (status = 404, description = "Email not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn get_email(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let email = match sqlx::query_as::<_, Email>(
        r#"
        SELECT e.* FROM mail.emails e
        JOIN mail.accounts a ON a.id = e.account_id
        WHERE e.id = $1 AND a.user_id = $2
        "#,
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::error!("Failed to fetch email: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response();
        },
    };

    match email {
        Some(e) => {
            // Mark as read if not already
            let _ = sqlx::query("UPDATE mail.emails SET is_read = true WHERE id = $1")
                .bind(id)
                .execute(&state.pool)
                .await;
            Json(e).into_response()
        },
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Email not found" })),
        )
            .into_response(),
    }
}

/// Update an email (read status, labels, folder, snooze, etc.).
#[utoipa::path(
    patch,
    path = "/api/v1/mail/emails/{id}",
    tag = "mail-emails",
    security(("bearerAuth" = [])),
    params(("id" = uuid::Uuid, Path, description = "Email UUID")),
    request_body = UpdateEmailRequest,
    responses(
        (status = 200, description = "Email updated", body = crate::models::Email),
        (status = 404, description = "Email not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn update_email(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateEmailRequest>,
) -> impl IntoResponse {
    let email = sqlx::query_as::<_, Email>(
        r#"
        UPDATE mail.emails SET
            is_read = COALESCE($1, is_read),
            is_starred = COALESCE($2, is_starred),
            is_important = COALESCE($3, is_important),
            is_archived = COALESCE($4, is_archived),
            is_deleted = COALESCE($5, is_deleted),
            labels = COALESCE($6, labels),
            folder_id = COALESCE($7, folder_id),
            snoozed_until = $8,
            subject = COALESCE($9, subject),
            body_text = COALESCE($10, body_text),
            body_html = COALESCE($11, body_html),
            updated_at = NOW()
        WHERE id = $12 AND account_id IN (
            SELECT id FROM mail.accounts WHERE user_id = $13
        )
        RETURNING *
        "#,
    )
    .bind(payload.is_read)
    .bind(payload.is_starred)
    .bind(payload.is_important)
    .bind(payload.is_archived)
    .bind(payload.is_deleted)
    .bind(&payload.labels)
    .bind(payload.folder_id)
    .bind(payload.snoozed_until)
    .bind(&payload.subject)
    .bind(&payload.body_text)
    .bind(&payload.body_html)
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await;

    match email {
        Ok(Some(e)) => Json(e).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Email not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("Failed to update email: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to update" })),
            )
                .into_response()
        },
    }
}

/// Soft-delete an email (moves to trash).
#[utoipa::path(
    delete,
    path = "/api/v1/mail/emails/{id}",
    tag = "mail-emails",
    security(("bearerAuth" = [])),
    params(("id" = uuid::Uuid, Path, description = "Email UUID")),
    responses(
        (status = 204, description = "Email deleted"),
        (status = 404, description = "Email not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn delete_email(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    // Soft delete by moving to trash
    let result = sqlx::query(
        r#"
        UPDATE mail.emails SET is_deleted = true, updated_at = NOW()
        WHERE id = $1 AND account_id IN (
            SELECT id FROM mail.accounts WHERE user_id = $2
        )
        "#,
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&state.pool)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            log_mail_activity(&state.pool, claims.sub, "deleted", id, "").await;
            StatusCode::NO_CONTENT.into_response()
        },
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Email not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("Failed to delete email: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to delete" })),
            )
                .into_response()
        },
    }
}

/// List attachments for an email.
#[utoipa::path(
    get,
    path = "/api/v1/mail/emails/{id}/attachments",
    tag = "mail-emails",
    security(("bearerAuth" = [])),
    params(("id" = uuid::Uuid, Path, description = "Email UUID")),
    responses(
        (status = 200, description = "List of attachments", body = Vec<crate::models::Attachment>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_attachments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let attachments = sqlx::query_as::<_, Attachment>(
        r#"
        SELECT att.* FROM mail.attachments att
        JOIN mail.emails e ON e.id = att.email_id
        JOIN mail.accounts a ON a.id = e.account_id
        WHERE e.id = $1 AND a.user_id = $2
        ORDER BY att.created_at
        LIMIT 100
        "#,
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    Json(attachments)
}
