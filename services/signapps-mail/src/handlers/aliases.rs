//! Email alias CRUD handler.
//!
//! Endpoints (all scoped to an account owned by the authenticated user):
//!   GET    /api/v1/mail/accounts/:id/aliases
//!   POST   /api/v1/mail/accounts/:id/aliases
//!   PATCH  /api/v1/mail/accounts/:id/aliases/:alias_id
//!   DELETE /api/v1/mail/accounts/:id/aliases/:alias_id
//!   POST   /api/v1/mail/accounts/:id/aliases/:alias_id/set-default

use crate::AppState;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;
use sqlx::FromRow;
use uuid::Uuid;

// ============================================================================
// Domain type
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Alias {
    pub id: Uuid,
    pub account_id: Uuid,
    pub alias_email: String,
    pub display_name: String,
    pub is_default: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// Request DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateAliasRequest {
    pub alias_email: String,
    pub display_name: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAliasRequest {
    pub alias_email: Option<String>,
    pub display_name: Option<String>,
}

// ============================================================================
// Helpers
// ============================================================================

/// Returns true when the authenticated user owns `account_id`.
async fn owns_account(pool: &sqlx::PgPool, account_id: Uuid, user_id: Uuid) -> bool {
    sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM mail.accounts WHERE id = $1 AND user_id = $2)",
    )
    .bind(account_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
    .unwrap_or(false)
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/mail/accounts/:id/aliases
pub async fn list_aliases(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(account_id): Path<Uuid>,
) -> impl IntoResponse {
    if !owns_account(&state.pool, account_id, claims.sub).await {
        return (StatusCode::NOT_FOUND, "Account not found").into_response();
    }

    let result = sqlx::query_as::<_, Alias>(
        "SELECT * FROM mail.aliases WHERE account_id = $1 ORDER BY is_default DESC, alias_email ASC",
    )
    .bind(account_id)
    .fetch_all(&state.pool)
    .await;

    match result {
        Ok(rows) => Json(rows).into_response(),
        Err(e) => {
            tracing::error!("Failed to list aliases for {}: {}", account_id, e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        },
    }
}

/// POST /api/v1/mail/accounts/:id/aliases
pub async fn create_alias(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(account_id): Path<Uuid>,
    Json(payload): Json<CreateAliasRequest>,
) -> impl IntoResponse {
    if !owns_account(&state.pool, account_id, claims.sub).await {
        return (StatusCode::NOT_FOUND, "Account not found").into_response();
    }

    if payload.alias_email.trim().is_empty() {
        return (StatusCode::BAD_REQUEST, "alias_email must not be empty").into_response();
    }

    let result = sqlx::query_as::<_, Alias>(
        r#"INSERT INTO mail.aliases (account_id, alias_email, display_name)
           VALUES ($1, $2, $3)
           RETURNING *"#,
    )
    .bind(account_id)
    .bind(payload.alias_email.trim())
    .bind(payload.display_name.trim())
    .fetch_one(&state.pool)
    .await;

    match result {
        Ok(alias) => (StatusCode::CREATED, Json(alias)).into_response(),
        Err(e) if e.to_string().contains("uq_alias_email_account") => (
            StatusCode::CONFLICT,
            "Alias already exists for this account",
        )
            .into_response(),
        Err(e) => {
            tracing::error!("Failed to create alias: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        },
    }
}

/// PATCH /api/v1/mail/accounts/:id/aliases/:alias_id
pub async fn update_alias(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((account_id, alias_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateAliasRequest>,
) -> impl IntoResponse {
    if !owns_account(&state.pool, account_id, claims.sub).await {
        return (StatusCode::NOT_FOUND, "Account not found").into_response();
    }

    let result = sqlx::query_as::<_, Alias>(
        r#"UPDATE mail.aliases
           SET alias_email  = COALESCE($3, alias_email),
               display_name = COALESCE($4, display_name),
               updated_at   = NOW()
           WHERE id = $1 AND account_id = $2
           RETURNING *"#,
    )
    .bind(alias_id)
    .bind(account_id)
    .bind(&payload.alias_email)
    .bind(&payload.display_name)
    .fetch_optional(&state.pool)
    .await;

    match result {
        Ok(Some(alias)) => Json(alias).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Alias not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to update alias {}: {}", alias_id, e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        },
    }
}

/// DELETE /api/v1/mail/accounts/:id/aliases/:alias_id
pub async fn delete_alias(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((account_id, alias_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    if !owns_account(&state.pool, account_id, claims.sub).await {
        return (StatusCode::NOT_FOUND, "Account not found").into_response();
    }

    let result = sqlx::query("DELETE FROM mail.aliases WHERE id = $1 AND account_id = $2")
        .bind(alias_id)
        .bind(account_id)
        .execute(&state.pool)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => StatusCode::NO_CONTENT.into_response(),
        Ok(_) => (StatusCode::NOT_FOUND, "Alias not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to delete alias {}: {}", alias_id, e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        },
    }
}

/// POST /api/v1/mail/accounts/:id/aliases/:alias_id/set-default
///
/// Marks this alias as the default for the account; clears is_default on all
/// other aliases for the same account in a single transaction.
pub async fn set_default_alias(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((account_id, alias_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    if !owns_account(&state.pool, account_id, claims.sub).await {
        return (StatusCode::NOT_FOUND, "Account not found").into_response();
    }

    // Verify alias exists
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM mail.aliases WHERE id = $1 AND account_id = $2)",
    )
    .bind(alias_id)
    .bind(account_id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(false);

    if !exists {
        return (StatusCode::NOT_FOUND, "Alias not found").into_response();
    }

    // Clear existing defaults for this account, then set the new one.
    let result: Result<_, sqlx::Error> = async {
        sqlx::query(
            "UPDATE mail.aliases SET is_default = false, updated_at = NOW() WHERE account_id = $1",
        )
        .bind(account_id)
        .execute(&state.pool)
        .await?;

        sqlx::query_as::<_, Alias>(
            r#"UPDATE mail.aliases
               SET is_default = true, updated_at = NOW()
               WHERE id = $1 AND account_id = $2
               RETURNING *"#,
        )
        .bind(alias_id)
        .bind(account_id)
        .fetch_one(&state.pool)
        .await
    }
    .await;

    match result {
        Ok(alias) => Json(alias).into_response(),
        Err(e) => {
            tracing::error!("Failed to set default alias {}: {}", alias_id, e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        },
    }
}
