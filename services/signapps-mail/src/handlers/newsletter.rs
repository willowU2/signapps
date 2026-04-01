use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;
use uuid::Uuid;

use crate::models::MailAccount;
use crate::AppState;

use super::emails::{send_via_smtp, SendEmailRequest};

#[derive(Debug, Deserialize)]
/// Request payload for SendNewsletter operation.
pub struct SendNewsletterRequest {
    pub account_id: Uuid,
    pub subject: String,
    pub html_body: String,
    pub recipient_list: Vec<String>,
}

#[derive(Serialize)]
struct SendNewsletterResponse {
    sent: usize,
    failed: usize,
}

#[tracing::instrument(skip_all)]
pub async fn send_newsletter(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<SendNewsletterRequest>,
) -> impl IntoResponse {
    if payload.subject.is_empty() {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(serde_json::json!({ "error": "Subject is required" })),
        )
            .into_response();
    }
    if payload.recipient_list.is_empty() {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(serde_json::json!({ "error": "recipient_list must not be empty" })),
        )
            .into_response();
    }

    // Fetch the sending account (must belong to the authenticated user)
    let account = match sqlx::query_as::<_, MailAccount>(
        "SELECT * FROM mail.accounts WHERE id = $1 AND user_id = $2",
    )
    .bind(payload.account_id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(acc)) => acc,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Account not found" })),
            )
                .into_response()
        },
        Err(e) => {
            tracing::error!("Newsletter: failed to fetch account: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response();
        },
    };

    let mut sent = 0usize;
    let mut failed = 0usize;

    for recipient in &payload.recipient_list {
        let smtp_payload = SendEmailRequest {
            account_id: payload.account_id,
            recipient: recipient.clone(),
            cc: None,
            bcc: None,
            subject: payload.subject.clone(),
            body_text: None,
            body_html: Some(payload.html_body.clone()),
            in_reply_to: None,
            is_draft: Some(false),
            scheduled_send_at: None,
        };

        match send_via_smtp(&account, &smtp_payload, None).await {
            Ok(_) => {
                sent += 1;
                tracing::info!(to = %recipient, subject = %payload.subject, "Newsletter sent");
            },
            Err(e) => {
                failed += 1;
                tracing::error!(to = %recipient, "Newsletter SMTP failed: {:?}", e);
            },
        }
    }

    (
        StatusCode::OK,
        Json(SendNewsletterResponse { sent, failed }),
    )
        .into_response()
}
