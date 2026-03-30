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

#[derive(Debug, Serialize, FromRow)]
pub struct Macro {
    pub id: Uuid,
    pub document_id: Uuid,
    pub name: String,
    pub code: String,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMacroRequest {
    pub name: String,
    pub code: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMacroRequest {
    pub name: Option<String>,
    pub code: Option<String>,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/docs/:doc_id/macros
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

/// POST /api/v1/docs/:doc_id/macros
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

/// PUT /api/v1/docs/:doc_id/macros/:macro_id
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

/// DELETE /api/v1/docs/:doc_id/macros/:macro_id
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
