use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;
use uuid::Uuid;

use crate::models::MailAccount;
use crate::AppState;

use super::accounts_connection::{test_imap_connection, test_smtp_connection};

#[derive(Debug, Deserialize, utoipa::ToSchema)]
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

#[derive(Debug, Deserialize, utoipa::ToSchema)]
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

#[derive(Serialize)]
pub(crate) struct TestResult {
    pub imap_ok: bool,
    pub smtp_ok: bool,
    pub imap_error: Option<String>,
    pub smtp_error: Option<String>,
    pub imap_folders: Option<Vec<String>>,
    pub imap_server: Option<String>,
    pub smtp_server: Option<String>,
}

/// List all mail accounts for the current user.
#[utoipa::path(
    get,
    path = "/api/v1/mail/accounts",
    tag = "mail-accounts",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of mail accounts", body = Vec<crate::models::MailAccount>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_accounts(
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

/// Get a mail account by ID.
#[utoipa::path(
    get,
    path = "/api/v1/mail/accounts/{id}",
    tag = "mail-accounts",
    security(("bearerAuth" = [])),
    params(("id" = uuid::Uuid, Path, description = "Account UUID")),
    responses(
        (status = 200, description = "Mail account", body = crate::models::MailAccount),
        (status = 404, description = "Account not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn get_account(
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
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Database error" })),
        )
            .into_response()
    });

    match account {
        Ok(Some(acc)) => Json(acc).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Account not found" })),
        )
            .into_response(),
        Err(e) => e,
    }
}

/// Create a new mail account (IMAP/SMTP or OAuth2).
#[utoipa::path(
    post,
    path = "/api/v1/mail/accounts",
    tag = "mail-accounts",
    security(("bearerAuth" = [])),
    request_body = CreateAccountRequest,
    responses(
        (status = 201, description = "Account created", body = crate::models::MailAccount),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn create_account(
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
        "internal" => {
            // Internal Stalwart Mail Server — use configured host/port
            let imap_h = crate::handlers::internal_server::stalwart_imap_host();
            let imap_p = crate::handlers::internal_server::stalwart_imap_port();
            let smtp_h = crate::handlers::internal_server::stalwart_smtp_host();
            let smtp_p = crate::handlers::internal_server::stalwart_smtp_port();
            (Some(imap_h), Some(imap_p), Some(smtp_h), Some(smtp_p))
        },
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

/// Update an existing mail account.
#[utoipa::path(
    patch,
    path = "/api/v1/mail/accounts/{id}",
    tag = "mail-accounts",
    security(("bearerAuth" = [])),
    params(("id" = uuid::Uuid, Path, description = "Account UUID")),
    request_body = UpdateAccountRequest,
    responses(
        (status = 200, description = "Account updated", body = crate::models::MailAccount),
        (status = 404, description = "Account not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn update_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateAccountRequest>,
) -> impl IntoResponse {
    if let Some(interval) = payload.sync_interval_minutes {
        if !(1..=1440).contains(&interval) {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "sync_interval_minutes must be between 1 and 1440" }))).into_response();
        }
    }

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
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Account not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("Failed to update account: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to update" })),
            )
                .into_response()
        },
    }
}

/// Delete a mail account.
#[utoipa::path(
    delete,
    path = "/api/v1/mail/accounts/{id}",
    tag = "mail-accounts",
    security(("bearerAuth" = [])),
    params(("id" = uuid::Uuid, Path, description = "Account UUID")),
    responses(
        (status = 204, description = "Account deleted"),
        (status = 404, description = "Account not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn delete_account(
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
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Account not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("Failed to delete account: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to delete" })),
            )
                .into_response()
        },
    }
}

/// Trigger an immediate IMAP sync for a mail account.
#[utoipa::path(
    post,
    path = "/api/v1/mail/accounts/{id}/sync",
    tag = "mail-accounts",
    security(("bearerAuth" = [])),
    params(("id" = uuid::Uuid, Path, description = "Account UUID")),
    responses(
        (status = 200, description = "Sync triggered"),
        (status = 404, description = "Account not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn sync_account_now(
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
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Account not found" })),
            )
                .into_response()
        },
        Err(e) => {
            tracing::error!("Failed to fetch account for sync: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response();
        },
    };

    // Trigger sync in background with a global timeout
    let pool = state.pool.clone();
    let event_bus = state.event_bus.clone();
    tokio::spawn(async move {
        let timeout_secs = 120u64;
        match tokio::time::timeout(
            std::time::Duration::from_secs(timeout_secs),
            crate::sync_service::sync_account(&pool, &account, &event_bus),
        )
        .await
        {
            Ok(Ok(())) => {},
            Ok(Err(e)) => {
                tracing::error!("Sync failed for account {}: {:?}", account.email_address, e);
            },
            Err(_) => {
                tracing::error!(
                    "Sync timed out after {}s for account {}",
                    timeout_secs,
                    account.email_address
                );
            },
        }
    });

    Json(serde_json::json!({ "status": "sync_started" })).into_response()
}

#[tracing::instrument(skip_all)]
pub async fn test_account(
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
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Account not found" })),
            )
                .into_response()
        },
        Err(e) => {
            tracing::error!("Failed to fetch account for test: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response();
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
