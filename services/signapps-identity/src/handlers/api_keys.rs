//! API Key Management handlers.
//!
//! CRUD for API keys with hashed storage. Keys are generated server-side,
//! shown once at creation, then only the prefix is visible.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use signapps_common::{Claims, Error, Result};
use uuid::Uuid;

use crate::AppState;

/// API key creation request.
#[derive(Debug, Deserialize)]
/// Request body for CreateApiKey.
pub struct CreateApiKeyRequest {
    pub name: String,
    pub scopes: Vec<String>,
    pub expires_in_days: Option<i64>,
}

/// API key creation response (includes the full key — shown only once).
#[derive(Debug, Serialize)]
/// Response for CreateApiKey.
pub struct CreateApiKeyResponse {
    pub id: Uuid,
    pub name: String,
    pub key: String,
    pub prefix: String,
    pub scopes: Vec<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// API key list item (no full key visible).
#[derive(Debug, Serialize)]
/// ApiKeyItem data transfer object.
pub struct ApiKeyItem {
    pub id: Uuid,
    pub name: String,
    pub prefix: String,
    pub scopes: Vec<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub last_used: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

/// Generate a cryptographically random API key (hex-encoded using format!).
fn generate_api_key() -> String {
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..32).map(|_| rng.gen::<u8>()).collect();
    let encoded: String = bytes.iter().map(|b| format!("{:02x}", b)).collect();
    format!("sk_live_{}", encoded)
}

/// Hash an API key using SHA-256, returned as lowercase hex.
fn hash_key(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    let result = hasher.finalize();
    result.iter().map(|b| format!("{:02x}", b)).collect()
}

/// POST /api/v1/api-keys — Create a new API key.
#[tracing::instrument(skip(state, payload))]
#[tracing::instrument(skip_all)]
pub async fn create(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateApiKeyRequest>,
) -> Result<Json<CreateApiKeyResponse>> {
    if payload.name.is_empty() || payload.name.len() > 100 {
        return Err(Error::Validation(
            "Name must be 1-100 characters".to_string(),
        ));
    }

    let key = generate_api_key();
    let key_hash = hash_key(&key);
    let prefix = key.chars().take(16).collect::<String>();

    let expires_at = payload
        .expires_in_days
        .map(|days| Utc::now() + chrono::Duration::days(days));

    let id: (Uuid,) = sqlx::query_as(
        r#"INSERT INTO identity.api_keys (user_id, name, key_prefix, key_hash, scopes, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id"#,
    )
    .bind(claims.sub)
    .bind(&payload.name)
    .bind(&prefix)
    .bind(&key_hash)
    .bind(&payload.scopes)
    .bind(expires_at)
    .fetch_one(&*state.pool)
    .await?;

    tracing::info!(user_id = %claims.sub, key_id = %id.0, "API key created");

    Ok(Json(CreateApiKeyResponse {
        id: id.0,
        name: payload.name,
        key,
        prefix,
        scopes: payload.scopes,
        expires_at,
        created_at: Utc::now(),
    }))
}

/// GET /api/v1/api-keys — List user's API keys.
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ApiKeyItem>>> {
    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            String,
            String,
            Vec<String>,
            Option<DateTime<Utc>>,
            Option<DateTime<Utc>>,
            bool,
            DateTime<Utc>,
        ),
    >(
        r#"SELECT id, name, key_prefix, scopes, expires_at, last_used, is_active, created_at
           FROM identity.api_keys
           WHERE user_id = $1
           ORDER BY created_at DESC"#,
    )
    .bind(claims.sub)
    .fetch_all(&*state.pool)
    .await?;

    let items: Vec<ApiKeyItem> = rows
        .into_iter()
        .map(|r| ApiKeyItem {
            id: r.0,
            name: r.1,
            prefix: r.2,
            scopes: r.3,
            expires_at: r.4,
            last_used: r.5,
            is_active: r.6,
            created_at: r.7,
        })
        .collect();

    Ok(Json(items))
}

/// DELETE /api/v1/api-keys/:id — Revoke an API key.
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn revoke(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let result = sqlx::query(
        "UPDATE identity.api_keys SET is_active = FALSE WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&*state.pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(Error::NotFound("API key not found".to_string()));
    }

    tracing::info!(user_id = %claims.sub, key_id = %id, "API key revoked");
    Ok(StatusCode::NO_CONTENT)
}

/// PATCH request body for updating an API key.
#[derive(Debug, Deserialize)]
/// Request body for PatchApiKey.
pub struct PatchApiKeyRequest {
    pub name: Option<String>,
    pub is_active: Option<bool>,
}

/// PATCH /api/v1/api-keys/:id — Rename or toggle an API key.
#[tracing::instrument(skip(state, payload))]
#[tracing::instrument(skip_all)]
pub async fn patch(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<PatchApiKeyRequest>,
) -> Result<Json<ApiKeyItem>> {
    if let Some(ref name) = payload.name {
        if name.is_empty() || name.len() > 100 {
            return Err(Error::Validation(
                "Name must be 1-100 characters".to_string(),
            ));
        }
    }

    // Build dynamic update — at least one field must be provided
    if payload.name.is_none() && payload.is_active.is_none() {
        return Err(Error::Validation("Nothing to update".to_string()));
    }

    let row = sqlx::query_as::<
        _,
        (
            Uuid,
            String,
            String,
            Vec<String>,
            Option<DateTime<Utc>>,
            Option<DateTime<Utc>>,
            bool,
            DateTime<Utc>,
        ),
    >(
        r#"UPDATE identity.api_keys
           SET name       = COALESCE($3, name),
               is_active  = COALESCE($4, is_active),
               updated_at = NOW()
           WHERE id = $1 AND user_id = $2
           RETURNING id, name, key_prefix, scopes, expires_at, last_used, is_active, created_at"#,
    )
    .bind(id)
    .bind(claims.sub)
    .bind(payload.name)
    .bind(payload.is_active)
    .fetch_optional(&*state.pool)
    .await?
    .ok_or_else(|| Error::NotFound("API key not found".to_string()))?;

    tracing::info!(user_id = %claims.sub, key_id = %id, "API key patched");

    Ok(Json(ApiKeyItem {
        id: row.0,
        name: row.1,
        prefix: row.2,
        scopes: row.3,
        expires_at: row.4,
        last_used: row.5,
        is_active: row.6,
        created_at: row.7,
    }))
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
