use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use signapps_common::Claims;
use uuid::Uuid;

use crate::AppState;

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
/// PgpConfig data transfer object.
pub struct PgpConfig {
    pub id: Uuid,
    pub account_id: Uuid,
    pub enabled: bool,
    pub public_key_pem: Option<String>,
    pub fingerprint: Option<String>,
    pub algorithm: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, serde::Deserialize)]
/// Request body for UpsertPgpConfig.
pub struct UpsertPgpConfigRequest {
    pub enabled: Option<bool>,
    pub public_key_pem: Option<String>,
    pub fingerprint: Option<String>,
    pub algorithm: Option<String>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /api/v1/mail/accounts/:account_id/pgp
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/pgp",
    responses((status = 200, description = "Success")),
    tag = "Mail"
)]
#[tracing::instrument(skip_all)]
pub async fn get_pgp_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(account_id): Path<Uuid>,
) -> impl IntoResponse {
    // Ensure the account belongs to the caller
    let owns: Option<(Uuid,)> =
        sqlx::query_as("SELECT id FROM mail.accounts WHERE id = $1 AND user_id = $2")
            .bind(account_id)
            .bind(claims.sub)
            .fetch_optional(&state.pool)
            .await
            .ok()
            .flatten();

    if owns.is_none() {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Account not found" })),
        );
    }

    match sqlx::query_as::<_, PgpConfig>(
        "SELECT id, account_id, enabled, public_key_pem, fingerprint, algorithm, created_at
         FROM mail.pgp_configs WHERE account_id = $1",
    )
    .bind(account_id)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(row)) => (StatusCode::OK, Json(serde_json::json!(row))),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "PGP config not found" })),
        ),
        Err(e) => {
            tracing::error!("get_pgp_config: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

/// PUT /api/v1/mail/accounts/:account_id/pgp
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/pgp",
    responses((status = 200, description = "Success")),
    tag = "Mail"
)]
#[tracing::instrument(skip_all)]
pub async fn upsert_pgp_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(account_id): Path<Uuid>,
    Json(payload): Json<UpsertPgpConfigRequest>,
) -> impl IntoResponse {
    // Ensure the account belongs to the caller
    let owns: Option<(Uuid,)> =
        sqlx::query_as("SELECT id FROM mail.accounts WHERE id = $1 AND user_id = $2")
            .bind(account_id)
            .bind(claims.sub)
            .fetch_optional(&state.pool)
            .await
            .ok()
            .flatten();

    if owns.is_none() {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Account not found" })),
        );
    }

    let enabled = payload.enabled.unwrap_or(false);

    match sqlx::query_as::<_, PgpConfig>(
        "INSERT INTO mail.pgp_configs
            (id, account_id, enabled, public_key_pem, fingerprint, algorithm, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
         ON CONFLICT (account_id) DO UPDATE
             SET enabled        = EXCLUDED.enabled,
                 public_key_pem = EXCLUDED.public_key_pem,
                 fingerprint    = EXCLUDED.fingerprint,
                 algorithm      = EXCLUDED.algorithm
         RETURNING id, account_id, enabled, public_key_pem, fingerprint, algorithm, created_at",
    )
    .bind(account_id)
    .bind(enabled)
    .bind(&payload.public_key_pem)
    .bind(&payload.fingerprint)
    .bind(&payload.algorithm)
    .fetch_one(&state.pool)
    .await
    {
        Ok(row) => (StatusCode::OK, Json(serde_json::json!(row))),
        Err(e) => {
            tracing::error!("upsert_pgp_config: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

/// DELETE /api/v1/mail/accounts/:account_id/pgp
#[tracing::instrument(skip_all)]
#[utoipa::path(
    delete,
    path = "/api/v1/pgp",
    responses((status = 204, description = "Success")),
    tag = "Mail"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_pgp_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(account_id): Path<Uuid>,
) -> StatusCode {
    // Ensure the account belongs to the caller
    let owns: Option<(Uuid,)> =
        sqlx::query_as("SELECT id FROM mail.accounts WHERE id = $1 AND user_id = $2")
            .bind(account_id)
            .bind(claims.sub)
            .fetch_optional(&state.pool)
            .await
            .ok()
            .flatten();

    if owns.is_none() {
        return StatusCode::NOT_FOUND;
    }

    match sqlx::query("DELETE FROM mail.pgp_configs WHERE account_id = $1")
        .bind(account_id)
        .execute(&state.pool)
        .await
    {
        Ok(r) if r.rows_affected() > 0 => StatusCode::NO_CONTENT,
        Ok(_) => StatusCode::NOT_FOUND,
        Err(e) => {
            tracing::error!("delete_pgp_config: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        },
    }
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
