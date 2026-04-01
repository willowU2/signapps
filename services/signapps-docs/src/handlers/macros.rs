use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::AppState;
use signapps_common::Claims;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Serialize, FromRow, utoipa::ToSchema)]
/// Macro data transfer object.
pub struct Macro {
    pub id: Uuid,
    pub document_id: Uuid,
    pub name: String,
    pub code: String,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for CreateMacro.
pub struct CreateMacroRequest {
    pub name: String,
    pub code: String,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for UpdateMacro.
pub struct UpdateMacroRequest {
    pub name: Option<String>,
    pub code: Option<String>,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/docs/:doc_id/macros — list macros for a document
#[utoipa::path(
    get,
    path = "/api/v1/docs/{doc_id}/macros",
    params(("doc_id" = uuid::Uuid, Path, description = "Document ID")),
    responses(
        (status = 200, description = "List of macros"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Macros"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_macros(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(doc_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let rows = sqlx::query_as::<_, Macro>(
        r#"SELECT id, document_id, name, code, created_by, created_at, updated_at
           FROM docs.macros
           WHERE document_id = $1
           ORDER BY created_at ASC"#,
    )
    .bind(doc_id)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to list macros: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!({ "data": rows })))
}

/// POST /api/v1/docs/:doc_id/macros — create a macro for a document
#[utoipa::path(
    post,
    path = "/api/v1/docs/{doc_id}/macros",
    params(("doc_id" = uuid::Uuid, Path, description = "Document ID")),
    request_body = CreateMacroRequest,
    responses(
        (status = 201, description = "Macro created", body = Macro),
        (status = 400, description = "Bad request"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Macros"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn create_macro(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(doc_id): Path<Uuid>,
    Json(payload): Json<CreateMacroRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), StatusCode> {
    if payload.name.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let row = sqlx::query_as::<_, Macro>(
        r#"INSERT INTO docs.macros (document_id, name, code, created_by)
           VALUES ($1, $2, $3, $4)
           RETURNING id, document_id, name, code, created_by, created_at, updated_at"#,
    )
    .bind(doc_id)
    .bind(payload.name.trim())
    .bind(&payload.code)
    .bind(claims.sub)
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to create macro: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "data": row })),
    ))
}

/// PUT /api/v1/docs/:doc_id/macros/:macro_id — update a macro
#[utoipa::path(
    put,
    path = "/api/v1/docs/{doc_id}/macros/{macro_id}",
    params(
        ("doc_id" = uuid::Uuid, Path, description = "Document ID"),
        ("macro_id" = uuid::Uuid, Path, description = "Macro ID"),
    ),
    request_body = UpdateMacroRequest,
    responses(
        (status = 200, description = "Macro updated", body = Macro),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Macro not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Macros"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn update_macro(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path((doc_id, macro_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateMacroRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let row = sqlx::query_as::<_, Macro>(
        r#"UPDATE docs.macros
           SET name       = COALESCE($1, name),
               code       = COALESCE($2, code),
               updated_at = now()
           WHERE id = $3 AND document_id = $4
           RETURNING id, document_id, name, code, created_by, created_at, updated_at"#,
    )
    .bind(payload.name.as_deref().map(str::trim))
    .bind(payload.code.as_deref())
    .bind(macro_id)
    .bind(doc_id)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to update macro: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(serde_json::json!({ "data": row })))
}

/// DELETE /api/v1/docs/:doc_id/macros/:macro_id — delete a macro
#[utoipa::path(
    delete,
    path = "/api/v1/docs/{doc_id}/macros/{macro_id}",
    params(
        ("doc_id" = uuid::Uuid, Path, description = "Document ID"),
        ("macro_id" = uuid::Uuid, Path, description = "Macro ID"),
    ),
    responses(
        (status = 204, description = "Macro deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Macro not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Macros"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn delete_macro(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path((doc_id, macro_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("DELETE FROM docs.macros WHERE id = $1 AND document_id = $2")
        .bind(macro_id)
        .bind(doc_id)
        .execute(state.pool.inner())
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete macro: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
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
