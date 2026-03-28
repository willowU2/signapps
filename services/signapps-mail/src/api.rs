use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Extension, Json, Router,
};
use chrono::Utc;
use lettre::{
    message::{Mailbox, MultiPart, SinglePart},
    transport::smtp::authentication::Credentials,
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;
use uuid::Uuid;

use crate::handlers::pgp::{delete_pgp_config, get_pgp_config, upsert_pgp_config};
use crate::handlers::rules::{create_rule, delete_rule, get_rule, list_rules, update_rule};
use crate::handlers::signatures::{get_signature, upsert_signature};
use crate::handlers::spam::{classify_email, get_spam_settings, train_spam, update_spam_settings};
use crate::handlers::templates::{
    create_template, delete_template, get_template, list_templates, update_template,
};
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

    let account = sqlx::query_as::<_, MailAccount>(
        r#"
        INSERT INTO mail.accounts (
            user_id, email_address, display_name, provider,
            imap_server, imap_port, smtp_server, smtp_port, app_password, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
        RETURNING *
        "#,
    )
    .bind(claims.sub)
    .bind(&payload.email_address)
    .bind(&payload.display_name)
    .bind(&payload.provider)
    .bind(&imap_server)
    .bind(imap_port)
    .bind(&smtp_server)
    .bind(smtp_port)
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
            smtp_server = COALESCE($4, smtp_server),
            smtp_port = COALESCE($5, smtp_port),
            app_password = COALESCE($6, app_password),
            signature_html = COALESCE($7, signature_html),
            signature_text = COALESCE($8, signature_text),
            sync_interval_minutes = COALESCE($9, sync_interval_minutes),
            status = COALESCE($10, status),
            updated_at = NOW()
        WHERE id = $11 AND user_id = $12
        RETURNING *
        "#,
    )
    .bind(&payload.display_name)
    .bind(&payload.imap_server)
    .bind(payload.imap_port)
    .bind(&payload.smtp_server)
    .bind(payload.smtp_port)
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
    tokio::spawn(async move {
        if let Err(e) = crate::sync_service::sync_account(&pool, &account).await {
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
        Ok(AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(smtp_server)
            .port(smtp_port)
            .build())
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

    // Insert email record
    let email = sqlx::query_as::<_, Email>(
        r#"
        INSERT INTO mail.emails (
            account_id, folder_id, message_id, sender, sender_name, recipient, cc, bcc,
            subject, body_text, body_html, snippet, is_draft, is_sent, sent_at, in_reply_to
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
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
    .bind(&payload.body_html)
    .bind(&snippet)
    .bind(is_draft)
    .bind(!is_draft)
    .bind(if is_draft { None } else { Some(Utc::now()) })
    .bind(&payload.in_reply_to)
    .fetch_one(&state.pool)
    .await;

    let email = match email {
        Ok(e) => e,
        Err(e) => {
            tracing::error!("Failed to save email: {:?}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to save email").into_response();
        },
    };

    // Actually send via SMTP if not a draft
    if !is_draft {
        if let Err(e) = send_via_smtp(&account, &payload).await {
            tracing::error!("SMTP send failed: {:?}", e);
            // Mark as failed
            let _ = sqlx::query(
                "UPDATE mail.emails SET is_sent = false, is_draft = true WHERE id = $1",
            )
            .bind(email.id)
            .execute(&state.pool)
            .await;
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to send: {}", e),
            )
                .into_response();
        }
    }

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

async fn send_via_smtp(
    account: &MailAccount,
    payload: &SendEmailRequest,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let smtp_server = account
        .smtp_server
        .as_ref()
        .ok_or("SMTP server not configured")?;

    let from: Mailbox = account.email_address.parse()?;
    let to: Mailbox = payload.recipient.parse()?;

    let mut message_builder = Message::builder()
        .from(from)
        .to(to)
        .subject(&payload.subject);

    // Add CC
    if let Some(ref cc) = payload.cc {
        for addr in cc.split(',') {
            if let Ok(mailbox) = addr.trim().parse::<Mailbox>() {
                message_builder = message_builder.cc(mailbox);
            }
        }
    }

    // Build body
    let email = if let Some(ref html) = payload.body_html {
        let text = payload.body_text.clone().unwrap_or_default();
        message_builder.multipart(
            MultiPart::alternative()
                .singlepart(SinglePart::plain(text))
                .singlepart(SinglePart::html(html.clone())),
        )?
    } else {
        let text = payload.body_text.clone().unwrap_or_default();
        message_builder.body(text)?
    };

    let smtp_port = account.smtp_port.unwrap_or(587) as u16;
    let use_tls = account.smtp_use_tls.unwrap_or(true);

    let mailer = if use_tls {
        // TLS mode with authentication
        let password = account.app_password.as_ref().ok_or("App password not set")?;
        let creds = Credentials::new(account.email_address.clone(), password.clone());
        AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(smtp_server)?
            .credentials(creds)
            .port(smtp_port)
            .build()
    } else {
        // Plain mode (no TLS, optional auth) — for local/test servers like Mailpit
        let mut builder = AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(smtp_server)
            .port(smtp_port);
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
    let search_term = format!("%{}%", query.q);

    let emails = sqlx::query_as::<_, Email>(
        r#"
        SELECT e.* FROM mail.emails e
        JOIN mail.accounts a ON a.id = e.account_id
        WHERE a.user_id = $1
        AND ($2::UUID IS NULL OR e.account_id = $2)
        AND (
            e.subject ILIKE $3
            OR e.sender ILIKE $3
            OR e.recipient ILIKE $3
            OR e.body_text ILIKE $3
        )
        ORDER BY COALESCE(e.received_at, e.created_at) DESC
        LIMIT $4
        "#,
    )
    .bind(claims.sub)
    .bind(query.account_id)
    .bind(&search_term)
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
