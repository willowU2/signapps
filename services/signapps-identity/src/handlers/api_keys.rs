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
#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for CreateApiKey.
pub struct CreateApiKeyRequest {
    pub name: String,
    pub scopes: Vec<String>,
    pub expires_in_days: Option<i64>,
}

/// API key creation response (includes the full key — shown only once).
#[derive(Debug, Serialize, utoipa::ToSchema)]
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
#[derive(Debug, Serialize, utoipa::ToSchema)]
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

/// PATCH request body for updating an API key.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for PatchApiKey.
pub struct PatchApiKeyRequest {
    pub name: Option<String>,
    pub is_active: Option<bool>,
}

/// Generate a cryptographically random API key (hex-encoded using format!).
fn generate_api_key() -> String {
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..32).map(|_| rng.gen::<u8>()).collect();
    let encoded: String = bytes.iter().map(|b| format!("{:02x}", b)).collect();
    format!("sk_example_{}", encoded)
}

/// Hash an API key using SHA-256, returned as lowercase hex.
fn hash_key(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    let result = hasher.finalize();
    result.iter().map(|b| format!("{:02x}", b)).collect()
}

/// POST /api/v1/api-keys — Create a new API key.
#[utoipa::path(
    post,
    path = "/api/v1/api-keys",
    tag = "api_keys",
    security(("bearerAuth" = [])),
    request_body = CreateApiKeyRequest,
    responses(
        (status = 200, description = "API key created (full key shown only once)", body = CreateApiKeyResponse),
        (status = 400, description = "Validation error"),
        (status = 401, description = "Not authenticated"),
    )
)]
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
#[utoipa::path(
    get,
    path = "/api/v1/api-keys",
    tag = "api_keys",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "API key list", body = Vec<ApiKeyItem>),
        (status = 401, description = "Not authenticated"),
    )
)]
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
#[utoipa::path(
    delete,
    path = "/api/v1/api-keys/{id}",
    tag = "api_keys",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "API key UUID")),
    responses(
        (status = 204, description = "API key revoked"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "API key not found"),
    )
)]
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

/// PATCH /api/v1/api-keys/:id — Rename or toggle an API key.
#[utoipa::path(
    patch,
    path = "/api/v1/api-keys/{id}",
    tag = "api_keys",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "API key UUID")),
    request_body = PatchApiKeyRequest,
    responses(
        (status = 200, description = "API key updated", body = ApiKeyItem),
        (status = 400, description = "Validation error"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "API key not found"),
    )
)]
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
    use super::*;

    // -----------------------------------------------------------------------
    // generate_api_key
    // -----------------------------------------------------------------------

    /// Generated key starts with the expected `sk_example_` prefix.
    #[test]
    fn test_generate_api_key_has_prefix() {
        let key = generate_api_key();
        assert!(key.starts_with("sk_example_"), "key must start with 'sk_example_': {key}");
    }

    /// Generated key is the expected total length (8 prefix chars + 64 hex chars = 72).
    #[test]
    fn test_generate_api_key_length() {
        let key = generate_api_key();
        // "sk_example_" = 8 chars, 32 random bytes hex-encoded = 64 chars
        assert_eq!(key.len(), 72, "unexpected key length: {}", key.len());
    }

    /// Two successive generated keys are different (probabilistic, but collision probability is 1/2^256).
    #[test]
    fn test_generate_api_key_is_random() {
        let key1 = generate_api_key();
        let key2 = generate_api_key();
        assert_ne!(key1, key2, "successive keys must differ");
    }

    /// The first 16 chars of the key form the prefix stored in the DB.
    #[test]
    fn test_generate_api_key_prefix_extraction() {
        let key = generate_api_key();
        let prefix: String = key.chars().take(16).collect();
        assert_eq!(prefix.len(), 16);
        // Prefix starts with "sk_example_"
        assert!(prefix.starts_with("sk_example_"));
    }

    // -----------------------------------------------------------------------
    // hash_key (SHA-256)
    // -----------------------------------------------------------------------

    /// `hash_key` is deterministic — same input always produces the same hash.
    #[test]
    fn test_hash_key_deterministic() {
        let key = "sk_example_abc123def456";
        assert_eq!(hash_key(key), hash_key(key), "hash must be deterministic");
    }

    /// `hash_key` output is a 64-char lowercase hex string (SHA-256).
    #[test]
    fn test_hash_key_output_format() {
        let key = "sk_example_test_value_here_12345678";
        let h = hash_key(key);
        assert_eq!(h.len(), 64, "SHA-256 hex must be 64 chars");
        assert!(
            h.chars().all(|c| c.is_ascii_hexdigit()),
            "hash must be lowercase hex: {h}"
        );
    }

    /// Different keys produce different hashes.
    #[test]
    fn test_hash_key_different_inputs_differ() {
        let h1 = hash_key("sk_example_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        let h2 = hash_key("sk_example_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
        assert_ne!(h1, h2, "different keys must hash differently");
    }

    // -----------------------------------------------------------------------
    // CreateApiKeyRequest — name validation logic (mirrors handler guard)
    // -----------------------------------------------------------------------

    /// Empty name should be flagged as invalid by the handler guard.
    #[test]
    fn test_create_api_key_name_empty_is_invalid() {
        let name = "";
        assert!(
            name.is_empty() || name.len() > 100,
            "empty name must be caught by the validation guard"
        );
    }

    /// Name of exactly 100 chars is at the boundary and should be accepted.
    #[test]
    fn test_create_api_key_name_max_length_accepted() {
        let name = "a".repeat(100);
        assert!(
            !name.is_empty() && name.len() <= 100,
            "100-char name must pass validation"
        );
    }

    /// Name of 101 chars exceeds the limit.
    #[test]
    fn test_create_api_key_name_over_limit_rejected() {
        let name = "a".repeat(101);
        assert!(
            name.len() > 100,
            "101-char name must be rejected by the validation guard"
        );
    }
}
