//! Guest access token handlers (AQ-GUES).
//!
//! Temporary, limited-permission tokens that allow unauthenticated access
//! to specific resources without requiring a full user account.
//!
//! Routes:
//!   POST   /api/v1/guest-tokens           → create a guest token
//!   GET    /api/v1/guest-tokens           → list tokens for current user
//!   DELETE /api/v1/guest-tokens/:id       → revoke a token
//!   POST   /api/v1/guest-tokens/validate  → validate + return claims (public)

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use chrono::{DateTime, Duration, Utc};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use signapps_common::{Claims, Error, Result};
use uuid::Uuid;

use crate::AppState;

// ── Models ────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateGuestTokenRequest {
    /// Resource type (e.g. "document", "calendar", "form")
    pub resource_type: String,
    /// Resource UUID
    pub resource_id: Uuid,
    /// Permission level: "read" or "comment"
    pub permission: String,
    /// Expiry in hours (max 720 = 30 days)
    pub expires_in_hours: Option<i64>,
    /// Optional description / display name
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GuestTokenResponse {
    pub id: Uuid,
    /// The raw token — shown only once at creation.
    pub token: Option<String>,
    /// First 12 chars of the token for display.
    pub token_prefix: String,
    pub resource_type: String,
    pub resource_id: Uuid,
    pub permission: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub is_active: bool,
    pub access_count: i64,
}

#[derive(Debug, Deserialize)]
pub struct ValidateGuestTokenRequest {
    pub token: String,
}

#[derive(Debug, Serialize)]
pub struct ValidateGuestTokenResponse {
    pub valid: bool,
    pub resource_type: Option<String>,
    pub resource_id: Option<Uuid>,
    pub permission: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn generate_token() -> String {
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..32).map(|_| rng.gen::<u8>()).collect();
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hasher
        .finalize()
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect()
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/// Create a new guest access token.
#[tracing::instrument(skip_all)]
pub async fn create_guest_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateGuestTokenRequest>,
) -> Result<(StatusCode, Json<GuestTokenResponse>)> {
    // Validate permission
    if !["read", "comment"].contains(&payload.permission.as_str()) {
        return Err(Error::BadRequest(
            "Permission must be 'read' or 'comment'".to_string(),
        ));
    }

    let raw_token = generate_token();
    let token_hash = hash_token(&raw_token);
    let token_prefix = raw_token[..12].to_string();

    let expires_in_hours = payload.expires_in_hours.unwrap_or(168).min(720); // Default 7 days, max 30
    let expires_at: Option<DateTime<Utc>> = if expires_in_hours > 0 {
        Some(Utc::now() + Duration::hours(expires_in_hours))
    } else {
        None
    };

    let id = Uuid::new_v4();
    let created_at = Utc::now();

    sqlx::query(
        r#"
        INSERT INTO identity.guest_tokens
            (id, owner_id, token_hash, token_prefix, resource_type, resource_id,
             permission, expires_at, description, created_at, is_active, access_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, 0)
        "#,
    )
    .bind(id)
    .bind(claims.sub)
    .bind(&token_hash)
    .bind(&token_prefix)
    .bind(&payload.resource_type)
    .bind(payload.resource_id)
    .bind(&payload.permission)
    .bind(expires_at)
    .bind(&payload.description)
    .bind(created_at)
    .execute(state.pool.inner())
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok((
        StatusCode::CREATED,
        Json(GuestTokenResponse {
            id,
            token: Some(raw_token), // shown only once
            token_prefix,
            resource_type: payload.resource_type,
            resource_id: payload.resource_id,
            permission: payload.permission,
            expires_at,
            description: payload.description,
            created_at,
            is_active: true,
            access_count: 0,
        }),
    ))
}

/// List active guest tokens owned by the current user.
#[tracing::instrument(skip_all)]
pub async fn list_guest_tokens(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<GuestTokenResponse>>> {
    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            String,
            String,
            String,
            Uuid,
            String,
            Option<DateTime<Utc>>,
            Option<String>,
            DateTime<Utc>,
            bool,
            i64,
        ),
    >(
        r#"
        SELECT id, token_prefix, resource_type, resource_id::uuid, permission,
               expires_at, description, created_at, is_active, access_count
        FROM identity.guest_tokens
        WHERE owner_id = $1
          AND is_active = true
          AND (expires_at IS NULL OR expires_at > now())
        ORDER BY created_at DESC
        LIMIT 100
        "#,
    )
    .bind(claims.sub)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    let tokens = rows
        .into_iter()
        .map(
            |(
                id,
                token_prefix,
                resource_type,
                _,
                resource_id,
                permission,
                expires_at,
                description,
                created_at,
                is_active,
                access_count,
            )| {
                GuestTokenResponse {
                    id,
                    token: None, // never re-expose raw token
                    token_prefix,
                    resource_type,
                    resource_id,
                    permission,
                    expires_at,
                    description,
                    created_at,
                    is_active,
                    access_count,
                }
            },
        )
        .collect();

    Ok(Json(tokens))
}

/// Revoke a guest token.
#[tracing::instrument(skip_all)]
pub async fn revoke_guest_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(token_id): Path<Uuid>,
) -> Result<StatusCode> {
    let affected = sqlx::query(
        "UPDATE identity.guest_tokens SET is_active = false WHERE id = $1 AND owner_id = $2",
    )
    .bind(token_id)
    .bind(claims.sub)
    .execute(state.pool.inner())
    .await
    .map_err(|e| Error::Database(e.to_string()))?
    .rows_affected();

    if affected == 0 {
        return Err(Error::NotFound("Guest token not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

/// Public endpoint: validate a guest token and return its claims.
/// Increments access_count on success.
#[tracing::instrument(skip_all)]
pub async fn validate_guest_token(
    State(state): State<AppState>,
    Json(payload): Json<ValidateGuestTokenRequest>,
) -> Result<Json<ValidateGuestTokenResponse>> {
    let token_hash = hash_token(&payload.token);

    let row = sqlx::query_as::<_, (Uuid, String, Uuid, String, Option<DateTime<Utc>>, bool)>(
        r#"
        SELECT id, resource_type, resource_id::uuid, permission, expires_at, is_active
        FROM identity.guest_tokens
        WHERE token_hash = $1
        "#,
    )
    .bind(&token_hash)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    let Some((id, resource_type, resource_id, permission, expires_at, is_active)) = row else {
        return Ok(Json(ValidateGuestTokenResponse {
            valid: false,
            resource_type: None,
            resource_id: None,
            permission: None,
            expires_at: None,
        }));
    };

    // Check active + not expired
    let expired = expires_at.map(|e| e < Utc::now()).unwrap_or(false);
    if !is_active || expired {
        return Ok(Json(ValidateGuestTokenResponse {
            valid: false,
            resource_type: None,
            resource_id: None,
            permission: None,
            expires_at: None,
        }));
    }

    // Increment access count (fire-and-forget)
    let _ = sqlx::query(
        "UPDATE identity.guest_tokens SET access_count = access_count + 1 WHERE id = $1",
    )
    .bind(id)
    .execute(state.pool.inner())
    .await;

    Ok(Json(ValidateGuestTokenResponse {
        valid: true,
        resource_type: Some(resource_type),
        resource_id: Some(resource_id),
        permission: Some(permission),
        expires_at,
    }))
}
