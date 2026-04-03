use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use chrono::Utc;
use lettre::{
    address::Envelope,
    message::{Mailbox, MultiPart, SinglePart},
    transport::smtp::authentication::Credentials,
    Address, AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
};
use serde::Deserialize;
use signapps_common::Claims;
use uuid::Uuid;

use crate::models::{Email, MailAccount, MailFolder};
use crate::AppState;

use super::utils::log_mail_activity;

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for SendEmail operation.
pub struct SendEmailRequest {
    pub account_id: Uuid,
    pub recipient: String,
    pub cc: Option<String>,
    pub bcc: Option<String>,
    pub subject: String,
    pub body_text: Option<String>,
    pub body_html: Option<String>,
    pub in_reply_to: Option<String>,
    pub is_draft: Option<bool>,
    pub scheduled_send_at: Option<chrono::DateTime<Utc>>,
}

/// Send an email or save it as a draft.
#[utoipa::path(
    post,
    path = "/api/v1/mail/emails",
    tag = "mail-emails",
    security(("bearerAuth" = [])),
    request_body = SendEmailRequest,
    responses(
        (status = 200, description = "Email sent or queued", body = crate::models::Email),
        (status = 400, description = "Invalid request"),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn send_email(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<SendEmailRequest>,
) -> impl IntoResponse {
    if payload.recipient.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Recipient is required" })),
        )
            .into_response();
    }
    if !payload.recipient.contains('@') {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Invalid recipient email format" })),
        )
            .into_response();
    }

    if payload.subject.len() > 998 {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Subject too long (max 998 chars per RFC 5322)" })),
        )
            .into_response();
    }

    // Get account
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
            tracing::error!("Failed to fetch account for send: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response();
        },
    };

    // If draft, just save to database
    let is_draft = payload.is_draft.unwrap_or(false);

    // Get the sent folder
    let sent_folder = match sqlx::query_as::<_, MailFolder>(
        "SELECT * FROM mail.folders WHERE account_id = $1 AND folder_type = $2",
    )
    .bind(account.id)
    .bind(if is_draft { "drafts" } else { "sent" })
    .fetch_optional(&state.pool)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::error!("Failed to fetch folder for send: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response();
        },
    };

    let folder_id = sent_folder.map(|f| f.id);

    // Create snippet
    let snippet = payload
        .body_text
        .as_ref()
        .map(|t| t.chars().take(200).collect::<String>());

    // Generate message ID
    let message_id = format!("<{}@signapps.local>", Uuid::new_v4());

    // Inject a read-tracking pixel into HTML emails (IDEA-265).
    // A pre-allocated UUID lets us create the email_opens row in the same TX.
    let tracking_id = Uuid::new_v4();
    let tracked_body_html: Option<String> = payload.body_html.as_ref().map(|html| {
        let pixel = format!(
            r#"<img src="/api/v1/mail/track/{}" width="1" height="1" style="display:none" alt="">"#,
            tracking_id
        );
        format!("{}{}", html, pixel)
    });

    // For non-draft emails, use a 10-second send buffer to allow undo-send.
    // The scheduled-send background job (runs every 30s) picks them up and
    // sends via SMTP. Users can cancel within ~10-30 seconds via cancel-send.
    let effective_scheduled_send_at = if !is_draft {
        payload
            .scheduled_send_at
            .or_else(|| Some(Utc::now() + chrono::Duration::seconds(10)))
    } else {
        payload.scheduled_send_at
    };

    // Insert email record
    let email = sqlx::query_as::<_, Email>(
        r#"
        INSERT INTO mail.emails (
            account_id, folder_id, message_id, sender, sender_name, recipient, cc, bcc,
            subject, body_text, body_html, snippet, is_draft, is_sent, sent_at, in_reply_to,
            scheduled_send_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
        "#,
    )
    .bind(account.id)
    .bind(folder_id)
    .bind(&message_id)
    .bind(&account.email_address)
    .bind(&account.display_name)
    .bind(&payload.recipient)
    .bind(&payload.cc)
    .bind(&payload.bcc)
    .bind(&payload.subject)
    .bind(&payload.body_text)
    .bind(&tracked_body_html)
    .bind(&snippet)
    .bind(true) // always stored as draft until the background job sends it
    .bind(false) // not yet sent
    .bind(None::<chrono::DateTime<Utc>>) // sent_at set by background job
    .bind(&payload.in_reply_to)
    .bind(effective_scheduled_send_at)
    .fetch_one(&state.pool)
    .await;

    let email = match email {
        Ok(e) => e,
        Err(e) => {
            tracing::error!("Failed to save email: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to save email" })),
            )
                .into_response();
        },
    };

    // Insert a tracking record for HTML emails (fire-and-forget — never blocks send).
    if tracked_body_html.is_some() {
        let _ = sqlx::query(
            r#"INSERT INTO mail.email_opens
               (tracking_id, email_id, account_id, user_id)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (tracking_id) DO NOTHING"#,
        )
        .bind(tracking_id)
        .bind(email.id)
        .bind(account.id)
        .bind(claims.sub)
        .execute(&state.pool)
        .await;
    }

    // Non-draft emails are buffered via scheduled_send_at and dispatched
    // by the background job (process_scheduled_emails).  This gives the user
    // a ~10-30 second window to cancel via POST .../cancel-send.

    log_mail_activity(
        &state.pool,
        claims.sub,
        "sent",
        email.id,
        email.subject.as_deref().unwrap_or(""),
    )
    .await;

    (StatusCode::CREATED, Json(email)).into_response()
}

/// Send an email message via SMTP.
///
/// `body_html_override`: when Some, used instead of payload.body_html (e.g. with tracking pixel).
pub async fn send_via_smtp(
    account: &MailAccount,
    payload: &SendEmailRequest,
    body_html_override: Option<&str>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let smtp_server = account
        .smtp_server
        .as_ref()
        .ok_or("SMTP server not configured")?;

    let from: Mailbox = account.email_address.parse()?;

    // Parse To addresses for both the message header and the SMTP envelope
    let mut to_mailboxes: Vec<Mailbox> = Vec::new();
    for addr in payload.recipient.split(',') {
        if let Ok(mb) = addr.trim().parse::<Mailbox>() {
            to_mailboxes.push(mb);
        }
    }
    if to_mailboxes.is_empty() {
        return Err("No valid To recipients".into());
    }

    let mut message_builder = Message::builder().from(from.clone());
    for mb in &to_mailboxes {
        message_builder = message_builder.to(mb.clone());
    }
    message_builder = message_builder.subject(&payload.subject);

    // Parse CC addresses — add to message header AND SMTP envelope (via lettre's auto-derivation)
    if let Some(ref cc) = payload.cc {
        for addr in cc.split(',') {
            if let Ok(mb) = addr.trim().parse::<Mailbox>() {
                message_builder = message_builder.cc(mb);
            }
        }
    }

    // Bug 8: BCC recipients — add via .bcc() so lettre includes them in the SMTP envelope
    // but drops the Bcc header from the outgoing message (lettre's default: drop_bcc = true).
    // This prevents BCC recipients from being visible to To/Cc recipients.
    if let Some(ref bcc) = payload.bcc {
        for addr in bcc.split(',') {
            if let Ok(mb) = addr.trim().parse::<Mailbox>() {
                message_builder = message_builder.bcc(mb);
            }
        }
    }

    // Build envelope explicitly: from + To + Cc + Bcc (all delivery recipients)
    // We construct this manually to make the BCC-only-in-envelope semantics explicit.
    let envelope_from: Address = account.email_address.parse()?;
    let mut envelope_to: Vec<Address> = Vec::new();
    for mb in &to_mailboxes {
        envelope_to.push(mb.email.clone());
    }
    if let Some(ref cc) = payload.cc {
        for addr in cc.split(',') {
            if let Ok(mb) = addr.trim().parse::<Mailbox>() {
                envelope_to.push(mb.email.clone());
            }
        }
    }
    if let Some(ref bcc) = payload.bcc {
        for addr in bcc.split(',') {
            if let Ok(mb) = addr.trim().parse::<Mailbox>() {
                envelope_to.push(mb.email.clone());
            }
        }
    }
    let envelope = Envelope::new(Some(envelope_from), envelope_to)
        .map_err(|e| format!("Invalid SMTP envelope: {}", e))?;
    message_builder = message_builder.envelope(envelope);

    // Build body — use the override (with tracking pixel) when available.
    let effective_html = body_html_override.or(payload.body_html.as_deref());
    let email = if let Some(html) = effective_html {
        let text = payload.body_text.clone().unwrap_or_default();
        message_builder.multipart(
            MultiPart::alternative()
                .singlepart(SinglePart::plain(text))
                .singlepart(SinglePart::html(html.to_string())),
        )?
    } else {
        let text = payload.body_text.clone().unwrap_or_default();
        message_builder.body(text)?
    };

    let smtp_port = account.smtp_port.unwrap_or(587) as u16;
    let use_tls = account.smtp_use_tls.unwrap_or(true);

    let mailer = if use_tls {
        // TLS mode with authentication
        let password = account
            .app_password
            .as_ref()
            .ok_or("App password not set")?;
        let creds = Credentials::new(account.email_address.clone(), password.clone());
        AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(smtp_server)?
            .credentials(creds)
            .port(smtp_port)
            .build()
    } else {
        // Plain mode (no TLS, optional auth) — for local/test servers like Mailpit
        let mut builder =
            AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(smtp_server).port(smtp_port);
        if let Some(ref password) = account.app_password {
            if !password.is_empty() {
                let creds = Credentials::new(account.email_address.clone(), password.clone());
                builder = builder.credentials(creds);
            }
        }
        builder.build()
    };

    mailer.send(email).await?;

    Ok(())
}
