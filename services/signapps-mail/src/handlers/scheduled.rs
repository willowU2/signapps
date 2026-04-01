use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use signapps_common::Claims;
use uuid::Uuid;

use crate::models::{Email, MailAccount};
use crate::AppState;

use super::emails::{send_via_smtp, SendEmailRequest};

/// Process emails whose `scheduled_send_at` has arrived. Called every 30s from main.rs.
#[tracing::instrument(skip_all)]
pub async fn process_scheduled_emails(
    pool: &sqlx::PgPool,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let due_emails = sqlx::query_as::<_, Email>(
        "SELECT * FROM mail.emails \
         WHERE scheduled_send_at IS NOT NULL \
           AND scheduled_send_at <= now() \
           AND COALESCE(is_draft, false) = true \
           AND COALESCE(is_sent, false) = false",
    )
    .fetch_all(pool)
    .await?;

    for email in due_emails {
        let account = sqlx::query_as::<_, MailAccount>("SELECT * FROM mail.accounts WHERE id = $1")
            .bind(email.account_id)
            .fetch_optional(pool)
            .await?;

        if let Some(account) = account {
            // Build a SendEmailRequest from the stored Email row
            let payload = SendEmailRequest {
                account_id: email.account_id,
                recipient: email.recipient.clone(),
                cc: email.cc.clone(),
                bcc: email.bcc.clone(),
                subject: email.subject.clone().unwrap_or_default(),
                body_text: email.body_text.clone(),
                body_html: email.body_html.clone(),
                in_reply_to: email.in_reply_to.clone(),
                is_draft: Some(false),
                scheduled_send_at: None,
            };

            match send_via_smtp(&account, &payload, None).await {
                Ok(_) => {
                    sqlx::query(
                        "UPDATE mail.emails \
                         SET is_sent = true, is_draft = false, scheduled_send_at = NULL, \
                             sent_at = NOW(), updated_at = NOW() \
                         WHERE id = $1",
                    )
                    .bind(email.id)
                    .execute(pool)
                    .await?;
                    tracing::info!(email_id = %email.id, "Scheduled email sent successfully");
                },
                Err(e) => {
                    tracing::error!(email_id = %email.id, "Scheduled send failed: {}", e);
                    // Leave the email as-is so it will be retried on the next tick
                },
            }
        }
    }

    Ok(())
}

/// POST /api/v1/mail/emails/:id/cancel-send
///
/// Cancels a pending send by clearing `scheduled_send_at` and reverting to draft.
/// Only works while the email is still in the send buffer (scheduled_send_at IS NOT NULL).
#[tracing::instrument(skip_all)]
pub async fn cancel_send(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    // Verify ownership and that it is still buffered (not yet sent)
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
        Ok(Some(e)) => e,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Email not found" })),
            )
                .into_response()
        },
        Err(e) => {
            tracing::error!("cancel_send: DB error fetching email: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response();
        },
    };

    if email.scheduled_send_at.is_none() {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            "Email is not in the send buffer (already sent or not scheduled)",
        )
            .into_response();
    }

    match sqlx::query(
        "UPDATE mail.emails \
         SET scheduled_send_at = NULL, is_draft = true, is_sent = false, updated_at = NOW() \
         WHERE id = $1",
    )
    .bind(id)
    .execute(&state.pool)
    .await
    {
        Ok(_) => {
            tracing::info!(email_id = %id, user = %claims.sub, "Send cancelled — reverted to draft");
            (
                StatusCode::OK,
                Json(serde_json::json!({ "status": "cancelled", "id": id })),
            )
                .into_response()
        },
        Err(e) => {
            tracing::error!("cancel_send: DB update failed: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        },
    }
}
