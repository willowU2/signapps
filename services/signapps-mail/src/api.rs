use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::models::{Email, MailAccount};
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/mail", get(list_emails).post(send_email))
        .route("/api/v1/mail/:id", get(get_email).patch(update_email))
        .route(
            "/api/v1/mail/accounts",
            get(list_accounts).post(create_account),
        )
}

// --- Email Handlers ---

#[derive(Debug, Deserialize)]
struct CreateEmail {
    sender: String,
    recipient: String,
    subject: String,
    body: String,
    folder: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateEmail {
    is_read: Option<bool>,
    is_archived: Option<bool>,
    is_deleted: Option<bool>,
    labels: Option<Vec<String>>,
    snoozed_until: Option<chrono::DateTime<chrono::Utc>>,
    subject: Option<String>,
    body: Option<String>,
    recipient: Option<String>,
    folder: Option<String>,
}

async fn list_emails(State(state): State<AppState>) -> impl IntoResponse {
    let emails = sqlx::query_as::<_, Email>("SELECT * FROM emails ORDER BY created_at DESC")
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

    Json(emails)
}

async fn send_email(
    State(state): State<AppState>,
    Json(payload): Json<CreateEmail>,
) -> impl IntoResponse {
    let email = sqlx::query_as::<_, Email>(
        "INSERT INTO emails (sender, recipient, subject, body, folder, is_read, is_archived, is_deleted) VALUES ($1, $2, $3, $4, COALESCE($5, 'sent'), false, false, false) RETURNING *",
    )
    .bind(payload.sender)
    .bind(payload.recipient)
    .bind(payload.subject)
    .bind(payload.body)
    .bind(payload.folder)
    .fetch_one(&state.pool)
    .await;

    match email {
        Ok(email) => (StatusCode::CREATED, Json(email)).into_response(),
        Err(e) => {
            tracing::error!("Failed to send email: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to send email").into_response()
        },
    }
}

async fn get_email(State(state): State<AppState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    let email = sqlx::query_as::<_, Email>("SELECT * FROM emails WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .unwrap();

    match email {
        Some(email) => Json(email).into_response(),
        None => (StatusCode::NOT_FOUND, "Email not found").into_response(),
    }
}

async fn update_email(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateEmail>,
) -> impl IntoResponse {
    let email: Result<Option<Email>, sqlx::Error> = sqlx::query_as::<_, Email>(
        r#"
        UPDATE emails
        SET is_read = COALESCE($1::BOOLEAN, is_read),
            is_archived = COALESCE($2::BOOLEAN, is_archived),
            is_deleted = COALESCE($3::BOOLEAN, is_deleted),
            labels = COALESCE($4::TEXT[], labels),
            snoozed_until = COALESCE($5::TIMESTAMPTZ, snoozed_until),
            subject = COALESCE($6, subject),
            body = COALESCE($7, body),
            recipient = COALESCE($8, recipient),
            folder = COALESCE($9, folder)
        WHERE id = $10
        RETURNING *
        "#,
    )
    .bind(payload.is_read)
    .bind(payload.is_archived)
    .bind(payload.is_deleted)
    .bind(payload.labels)
    .bind(payload.snoozed_until)
    .bind(payload.subject)
    .bind(payload.body)
    .bind(payload.recipient)
    .bind(payload.folder)
    .bind(id)
    .fetch_optional(&state.pool)
    .await;

    match email {
        Ok(Some(email)) => Json(email).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Email not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to update email: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update email").into_response()
        },
    }
}

// --- Account Handlers ---

#[derive(Debug, Deserialize)]
struct CreateAccount {
    user_id: Uuid,
    email_address: String,
    provider: String,
    imap_server: Option<String>,
    imap_port: Option<i32>,
    smtp_server: Option<String>,
    smtp_port: Option<i32>,
    app_password: Option<String>,
}

async fn list_accounts(State(state): State<AppState>) -> impl IntoResponse {
    // For MVP, return all. Really should be filtered by user context.
    let accounts =
        sqlx::query_as::<_, MailAccount>("SELECT * FROM mail_accounts ORDER BY created_at DESC")
            .fetch_all(&state.pool)
            .await
            .unwrap_or_default();

    Json(accounts)
}

async fn create_account(
    State(state): State<AppState>,
    Json(payload): Json<CreateAccount>,
) -> impl IntoResponse {
    let account = sqlx::query_as::<_, MailAccount>(
        r#"
        INSERT INTO mail_accounts (
            user_id, email_address, provider, imap_server, imap_port, smtp_server, smtp_port, app_password
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#,
    )
    .bind(payload.user_id)
    .bind(payload.email_address)
    .bind(payload.provider)
    .bind(payload.imap_server)
    .bind(payload.imap_port)
    .bind(payload.smtp_server)
    .bind(payload.smtp_port)
    .bind(payload.app_password)
    .fetch_one(&state.pool)
    .await;

    match account {
        Ok(account) => {
            // Kick off an immediate sync here or let the cron job pick it up
            (StatusCode::CREATED, Json(account)).into_response()
        },
        Err(e) => {
            tracing::error!("Failed to create mail account: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to connect to email provider",
            )
                .into_response()
        },
    }
}
