use axum::{
    extract::{Multipart, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Extension, Json, Router,
};
use chrono::Utc;
use lettre::{
    address::Envelope,
    message::{Mailbox, MultiPart, SinglePart},
    transport::smtp::authentication::Credentials,
    Address, AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;
use uuid::Uuid;

use crate::handlers::aliases::{
    create_alias, delete_alias, list_aliases, set_default_alias, update_alias,
};
use crate::handlers::categorize::{categorize_inbox, save_categorize_settings};
use crate::handlers::delegation::{create_delegation, list_delegations, revoke_delegation};
use crate::handlers::pgp::{delete_pgp_config, get_pgp_config, upsert_pgp_config};
use crate::handlers::recurring::{
    create_recurring, delete_recurring, list_recurring, update_recurring,
};
use crate::handlers::rules::{create_rule, delete_rule, get_rule, list_rules, update_rule};
use crate::handlers::signatures::{get_signature, upsert_signature};
use crate::handlers::spam::{classify_email, get_spam_settings, train_spam, update_spam_settings};
use crate::handlers::templates::{
    create_template, delete_template, get_template, list_templates, update_template,
};
use crate::handlers::tracking::{list_tracking, tracking_stats};
use crate::models::{Attachment, Email, MailAccount, MailFolder, MailLabel};
use crate::AppState;

/// Append a row to `platform.activities` — fire-and-forget, never fails the request.
async fn log_mail_activity(
    pool: &sqlx::PgPool,
    actor_id: Uuid,
    action: &str,
    entity_id: Uuid,
    entity_title: &str,
) {
    let _ = sqlx::query(
        r#"INSERT INTO platform.activities
           (id, actor_id, action, entity_type, entity_id, entity_title, metadata, workspace_id)
           VALUES (gen_uuid_v7(), $1, $2, 'mail_message', $3, $4, '{}', NULL)"#,
    )
    .bind(actor_id)
    .bind(action)
    .bind(entity_id)
    .bind(entity_title)
    .execute(pool)
    .await;
}

pub fn router() -> Router<AppState> {
    Router::new()
        // Accounts
        .route("/api/v1/mail/accounts", get(list_accounts).post(create_account))
        .route(
            "/api/v1/mail/accounts/:id",
            get(get_account).patch(update_account).delete(delete_account),
        )
        .route("/api/v1/mail/accounts/:id/sync", post(sync_account_now))
        .route("/api/v1/mail/accounts/:id/test", post(test_account))
        // Folders
        .route("/api/v1/mail/folders", get(list_folders))
        .route("/api/v1/mail/folders/:id", get(get_folder))
        // Emails
        .route("/api/v1/mail/emails", get(list_emails).post(send_email))
        .route(
            "/api/v1/mail/emails/:id",
            get(get_email).patch(update_email).delete(delete_email),
        )
        .route("/api/v1/mail/emails/:id/attachments", get(list_attachments))
        // Labels
        .route("/api/v1/mail/labels", get(list_labels).post(create_label))
        .route(
            "/api/v1/mail/labels/:id",
            patch(update_label).delete(delete_label),
        )
        // Signatures
        .route(
            "/api/v1/mail/signatures/me",
            get(get_signature).put(upsert_signature),
        )
        // Rules
        .route("/api/v1/mail/rules", get(list_rules).post(create_rule))
        .route(
            "/api/v1/mail/rules/:id",
            get(get_rule).put(update_rule).delete(delete_rule),
        )
        // Spam Filter
        .route("/api/v1/mail/spam/classify", post(classify_email))
        .route("/api/v1/mail/spam/train", post(train_spam))
        .route(
            "/api/v1/mail/spam/settings/:account_id",
            get(get_spam_settings).patch(update_spam_settings),
        )
        // Email templates — AQ-EMTPL
        .route(
            "/api/v1/mail/templates",
            get(list_templates).post(create_template),
        )
        .route(
            "/api/v1/mail/templates/:id",
            get(get_template).put(update_template).delete(delete_template),
        )
        // Search
        .route("/api/v1/mail/search", get(search_emails))
        // Stats
        .route("/api/v1/mail/stats", get(get_stats))
        // PGP config (public key + settings; private key stays client-side)
        .route(
            "/api/v1/mail/accounts/:account_id/pgp",
            get(get_pgp_config).put(upsert_pgp_config).delete(delete_pgp_config),
        )
        // Priority scoring (IDEA-107)
        .route(
            "/api/v1/mail/emails/:id/priority-score",
            axum::routing::post(crate::handlers::priority::score_single),
        )
        .route(
            "/api/v1/mail/priority-score/batch",
            axum::routing::post(crate::handlers::priority::score_batch),
        )
        // AI Inbox Categorization (Ideas #31 & #33)
        .route(
            "/api/v1/mail/emails/categorize",
            axum::routing::post(categorize_inbox),
        )
        .route(
            "/api/v1/mail/emails/categorize/settings",
            axum::routing::post(save_categorize_settings),
        )
        // Newsletter send (IDEA-039)
        .route(
            "/api/v1/mail/newsletters/send",
            axum::routing::post(send_newsletter),
        )
        // OAuth provider routes (M7)
        .route("/oauth/google/login", axum::routing::get(crate::auth::oauth_google_login))
        .route(
            "/oauth/google/callback",
            axum::routing::post(crate::auth::oauth_google_callback),
        )
        .route(
            "/oauth/microsoft/login",
            axum::routing::get(crate::auth::oauth_microsoft_login),
        )
        .route(
            "/oauth/microsoft/callback",
            axum::routing::post(crate::auth::oauth_microsoft_callback),
        )
        // Recurring emails (IDEA-263)
        .route(
            "/api/v1/mail/emails/recurring",
            get(list_recurring).post(create_recurring),
        )
        .route(
            "/api/v1/mail/emails/recurring/:id",
            patch(update_recurring).delete(delete_recurring),
        )
        // Read tracking (IDEA-265) — authenticated endpoints
        .route("/api/v1/mail/emails/tracking", get(list_tracking))
        .route("/api/v1/mail/emails/tracking/stats", get(tracking_stats))
        // Email aliases (IDEA-261)
        .route(
            "/api/v1/mail/accounts/:id/aliases",
            get(list_aliases).post(create_alias),
        )
        .route(
            "/api/v1/mail/accounts/:id/aliases/:alias_id",
            patch(update_alias).delete(delete_alias),
        )
        .route(
            "/api/v1/mail/accounts/:id/aliases/:alias_id/set-default",
            post(set_default_alias),
        )
        // Email delegation (IDEA-264)
        .route(
            "/api/v1/mail/accounts/:id/delegations",
            get(list_delegations).post(create_delegation),
        )
        .route(
            "/api/v1/mail/accounts/:id/delegations/:delegation_id",
            axum::routing::delete(revoke_delegation),
        )
        // MG4: MBOX import
        .route("/api/v1/mail/import/mbox", post(import_mbox))
        // Analytics (IDEA-analytics)
        .route("/api/v1/mail/analytics", get(mail_analytics))
        // Thread grouping (IDEA-threads)
        .route("/api/v1/mail/threads", get(list_threads))
        // Undo-send: cancel a pending scheduled email
        .route("/api/v1/mail/emails/:id/cancel-send", post(cancel_send))
}

// =============================================================================
// MG4 — MBOX import handler
// =============================================================================

/// POST /api/v1/mail/import/mbox
///
/// Accepts a multipart form upload with an `.mbox` file (field name: "file").
/// Parses each message (delimited by "From " lines), extracts headers + body,
/// and inserts into `mail.emails`.
///
/// Returns `{ imported, failed }`.
async fn import_mbox(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let mut mbox_bytes: Vec<u8> = Vec::new();

    while let Ok(Some(field)) = multipart.next_field().await {
        if field.name().unwrap_or("") == "file" {
            match field.bytes().await {
                Ok(b) => {
                    mbox_bytes = b.to_vec();
                    break;
                },
                Err(e) => {
                    tracing::error!("Failed to read MBOX field: {e}");
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(serde_json::json!({ "error": "Failed to read uploaded file" })),
                    );
                },
            }
        }
    }

    if mbox_bytes.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "No file field found in multipart body" })),
        );
    }

    let content = match std::str::from_utf8(&mbox_bytes) {
        Ok(s) => s.to_string(),
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "MBOX file must be UTF-8 encoded" })),
            )
        },
    };

    // Split MBOX into individual messages. Each message starts with a "From " line.
    let messages = split_mbox(&content);
    let total = messages.len();
    let mut imported = 0u32;
    let mut failed = 0u32;

    for raw_msg in messages {
        // Try to find the first account for this user to attach imports to
        let account_id: Option<uuid::Uuid> =
            sqlx::query_scalar("SELECT id FROM mail.accounts WHERE user_id = $1 LIMIT 1")
                .bind(claims.sub)
                .fetch_optional(&state.pool)
                .await
                .ok()
                .flatten();

        let Some(account_id) = account_id else {
            failed += 1;
            continue;
        };

        // Parse headers from the raw message
        let (subject, sender, recipients, body) = parse_mbox_message(&raw_msg);

        let res = sqlx::query(
            r#"INSERT INTO mail.emails
               (id, account_id, folder_id, message_id, subject, sender, recipients,
                body_text, body_html, is_read, is_sent, is_deleted, is_starred,
                is_draft, attachments, labels, received_at, created_at, updated_at)
               VALUES
               (gen_random_uuid(), $1, NULL, NULL, $2, $3, $4,
                $5, NULL, false, false, false, false,
                false, '[]', '[]', NOW(), NOW(), NOW())"#,
        )
        .bind(account_id)
        .bind(&subject)
        .bind(&sender)
        .bind(serde_json::json!(recipients))
        .bind(&body)
        .execute(&state.pool)
        .await;

        match res {
            Ok(_) => imported += 1,
            Err(e) => {
                tracing::warn!("Failed to insert MBOX message: {e}");
                failed += 1;
            },
        }
    }

    tracing::info!(user = %claims.sub, total, imported, failed, "MBOX import completed");
    (
        StatusCode::OK,
        Json(serde_json::json!({ "imported": imported, "failed": failed, "total": total })),
    )
}

/// Split raw MBOX content into individual message strings.
/// MBOX messages are separated by "From " lines at the start of a line.
fn split_mbox(content: &str) -> Vec<String> {
    let mut messages: Vec<String> = Vec::new();
    let mut current: Vec<&str> = Vec::new();

    for line in content.lines() {
        if line.starts_with("From ") && !current.is_empty() {
            messages.push(current.join("\n"));
            current.clear();
        }
        current.push(line);
    }
    if !current.is_empty() {
        messages.push(current.join("\n"));
    }

    messages
}

/// Parse a single MBOX message. Returns (subject, sender, recipients, body).
fn parse_mbox_message(raw: &str) -> (String, String, Vec<String>, String) {
    let mut subject = String::new();
    let mut sender = String::new();
    let mut recipients: Vec<String> = Vec::new();
    let mut in_headers = true;
    let mut body_lines: Vec<&str> = Vec::new();

    for line in raw.lines() {
        if in_headers {
            if line.is_empty() {
                in_headers = false;
                continue;
            }
            let lower = line.to_lowercase();
            if lower.starts_with("subject:") {
                subject = line[8..].trim().to_string();
            } else if lower.starts_with("from:") {
                sender = line[5..].trim().to_string();
            } else if lower.starts_with("to:") {
                let to = line[3..].trim();
                recipients.extend(to.split(',').map(|s| s.trim().to_string()));
            }
        } else {
            body_lines.push(line);
        }
    }

    let body = body_lines.join("\n");
    (subject, sender, recipients, body)
}

fn patch<H, T, S>(handler: H) -> axum::routing::MethodRouter<S>
where
    H: axum::handler::Handler<T, S>,
    T: 'static,
    S: Clone + Send + Sync + 'static,
{
    axum::routing::patch(handler)
}

#[allow(dead_code)]
fn put<H, T, S>(handler: H) -> axum::routing::MethodRouter<S>
where
    H: axum::handler::Handler<T, S>,
    T: 'static,
    S: Clone + Send + Sync + 'static,
{
    axum::routing::put(handler)
}

// ============================================================================
// Accounts
// ============================================================================

#[derive(Debug, Deserialize)]
/// Request payload for CreateAccount operation.
pub struct CreateAccountRequest {
    pub email_address: String,
    pub display_name: Option<String>,
    pub provider: String,
    pub imap_server: Option<String>,
    pub imap_port: Option<i32>,
    pub imap_use_tls: Option<bool>,
    pub smtp_server: Option<String>,
    pub smtp_port: Option<i32>,
    pub smtp_use_tls: Option<bool>,
    pub app_password: Option<String>,
}

#[derive(Debug, Deserialize)]
/// Request payload for UpdateAccount operation.
pub struct UpdateAccountRequest {
    pub display_name: Option<String>,
    pub imap_server: Option<String>,
    pub imap_port: Option<i32>,
    pub imap_use_tls: Option<bool>,
    pub smtp_server: Option<String>,
    pub smtp_port: Option<i32>,
    pub smtp_use_tls: Option<bool>,
    pub app_password: Option<String>,
    pub signature_html: Option<String>,
    pub signature_text: Option<String>,
    pub sync_interval_minutes: Option<i32>,
    pub status: Option<String>,
}

async fn list_accounts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let accounts = sqlx::query_as::<_, MailAccount>(
        "SELECT * FROM mail.accounts WHERE user_id = $1 ORDER BY created_at DESC",
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    Json(accounts)
}

async fn get_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let account = sqlx::query_as::<_, MailAccount>(
        "SELECT * FROM mail.accounts WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch mail account: {:?}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response()
    });

    match account {
        Ok(Some(acc)) => Json(acc).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Account not found").into_response(),
        Err(e) => e,
    }
}

async fn create_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateAccountRequest>,
) -> impl IntoResponse {
    // Set provider-specific defaults
    let (imap_server, imap_port, smtp_server, smtp_port) = match payload.provider.as_str() {
        "gmail" => (
            Some("imap.gmail.com".to_string()),
            Some(993),
            Some("smtp.gmail.com".to_string()),
            Some(587),
        ),
        "outlook" => (
            Some("outlook.office365.com".to_string()),
            Some(993),
            Some("smtp.office365.com".to_string()),
            Some(587),
        ),
        _ => (
            payload.imap_server,
            payload.imap_port.or(Some(993)),
            payload.smtp_server,
            payload.smtp_port.or(Some(587)),
        ),
    };

    let imap_use_tls = payload.imap_use_tls.unwrap_or(true);
    let smtp_use_tls = payload.smtp_use_tls.unwrap_or(true);

    let account = sqlx::query_as::<_, MailAccount>(
        r#"
        INSERT INTO mail.accounts (
            user_id, email_address, display_name, provider,
            imap_server, imap_port, imap_use_tls, smtp_server, smtp_port, smtp_use_tls,
            app_password, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active')
        RETURNING *
        "#,
    )
    .bind(claims.sub)
    .bind(&payload.email_address)
    .bind(&payload.display_name)
    .bind(&payload.provider)
    .bind(&imap_server)
    .bind(imap_port)
    .bind(imap_use_tls)
    .bind(&smtp_server)
    .bind(smtp_port)
    .bind(smtp_use_tls)
    .bind(&payload.app_password)
    .fetch_one(&state.pool)
    .await;

    match account {
        Ok(acc) => (StatusCode::CREATED, Json(acc)).into_response(),
        Err(e) => {
            tracing::error!("Failed to create mail account: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to create account",
            )
                .into_response()
        },
    }
}

async fn update_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateAccountRequest>,
) -> impl IntoResponse {
    let account = sqlx::query_as::<_, MailAccount>(
        r#"
        UPDATE mail.accounts SET
            display_name = COALESCE($1, display_name),
            imap_server = COALESCE($2, imap_server),
            imap_port = COALESCE($3, imap_port),
            imap_use_tls = COALESCE($4, imap_use_tls),
            smtp_server = COALESCE($5, smtp_server),
            smtp_port = COALESCE($6, smtp_port),
            smtp_use_tls = COALESCE($7, smtp_use_tls),
            app_password = COALESCE($8, app_password),
            signature_html = COALESCE($9, signature_html),
            signature_text = COALESCE($10, signature_text),
            sync_interval_minutes = COALESCE($11, sync_interval_minutes),
            status = COALESCE($12, status),
            updated_at = NOW()
        WHERE id = $13 AND user_id = $14
        RETURNING *
        "#,
    )
    .bind(&payload.display_name)
    .bind(&payload.imap_server)
    .bind(payload.imap_port)
    .bind(payload.imap_use_tls)
    .bind(&payload.smtp_server)
    .bind(payload.smtp_port)
    .bind(payload.smtp_use_tls)
    .bind(&payload.app_password)
    .bind(&payload.signature_html)
    .bind(&payload.signature_text)
    .bind(payload.sync_interval_minutes)
    .bind(&payload.status)
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await;

    match account {
        Ok(Some(acc)) => Json(acc).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Account not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to update account: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update").into_response()
        },
    }
}

async fn delete_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let result = sqlx::query("DELETE FROM mail.accounts WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(&state.pool)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => StatusCode::NO_CONTENT.into_response(),
        Ok(_) => (StatusCode::NOT_FOUND, "Account not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to delete account: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to delete").into_response()
        },
    }
}

async fn sync_account_now(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    // Get account
    let account = match sqlx::query_as::<_, MailAccount>(
        "SELECT * FROM mail.accounts WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(acc)) => acc,
        Ok(None) => return (StatusCode::NOT_FOUND, "Account not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to fetch account for sync: {:?}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response();
        },
    };

    // Trigger sync in background
    let pool = state.pool.clone();
    let event_bus = state.event_bus.clone();
    tokio::spawn(async move {
        if let Err(e) = crate::sync_service::sync_account(&pool, &account, &event_bus).await {
            tracing::error!("Sync failed for account {}: {:?}", account.email_address, e);
        }
    });

    Json(serde_json::json!({ "status": "sync_started" })).into_response()
}

#[derive(Serialize)]
struct TestResult {
    imap_ok: bool,
    smtp_ok: bool,
    imap_error: Option<String>,
    smtp_error: Option<String>,
    imap_folders: Option<Vec<String>>,
    imap_server: Option<String>,
    smtp_server: Option<String>,
}

async fn test_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let account = match sqlx::query_as::<_, MailAccount>(
        "SELECT * FROM mail.accounts WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(acc)) => acc,
        Ok(None) => return (StatusCode::NOT_FOUND, "Account not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to fetch account for test: {:?}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response();
        },
    };

    // Test SMTP
    let (smtp_ok, smtp_error) = test_smtp_connection(&account).await;

    // Test IMAP
    let (imap_ok, imap_error, imap_folders) = test_imap_connection(&account).await;

    Json(TestResult {
        imap_ok,
        smtp_ok,
        imap_error,
        smtp_error,
        imap_folders,
        imap_server: account.imap_server.clone(),
        smtp_server: account.smtp_server.clone(),
    })
    .into_response()
}

async fn test_smtp_connection(account: &MailAccount) -> (bool, Option<String>) {
    let Some(ref smtp_server) = account.smtp_server else {
        return (false, Some("SMTP server not configured".to_string()));
    };
    let smtp_port = account.smtp_port.unwrap_or(587) as u16;
    let use_tls = account.smtp_use_tls.unwrap_or(true);

    let mailer_result: Result<AsyncSmtpTransport<Tokio1Executor>, _> = if use_tls {
        let Some(ref password) = account.app_password else {
            return (false, Some("App password not set".to_string()));
        };
        let creds = Credentials::new(account.email_address.clone(), password.clone());
        AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(smtp_server)
            .map(|builder| builder.credentials(creds).port(smtp_port).build())
    } else {
        Ok(
            AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(smtp_server)
                .port(smtp_port)
                .build(),
        )
    };

    match mailer_result {
        Ok(mailer) => match mailer.test_connection().await {
            Ok(true) => (true, None),
            Ok(false) => (false, Some("Connection test returned false".to_string())),
            Err(e) => (false, Some(e.to_string())),
        },
        Err(e) => (false, Some(e.to_string())),
    }
}

async fn test_imap_connection(
    account: &MailAccount,
) -> (bool, Option<String>, Option<Vec<String>>) {
    use futures_util::StreamExt;

    let Some(ref imap_server) = account.imap_server else {
        return (false, Some("IMAP server not configured".to_string()), None);
    };
    let Some(ref password) = account.app_password else {
        return (false, Some("App password not set".to_string()), None);
    };

    let imap_port = account.imap_port.unwrap_or(993) as u16;

    // Build TLS connector
    let tls_result = native_tls::TlsConnector::builder()
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .build();

    let tls = match tls_result {
        Ok(tls) => tokio_native_tls::TlsConnector::from(tls),
        Err(e) => return (false, Some(format!("TLS error: {}", e)), None),
    };

    // Connect to IMAP server
    let tcp_stream = match tokio::net::TcpStream::connect((imap_server.as_str(), imap_port)).await {
        Ok(stream) => stream,
        Err(e) => return (false, Some(format!("Connection failed: {}", e)), None),
    };

    let tls_stream = match tls.connect(imap_server.as_str(), tcp_stream).await {
        Ok(stream) => stream,
        Err(e) => return (false, Some(format!("TLS handshake failed: {}", e)), None),
    };

    let client = async_imap::Client::new(tls_stream);

    // Try to login
    let mut session = match client.login(&account.email_address, password).await {
        Ok(session) => session,
        Err((e, _)) => return (false, Some(format!("Login failed: {}", e)), None),
    };

    // List folders to verify connection works
    let stream = match session.list(None, Some("*")).await {
        Ok(s) => s,
        Err(e) => {
            // Connection will be dropped automatically
            return (false, Some(format!("Failed to list folders: {}", e)), None);
        },
    };

    let folder_names: Vec<String> = stream
        .filter_map(|item| async move { item.ok().map(|f| f.name().to_string()) })
        .collect()
        .await;

    // Stream is consumed, now we can logout
    let _ = session.logout().await;

    (true, None, Some(folder_names))
}

// ============================================================================
// Folders
// ============================================================================

#[derive(Debug, Deserialize)]
/// Query parameters for filtering and pagination.
pub struct FolderQuery {
    pub account_id: Option<Uuid>,
}

async fn list_folders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<FolderQuery>,
) -> impl IntoResponse {
    let folders = if let Some(account_id) = query.account_id {
        sqlx::query_as::<_, MailFolder>(
            r#"
            SELECT f.* FROM mail.folders f
            JOIN mail.accounts a ON a.id = f.account_id
            WHERE f.account_id = $1 AND a.user_id = $2
            ORDER BY f.folder_type, f.name
            "#,
        )
        .bind(account_id)
        .bind(claims.sub)
        .fetch_all(&state.pool)
        .await
    } else {
        sqlx::query_as::<_, MailFolder>(
            r#"
            SELECT f.* FROM mail.folders f
            JOIN mail.accounts a ON a.id = f.account_id
            WHERE a.user_id = $1
            ORDER BY a.email_address, f.folder_type, f.name
            "#,
        )
        .bind(claims.sub)
        .fetch_all(&state.pool)
        .await
    };

    Json(folders.unwrap_or_default())
}

async fn get_folder(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let folder = match sqlx::query_as::<_, MailFolder>(
        r#"
        SELECT f.* FROM mail.folders f
        JOIN mail.accounts a ON a.id = f.account_id
        WHERE f.id = $1 AND a.user_id = $2
        "#,
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::error!("Failed to fetch folder: {:?}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response();
        },
    };

    match folder {
        Some(f) => Json(f).into_response(),
        None => (StatusCode::NOT_FOUND, "Folder not found").into_response(),
    }
}

// ============================================================================
// Emails
// ============================================================================

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

async fn list_emails(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<EmailQuery>,
) -> impl IntoResponse {
    let limit = query.limit.unwrap_or(50).min(200);
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

async fn get_email(
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
            return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response();
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
        None => (StatusCode::NOT_FOUND, "Email not found").into_response(),
    }
}

#[derive(Debug, Deserialize)]
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

async fn send_email(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<SendEmailRequest>,
) -> impl IntoResponse {
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
        Ok(None) => return (StatusCode::NOT_FOUND, "Account not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to fetch account for send: {:?}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response();
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
            return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response();
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
            return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to save email").into_response();
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
async fn send_via_smtp(
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

#[derive(Debug, Deserialize)]
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

async fn update_email(
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
        Ok(None) => (StatusCode::NOT_FOUND, "Email not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to update email: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update").into_response()
        },
    }
}

async fn delete_email(
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
        Ok(_) => (StatusCode::NOT_FOUND, "Email not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to delete email: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to delete").into_response()
        },
    }
}

async fn list_attachments(
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
        "#,
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    Json(attachments)
}

// ============================================================================
// Labels
// ============================================================================

async fn list_labels(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<FolderQuery>,
) -> impl IntoResponse {
    let labels = if let Some(account_id) = query.account_id {
        sqlx::query_as::<_, MailLabel>(
            r#"
            SELECT l.* FROM mail.labels l
            JOIN mail.accounts a ON a.id = l.account_id
            WHERE l.account_id = $1 AND a.user_id = $2
            ORDER BY l.name
            "#,
        )
        .bind(account_id)
        .bind(claims.sub)
        .fetch_all(&state.pool)
        .await
    } else {
        sqlx::query_as::<_, MailLabel>(
            r#"
            SELECT l.* FROM mail.labels l
            JOIN mail.accounts a ON a.id = l.account_id
            WHERE a.user_id = $1
            ORDER BY l.name
            "#,
        )
        .bind(claims.sub)
        .fetch_all(&state.pool)
        .await
    };

    Json(labels.unwrap_or_default())
}

#[derive(Debug, Deserialize)]
/// Request payload for CreateLabel operation.
pub struct CreateLabelRequest {
    pub account_id: Uuid,
    pub name: String,
    pub color: Option<String>,
}

async fn create_label(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateLabelRequest>,
) -> impl IntoResponse {
    // Verify account ownership
    let account = match sqlx::query_as::<_, MailAccount>(
        "SELECT * FROM mail.accounts WHERE id = $1 AND user_id = $2",
    )
    .bind(payload.account_id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::error!("Failed to verify account ownership: {:?}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response();
        },
    };

    if account.is_none() {
        return (StatusCode::NOT_FOUND, "Account not found").into_response();
    }

    let label = sqlx::query_as::<_, MailLabel>(
        "INSERT INTO mail.labels (account_id, name, color) VALUES ($1, $2, $3) RETURNING *",
    )
    .bind(payload.account_id)
    .bind(&payload.name)
    .bind(&payload.color)
    .fetch_one(&state.pool)
    .await;

    match label {
        Ok(l) => (StatusCode::CREATED, Json(l)).into_response(),
        Err(e) => {
            tracing::error!("Failed to create label: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create label").into_response()
        },
    }
}

#[derive(Debug, Deserialize)]
/// Request payload for UpdateLabel operation.
pub struct UpdateLabelRequest {
    pub name: Option<String>,
    pub color: Option<String>,
}

async fn update_label(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateLabelRequest>,
) -> impl IntoResponse {
    let label = sqlx::query_as::<_, MailLabel>(
        r#"
        UPDATE mail.labels SET
            name = COALESCE($1, name),
            color = COALESCE($2, color)
        WHERE id = $3 AND account_id IN (
            SELECT id FROM mail.accounts WHERE user_id = $4
        )
        RETURNING *
        "#,
    )
    .bind(&payload.name)
    .bind(&payload.color)
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await;

    match label {
        Ok(Some(l)) => Json(l).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Label not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to update label: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update").into_response()
        },
    }
}

async fn delete_label(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let result = sqlx::query(
        r#"
        DELETE FROM mail.labels
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
        Ok(r) if r.rows_affected() > 0 => StatusCode::NO_CONTENT.into_response(),
        Ok(_) => (StatusCode::NOT_FOUND, "Label not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to delete label: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to delete").into_response()
        },
    }
}

// ============================================================================
// Search
// ============================================================================

#[derive(Debug, Deserialize)]
/// Query parameters for filtering and pagination.
pub struct SearchQuery {
    pub q: String,
    pub account_id: Option<Uuid>,
    pub limit: Option<i64>,
}

async fn search_emails(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<SearchQuery>,
) -> impl IntoResponse {
    let limit = query.limit.unwrap_or(50).min(200);
    let emails = sqlx::query_as::<_, Email>(
        r#"
        SELECT e.* FROM mail.emails e
        JOIN mail.accounts a ON a.id = e.account_id
        WHERE a.user_id = $1
        AND ($2::UUID IS NULL OR e.account_id = $2)
        AND (
            e.search_vector @@ plainto_tsquery('french', $3)
            OR e.subject ILIKE '%' || $3 || '%'
        )
        ORDER BY COALESCE(e.received_at, e.created_at) DESC
        LIMIT $4
        "#,
    )
    .bind(claims.sub)
    .bind(query.account_id)
    .bind(&query.q)
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    Json(emails)
}

// ============================================================================
// Stats
// ============================================================================

#[derive(Serialize)]
/// Represents a mail stats.
pub struct MailStats {
    pub total_accounts: i64,
    pub total_emails: i64,
    pub unread_count: i64,
    pub starred_count: i64,
    pub draft_count: i64,
}

async fn get_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let total_accounts: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM mail.accounts WHERE user_id = $1")
            .bind(claims.sub)
            .fetch_one(&state.pool)
            .await
            .unwrap_or((0,));

    let total_emails: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*) FROM mail.emails e
        JOIN mail.accounts a ON a.id = e.account_id
        WHERE a.user_id = $1 AND COALESCE(e.is_deleted, false) = false
        "#,
    )
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await
    .unwrap_or((0,));

    let unread_count: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*) FROM mail.emails e
        JOIN mail.accounts a ON a.id = e.account_id
        WHERE a.user_id = $1 AND COALESCE(e.is_read, false) = false
        AND COALESCE(e.is_deleted, false) = false
        "#,
    )
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await
    .unwrap_or((0,));

    let starred_count: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*) FROM mail.emails e
        JOIN mail.accounts a ON a.id = e.account_id
        WHERE a.user_id = $1 AND e.is_starred = true
        AND COALESCE(e.is_deleted, false) = false
        "#,
    )
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await
    .unwrap_or((0,));

    let draft_count: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*) FROM mail.emails e
        JOIN mail.accounts a ON a.id = e.account_id
        WHERE a.user_id = $1 AND e.is_draft = true
        "#,
    )
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await
    .unwrap_or((0,));

    Json(MailStats {
        total_accounts: total_accounts.0,
        total_emails: total_emails.0,
        unread_count: unread_count.0,
        starred_count: starred_count.0,
        draft_count: draft_count.0,
    })
}

// ============================================================================
// Scheduled send background job (Idea 21)
// ============================================================================

/// Process emails whose `scheduled_send_at` has arrived. Called every 30s from main.rs.
#[tracing::instrument(skip_all)]
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

// ============================================================================
// Newsletter send (IDEA-039, M5)
// ============================================================================

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

async fn send_newsletter(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<SendNewsletterRequest>,
) -> impl IntoResponse {
    if payload.subject.is_empty() {
        return (StatusCode::UNPROCESSABLE_ENTITY, "Subject is required").into_response();
    }
    if payload.recipient_list.is_empty() {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            "recipient_list must not be empty",
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
        Ok(None) => return (StatusCode::NOT_FOUND, "Account not found").into_response(),
        Err(e) => {
            tracing::error!("Newsletter: failed to fetch account: {:?}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response();
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

// ============================================================================
// Mail Analytics (IDEA-analytics)
// ============================================================================

/// GET /api/v1/mail/analytics
///
/// Returns 30-day send/receive/read stats and top senders for the authenticated user.
async fn mail_analytics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    // Get user's account IDs
    let accounts: Vec<Uuid> = sqlx::query_scalar("SELECT id FROM mail.accounts WHERE user_id = $1")
        .bind(claims.sub)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

    if accounts.is_empty() {
        return Json(serde_json::json!({
            "sent_30d": 0,
            "received_30d": 0,
            "read_rate": 0,
            "top_senders": []
        }))
        .into_response();
    }

    // Sent last 30 days
    let sent: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM mail.emails \
         WHERE account_id = ANY($1) AND is_sent = true \
           AND created_at > now() - interval '30 days'",
    )
    .bind(&accounts)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    // Received last 30 days
    let received: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM mail.emails \
         WHERE account_id = ANY($1) AND is_sent = false \
           AND created_at > now() - interval '30 days'",
    )
    .bind(&accounts)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    // Read count
    let read: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM mail.emails \
         WHERE account_id = ANY($1) AND is_sent = false AND is_read = true \
           AND created_at > now() - interval '30 days'",
    )
    .bind(&accounts)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let read_rate = if received > 0 {
        (read as f64 / received as f64 * 100.0).round()
    } else {
        0.0
    };

    // Top 5 senders
    let top_senders: Vec<(String, i64)> = sqlx::query_as(
        "SELECT sender, COUNT(*) as cnt FROM mail.emails \
         WHERE account_id = ANY($1) AND is_sent = false \
           AND created_at > now() - interval '30 days' \
         GROUP BY sender ORDER BY cnt DESC LIMIT 5",
    )
    .bind(&accounts)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    Json(serde_json::json!({
        "sent_30d": sent,
        "received_30d": received,
        "read_rate": read_rate,
        "top_senders": top_senders
            .iter()
            .map(|(s, c)| serde_json::json!({"sender": s, "count": c}))
            .collect::<Vec<_>>(),
    }))
    .into_response()
}

// ============================================================================
// Mail Thread Grouping (IDEA-threads)
// ============================================================================

#[derive(Debug, Deserialize)]
/// Query parameters for thread listing.
pub struct ThreadQuery {
    pub folder_id: Option<Uuid>,
    pub account_id: Option<Uuid>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// GET /api/v1/mail/threads?folder_id=X
///
/// Returns emails grouped by thread_id, one row per thread (the latest message).
/// Ordered by most-recent message descending.
async fn list_threads(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ThreadQuery>,
) -> impl IntoResponse {
    let limit = query.limit.unwrap_or(50).min(200);
    let offset = query.offset.unwrap_or(0);

    let threads = sqlx::query_as::<_, Email>(
        r#"
        SELECT DISTINCT ON (COALESCE(e.thread_id, e.id)) e.*
        FROM mail.emails e
        JOIN mail.accounts a ON a.id = e.account_id
        WHERE a.user_id = $1
          AND ($2::UUID IS NULL OR e.account_id = $2)
          AND ($3::UUID IS NULL OR e.folder_id = $3)
          AND COALESCE(e.is_deleted, false) = false
        ORDER BY COALESCE(e.thread_id, e.id), COALESCE(e.received_at, e.created_at) DESC
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

    Json(threads).into_response()
}

// ============================================================================
// Undo-send: cancel a pending scheduled email (IDEA-undo-send)
// ============================================================================

/// POST /api/v1/mail/emails/:id/cancel-send
///
/// Cancels a pending send by clearing `scheduled_send_at` and reverting to draft.
/// Only works while the email is still in the send buffer (scheduled_send_at IS NOT NULL).
async fn cancel_send(
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
        Ok(None) => return (StatusCode::NOT_FOUND, "Email not found").into_response(),
        Err(e) => {
            tracing::error!("cancel_send: DB error fetching email: {:?}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response();
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
            (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response()
        },
    }
}
