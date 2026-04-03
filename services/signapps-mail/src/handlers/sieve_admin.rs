//! Sieve script administration handlers.
//!
//! Manages Sieve filter scripts per mailserver account via REST API.
//! Scripts are stored in `mailserver.sieve_scripts`.

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

/// A Sieve script stored for a mailserver account.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct SieveScript {
    /// Unique identifier.
    pub id: Uuid,
    /// Account this script belongs to.
    pub account_id: Uuid,
    /// Human-readable script name.
    pub name: String,
    /// Sieve script source code.
    pub script_source: String,
    /// Whether this script is the active one.
    pub is_active: bool,
    /// Row creation timestamp.
    pub created_at: Option<DateTime<Utc>>,
    /// Row last-update timestamp.
    pub updated_at: Option<DateTime<Utc>>,
}

/// Request to create a Sieve script.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateSieveScriptRequest {
    /// Human-readable script name.
    pub name: String,
    /// Sieve script source code.
    pub script_source: String,
}

/// Request to update a Sieve script.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateSieveScriptRequest {
    /// Updated script name (optional).
    pub name: Option<String>,
    /// Updated script source code (optional).
    pub script_source: Option<String>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// List Sieve scripts for an account.
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
    path = "/api/v1/mailserver/sieve/{account_id}",
    tag = "mailserver-sieve",
    security(("bearerAuth" = [])),
    params(("account_id" = Uuid, Path, description = "Account ID")),
    responses(
        (status = 200, description = "Sieve scripts", body = Vec<SieveScript>),
        (status = 500, description = "Internal server error"),
    )
)]
#[tracing::instrument(skip(state), fields(account_id = %account_id))]
pub async fn list_sieve_scripts(
    State(state): State<AppState>,
    Path(account_id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, SieveScript>(
        "SELECT id, account_id, name, script_source, is_active, created_at, updated_at \
         FROM mailserver.sieve_scripts \
         WHERE account_id = $1 \
         ORDER BY name",
    )
    .bind(account_id)
    .fetch_all(&state.pool)
    .await
    {
        Ok(scripts) => Json(serde_json::json!({ "scripts": scripts })).into_response(),
        Err(e) => {
            tracing::error!("Failed to list sieve scripts: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to list scripts" })),
            )
                .into_response()
        },
    }
}

/// Create a new Sieve script for an account.
///
/// Validates the script syntax before storing.
///
/// # Errors
///
/// Returns 400 if the script has syntax errors, 500 on database failure.
///
/// # Panics
///
/// None.
#[utoipa::path(
    post,
    path = "/api/v1/mailserver/sieve/{account_id}",
    tag = "mailserver-sieve",
    security(("bearerAuth" = [])),
    params(("account_id" = Uuid, Path, description = "Account ID")),
    request_body = CreateSieveScriptRequest,
    responses(
        (status = 201, description = "Script created", body = SieveScript),
        (status = 400, description = "Invalid script syntax"),
        (status = 500, description = "Internal server error"),
    )
)]
#[tracing::instrument(skip(state, payload), fields(account_id = %account_id))]
pub async fn create_sieve_script(
    State(state): State<AppState>,
    Path(account_id): Path<Uuid>,
    Json(payload): Json<CreateSieveScriptRequest>,
) -> impl IntoResponse {
    // Validate script syntax
    if let Err(e) = signapps_sieve::SieveScript::compile(&payload.script_source) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "Invalid Sieve script syntax",
                "detail": e.to_string(),
            })),
        )
            .into_response();
    }

    match sqlx::query_as::<_, SieveScript>(
        r#"INSERT INTO mailserver.sieve_scripts
               (account_id, name, script_source, is_active)
           VALUES ($1, $2, $3, false)
           RETURNING id, account_id, name, script_source, is_active, created_at, updated_at"#,
    )
    .bind(account_id)
    .bind(&payload.name)
    .bind(&payload.script_source)
    .fetch_one(&state.pool)
    .await
    {
        Ok(script) => (StatusCode::CREATED, Json(script)).into_response(),
        Err(e) => {
            tracing::error!("Failed to create sieve script: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to create script" })),
            )
                .into_response()
        },
    }
}

/// Update a Sieve script.
///
/// # Errors
///
/// Returns 400 if the updated script has syntax errors, 404 if not found.
///
/// # Panics
///
/// None.
#[utoipa::path(
    put,
    path = "/api/v1/mailserver/sieve/{account_id}/{id}",
    tag = "mailserver-sieve",
    security(("bearerAuth" = [])),
    params(
        ("account_id" = Uuid, Path, description = "Account ID"),
        ("id" = Uuid, Path, description = "Script ID"),
    ),
    request_body = UpdateSieveScriptRequest,
    responses(
        (status = 200, description = "Script updated", body = SieveScript),
        (status = 400, description = "Invalid script syntax"),
        (status = 404, description = "Script not found"),
    )
)]
#[tracing::instrument(skip(state, payload), fields(account_id = %account_id, script_id = %id))]
pub async fn update_sieve_script(
    State(state): State<AppState>,
    Path((account_id, id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateSieveScriptRequest>,
) -> impl IntoResponse {
    // If script_source is being updated, validate syntax
    if let Some(ref source) = payload.script_source {
        if let Err(e) = signapps_sieve::SieveScript::compile(source) {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Invalid Sieve script syntax",
                    "detail": e.to_string(),
                })),
            )
                .into_response();
        }
    }

    match sqlx::query_as::<_, SieveScript>(
        r#"UPDATE mailserver.sieve_scripts SET
               name = COALESCE($3, name),
               script_source = COALESCE($4, script_source),
               updated_at = NOW()
           WHERE id = $1 AND account_id = $2
           RETURNING id, account_id, name, script_source, is_active, created_at, updated_at"#,
    )
    .bind(id)
    .bind(account_id)
    .bind(payload.name)
    .bind(payload.script_source)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(script)) => Json(script).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Script not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("Failed to update sieve script: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to update script" })),
            )
                .into_response()
        },
    }
}

/// Delete a Sieve script.
///
/// # Errors
///
/// Returns 404 if script not found.
///
/// # Panics
///
/// None.
#[utoipa::path(
    delete,
    path = "/api/v1/mailserver/sieve/{account_id}/{id}",
    tag = "mailserver-sieve",
    security(("bearerAuth" = [])),
    params(
        ("account_id" = Uuid, Path, description = "Account ID"),
        ("id" = Uuid, Path, description = "Script ID"),
    ),
    responses(
        (status = 200, description = "Script deleted"),
        (status = 404, description = "Script not found"),
    )
)]
#[tracing::instrument(skip(state), fields(account_id = %account_id, script_id = %id))]
pub async fn delete_sieve_script(
    State(state): State<AppState>,
    Path((account_id, id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    match sqlx::query(
        "DELETE FROM mailserver.sieve_scripts WHERE id = $1 AND account_id = $2 RETURNING id",
    )
    .bind(id)
    .bind(account_id)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(_)) => {
            tracing::info!(script_id = %id, "Sieve script deleted");
            Json(serde_json::json!({ "success": true })).into_response()
        },
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Script not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("Failed to delete sieve script: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to delete script" })),
            )
                .into_response()
        },
    }
}

/// Activate a Sieve script (deactivates all others for the same account).
///
/// # Errors
///
/// Returns 404 if script not found.
///
/// # Panics
///
/// None.
#[utoipa::path(
    post,
    path = "/api/v1/mailserver/sieve/{account_id}/{id}/activate",
    tag = "mailserver-sieve",
    security(("bearerAuth" = [])),
    params(
        ("account_id" = Uuid, Path, description = "Account ID"),
        ("id" = Uuid, Path, description = "Script ID"),
    ),
    responses(
        (status = 200, description = "Script activated"),
        (status = 404, description = "Script not found"),
    )
)]
#[tracing::instrument(skip(state), fields(account_id = %account_id, script_id = %id))]
pub async fn activate_sieve_script(
    State(state): State<AppState>,
    Path((account_id, id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    // Deactivate all scripts for this account
    let deactivate_result =
        sqlx::query("UPDATE mailserver.sieve_scripts SET is_active = false WHERE account_id = $1")
            .bind(account_id)
            .execute(&state.pool)
            .await;

    if let Err(e) = deactivate_result {
        tracing::error!("Failed to deactivate scripts: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Failed to deactivate existing scripts" })),
        )
            .into_response();
    }

    // Activate the target script
    match sqlx::query(
        "UPDATE mailserver.sieve_scripts SET is_active = true, updated_at = NOW() \
         WHERE id = $1 AND account_id = $2 RETURNING id",
    )
    .bind(id)
    .bind(account_id)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(_)) => {
            tracing::info!(
                script_id = %id,
                account_id = %account_id,
                "Sieve script activated"
            );
            Json(serde_json::json!({ "success": true })).into_response()
        },
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Script not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("Failed to activate sieve script: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to activate script" })),
            )
                .into_response()
        },
    }
}
