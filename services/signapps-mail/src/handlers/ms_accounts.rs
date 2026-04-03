//! Mailserver account management handlers (admin).
//!
//! Manages local mailbox accounts on the built-in mail server.
//! Prefixed `ms_` to distinguish from user-facing IMAP account management
//! in [`super::accounts`].

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/// A local mailserver account (mailbox).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct MsAccount {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Domain this account belongs to.
    pub domain_id: Uuid,
    /// Full email address (e.g. `user@example.com`).
    pub address: String,
    /// Display name.
    pub display_name: Option<String>,
    /// Whether the account is active.
    pub is_active: Option<bool>,
    /// Storage quota in bytes (NULL = unlimited).
    pub quota_bytes: Option<i64>,
    /// Current storage usage in bytes.
    pub used_bytes: Option<i64>,
    /// Row creation timestamp.
    pub created_at: Option<DateTime<Utc>>,
    /// Row last-update timestamp.
    pub updated_at: Option<DateTime<Utc>>,
}

/// Request to create a mailserver account.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateMsAccountRequest {
    /// Domain ID to create the account under.
    pub domain_id: Uuid,
    /// Full email address.
    pub address: String,
    /// Display name.
    pub display_name: Option<String>,
    /// Password (will be hashed with Argon2).
    pub password: String,
    /// Storage quota in bytes (optional).
    pub quota_bytes: Option<i64>,
}

/// Request to change a mailserver account password.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct ChangePasswordRequest {
    /// New password (will be hashed with Argon2).
    pub password: String,
}

/// Quota usage information.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct QuotaInfo {
    /// Storage quota in bytes (NULL = unlimited).
    pub quota_bytes: Option<i64>,
    /// Current storage usage in bytes.
    pub used_bytes: i64,
    /// Usage percentage (0.0–100.0, or null if no quota).
    pub usage_percent: Option<f64>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// List all mailserver accounts.
///
/// # Errors
///
/// Returns 500 on database failure.
///
/// # Panics
///
/// None.
#[utoipa::path(
    get,
    path = "/api/v1/mailserver/accounts",
    tag = "mailserver-accounts",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of accounts", body = Vec<MsAccount>),
        (status = 500, description = "Internal server error"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_ms_accounts(State(state): State<AppState>) -> impl IntoResponse {
    match sqlx::query_as::<_, MsAccount>(
        "SELECT id, domain_id, address, display_name, is_active, quota_bytes, \
         used_bytes, created_at, updated_at \
         FROM mailserver.accounts ORDER BY address",
    )
    .fetch_all(&state.pool)
    .await
    {
        Ok(accounts) => Json(serde_json::json!({ "accounts": accounts })).into_response(),
        Err(e) => {
            tracing::error!("Failed to list mailserver accounts: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to list accounts" })),
            )
                .into_response()
        },
    }
}

/// Create a mailserver account.
///
/// Hashes the password with Argon2 before storing.
///
/// # Errors
///
/// Returns 400 if address already exists, 500 on database or hash failure.
///
/// # Panics
///
/// None.
#[utoipa::path(
    post,
    path = "/api/v1/mailserver/accounts",
    tag = "mailserver-accounts",
    security(("bearerAuth" = [])),
    request_body = CreateMsAccountRequest,
    responses(
        (status = 201, description = "Account created", body = MsAccount),
        (status = 400, description = "Account already exists"),
        (status = 500, description = "Internal server error"),
    )
)]
#[tracing::instrument(skip_all, fields(address = %payload.address))]
pub async fn create_ms_account(
    State(state): State<AppState>,
    Json(payload): Json<CreateMsAccountRequest>,
) -> impl IntoResponse {
    // Hash password with Argon2
    let password_hash = match hash_password(&payload.password) {
        Ok(h) => h,
        Err(e) => {
            tracing::error!("Password hashing failed: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Password hashing failed" })),
            )
                .into_response();
        },
    };

    match sqlx::query_as::<_, MsAccount>(
        r#"INSERT INTO mailserver.accounts
               (domain_id, address, display_name, password_hash, is_active, quota_bytes)
           VALUES ($1, $2, $3, $4, true, $5)
           RETURNING id, domain_id, address, display_name, is_active, quota_bytes,
                     used_bytes, created_at, updated_at"#,
    )
    .bind(payload.domain_id)
    .bind(&payload.address)
    .bind(&payload.display_name)
    .bind(&password_hash)
    .bind(payload.quota_bytes)
    .fetch_one(&state.pool)
    .await
    {
        Ok(account) => (StatusCode::CREATED, Json(account)).into_response(),
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("duplicate") || msg.contains("unique") {
                (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({ "error": "Account already exists" })),
                )
                    .into_response()
            } else {
                tracing::error!("Failed to create account: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({ "error": "Failed to create account" })),
                )
                    .into_response()
            }
        },
    }
}

/// Delete a mailserver account.
///
/// # Errors
///
/// Returns 404 if account not found.
///
/// # Panics
///
/// None.
#[utoipa::path(
    delete,
    path = "/api/v1/mailserver/accounts/{id}",
    tag = "mailserver-accounts",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Account ID")),
    responses(
        (status = 200, description = "Account deleted"),
        (status = 404, description = "Account not found"),
    )
)]
#[tracing::instrument(skip(state), fields(account_id = %id))]
pub async fn delete_ms_account(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query("DELETE FROM mailserver.accounts WHERE id = $1 RETURNING id")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
    {
        Ok(Some(_)) => {
            tracing::info!(account_id = %id, "Mailserver account deleted");
            Json(serde_json::json!({ "success": true })).into_response()
        },
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Account not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("Failed to delete account: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to delete account" })),
            )
                .into_response()
        },
    }
}

/// Change password for a mailserver account.
///
/// # Errors
///
/// Returns 404 if account not found, 500 on hash failure.
///
/// # Panics
///
/// None.
#[utoipa::path(
    put,
    path = "/api/v1/mailserver/accounts/{id}/password",
    tag = "mailserver-accounts",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Account ID")),
    request_body = ChangePasswordRequest,
    responses(
        (status = 200, description = "Password changed"),
        (status = 404, description = "Account not found"),
    )
)]
#[tracing::instrument(skip(state, payload), fields(account_id = %id))]
pub async fn change_password(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<ChangePasswordRequest>,
) -> impl IntoResponse {
    let password_hash = match hash_password(&payload.password) {
        Ok(h) => h,
        Err(e) => {
            tracing::error!("Password hashing failed: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Password hashing failed" })),
            )
                .into_response();
        },
    };

    match sqlx::query(
        "UPDATE mailserver.accounts SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id",
    )
    .bind(&password_hash)
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(_)) => {
            tracing::info!(account_id = %id, "Password changed");
            Json(serde_json::json!({ "success": true })).into_response()
        },
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Account not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("Failed to change password: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to change password" })),
            )
                .into_response()
        },
    }
}

/// Get quota usage for a mailserver account.
///
/// # Errors
///
/// Returns 404 if account not found.
///
/// # Panics
///
/// None.
#[utoipa::path(
    get,
    path = "/api/v1/mailserver/accounts/{id}/quota",
    tag = "mailserver-accounts",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Account ID")),
    responses(
        (status = 200, description = "Quota usage", body = QuotaInfo),
        (status = 404, description = "Account not found"),
    )
)]
#[tracing::instrument(skip(state), fields(account_id = %id))]
pub async fn get_quota(State(state): State<AppState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    #[derive(sqlx::FromRow)]
    struct QuotaRow {
        quota_bytes: Option<i64>,
        used_bytes: Option<i64>,
    }

    match sqlx::query_as::<_, QuotaRow>(
        "SELECT quota_bytes, used_bytes FROM mailserver.accounts WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(row)) => {
            let used = row.used_bytes.unwrap_or(0);
            let usage_percent = row.quota_bytes.map(|q| {
                if q > 0 {
                    (used as f64 / q as f64) * 100.0
                } else {
                    0.0
                }
            });

            Json(QuotaInfo {
                quota_bytes: row.quota_bytes,
                used_bytes: used,
                usage_percent,
            })
            .into_response()
        },
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Account not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("Failed to get quota: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to get quota" })),
            )
                .into_response()
        },
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Hash a password with Argon2id.
fn hash_password(password: &str) -> Result<String, String> {
    use argon2::{
        password_hash::{rand_core::OsRng, SaltString},
        Argon2, PasswordHasher,
    };
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| format!("Argon2 hash failed: {e}"))
}
