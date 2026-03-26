use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::models::{ApiKey, CreateApiKeyRequest};
use crate::AppState;
use signapps_common::Claims;

fn generate_api_key() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    format!("ssk_{}", hex::encode(bytes))
}

fn hash_key(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    hex::encode(hasher.finalize())
}

pub async fn list_api_keys(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, ApiKey>(
        "SELECT * FROM social.api_keys WHERE user_id = $1 ORDER BY created_at DESC",
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => Ok(Json(rows)),
        Err(e) => {
            tracing::error!("list_api_keys: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

pub async fn create_api_key(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateApiKeyRequest>,
) -> impl IntoResponse {
    let raw_key = generate_api_key();
    let key_hash = hash_key(&raw_key);
    let key_prefix = raw_key[..12].to_string();

    match sqlx::query_as::<_, ApiKey>(
        r#"INSERT INTO social.api_keys
           (user_id, name, key_hash, key_prefix, scopes, rate_limit_per_hour, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *"#,
    )
    .bind(claims.sub)
    .bind(&payload.name)
    .bind(&key_hash)
    .bind(&key_prefix)
    .bind(
        payload
            .scopes
            .unwrap_or(serde_json::json!(["read", "write"])),
    )
    .bind(payload.rate_limit_per_hour.unwrap_or(30))
    .bind(payload.expires_at)
    .fetch_one(&state.pool)
    .await
    {
        Ok(key) => {
            // Return the raw key only on creation
            Ok((
                StatusCode::CREATED,
                Json(serde_json::json!({
                    "id": key.id,
                    "name": key.name,
                    "key": raw_key,
                    "key_prefix": key.key_prefix,
                    "scopes": key.scopes,
                    "rate_limit_per_hour": key.rate_limit_per_hour,
                    "expires_at": key.expires_at,
                    "created_at": key.created_at
                })),
            ))
        },
        Err(e) => {
            tracing::error!("create_api_key: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

pub async fn revoke_api_key(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query("UPDATE social.api_keys SET is_active = false WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(&state.pool)
        .await
    {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!("revoke_api_key: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}
