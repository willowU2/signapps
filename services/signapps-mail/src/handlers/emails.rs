use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
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

use crate::models::{Attachment, Email, MailAccount, MailFolder};
use crate::AppState;

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
    pub snoozed_until: Option<chrono::DateTime<Utc>>,
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
        WHERE a.user_id = $1
        AND ($2::UUID IS NULL OR e.account_id = $2)
        AND ($3::UUID IS NULL OR e.folder_id = $3)
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

// `body_html_override`: when Some, used instead of payload.body_html (e.g. with tracking pixel).
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
