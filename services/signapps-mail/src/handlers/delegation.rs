//! Email account delegation handler.
//!
//! Allows an account owner to grant another user access to their mail account.
//!
//! Endpoints:
//!   GET    /api/v1/mail/accounts/:id/delegations
//!   POST   /api/v1/mail/accounts/:id/delegations
//!   DELETE /api/v1/mail/accounts/:id/delegations/:delegation_id

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
pub struct Delegation {
    pub id: Uuid,
    pub account_id: Uuid,
    pub owner_id: Uuid,
    pub delegate_id: Uuid,
    pub permission: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// Request DTO
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateDelegationRequest {
    /// UUID of the user to grant access to.
    pub delegate_id: Uuid,
    /// 'read' | 'send' | 'full'  (defaults to 'read')
    pub permission: Option<String>,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/mail/accounts/:id/delegations
pub async fn list_delegations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(account_id): Path<Uuid>,
) -> impl IntoResponse {
    // Verify ownership
    let owns: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM mail.accounts WHERE id = $1 AND user_id = $2)",
    )
    .bind(account_id)
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(false);

    if !owns {
        return (StatusCode::NOT_FOUND, "Account not found").into_response();
    }

    let result = sqlx::query_as::<_, Delegation>(
        "SELECT * FROM mail.delegations WHERE account_id = $1 ORDER BY created_at DESC",
    )
    .bind(account_id)
    .fetch_all(&state.pool)
    .await;

    match result {
        Ok(rows) => Json(rows).into_response(),
        Err(e) => {
            tracing::error!("Failed to list delegations for {}: {}", account_id, e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        },
    }
}

/// POST /api/v1/mail/accounts/:id/delegations
pub async fn create_delegation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(account_id): Path<Uuid>,
    Json(payload): Json<CreateDelegationRequest>,
) -> impl IntoResponse {
    // Verify ownership
    let owns: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM mail.accounts WHERE id = $1 AND user_id = $2)",
    )
    .bind(account_id)
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(false);

    if !owns {
        return (StatusCode::NOT_FOUND, "Account not found").into_response();
    }

    // Prevent self-delegation
    if payload.delegate_id == claims.sub {
        return (StatusCode::BAD_REQUEST, "Cannot delegate to yourself").into_response();
    }

    let permission = payload.permission.as_deref().unwrap_or("read").to_string();

    if !["read", "send", "full"].contains(&permission.as_str()) {
        return (
            StatusCode::BAD_REQUEST,
            "permission must be 'read', 'send', or 'full'",
        )
            .into_response();
    }

    let result = sqlx::query_as::<_, Delegation>(
        r#"INSERT INTO mail.delegations (account_id, owner_id, delegate_id, permission)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (account_id, delegate_id)
           DO UPDATE SET permission = EXCLUDED.permission, updated_at = NOW()
           RETURNING *"#,
    )
    .bind(account_id)
    .bind(claims.sub)
    .bind(payload.delegate_id)
    .bind(&permission)
    .fetch_one(&state.pool)
    .await;

    match result {
        Ok(delegation) => (StatusCode::CREATED, Json(delegation)).into_response(),
        Err(e) => {
            tracing::error!("Failed to create delegation: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        },
    }
}

/// DELETE /api/v1/mail/accounts/:id/delegations/:delegation_id
pub async fn revoke_delegation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((account_id, delegation_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    // Verify ownership
    let owns: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM mail.accounts WHERE id = $1 AND user_id = $2)",
    )
    .bind(account_id)
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(false);

    if !owns {
        return (StatusCode::NOT_FOUND, "Account not found").into_response();
    }

    let result = sqlx::query("DELETE FROM mail.delegations WHERE id = $1 AND account_id = $2")
        .bind(delegation_id)
        .bind(account_id)
        .execute(&state.pool)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => StatusCode::NO_CONTENT.into_response(),
        Ok(_) => (StatusCode::NOT_FOUND, "Delegation not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to revoke delegation {}: {}", delegation_id, e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        },
    }
}
