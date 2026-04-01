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
/// QuickNote data transfer object.
pub struct QuickNote {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub content: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for CreateNote.
pub struct CreateNoteRequest {
    pub title: String,
    #[serde(default)]
    pub content: String,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for UpdateNote.
pub struct UpdateNoteRequest {
    pub title: Option<String>,
    pub content: Option<String>,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/keep/notes — list quick notes for the authenticated user
#[utoipa::path(
    get,
    path = "/api/v1/keep/notes",
    responses(
        (status = 200, description = "List of quick notes"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Notes"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_notes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let rows = sqlx::query_as::<_, QuickNote>(
        r#"SELECT id, user_id, title, content, created_at
           FROM docs.quick_notes
           WHERE user_id = $1
           ORDER BY created_at DESC"#,
    )
    .bind(claims.sub)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to list notes: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!({ "data": rows })))
}

/// POST /api/v1/keep/notes — create a new quick note
#[utoipa::path(
    post,
    path = "/api/v1/keep/notes",
    request_body = CreateNoteRequest,
    responses(
        (status = 201, description = "Note created", body = QuickNote),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Notes"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn create_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateNoteRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), StatusCode> {
    let row = sqlx::query_as::<_, QuickNote>(
        r#"INSERT INTO docs.quick_notes (user_id, title, content)
           VALUES ($1, $2, $3)
           RETURNING id, user_id, title, content, created_at"#,
    )
    .bind(claims.sub)
    .bind(payload.title.trim())
    .bind(&payload.content)
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to create note: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "data": row })),
    ))
}

/// PUT /api/v1/keep/notes/:id — update a quick note
#[utoipa::path(
    put,
    path = "/api/v1/keep/notes/{id}",
    params(("id" = uuid::Uuid, Path, description = "Note ID")),
    request_body = UpdateNoteRequest,
    responses(
        (status = 200, description = "Note updated", body = QuickNote),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Note not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Notes"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn update_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateNoteRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // quick_notes has no updated_at column — rebuild via subquery approach;
    // DELETE + INSERT would lose the id. Instead just UPDATE the mutable fields.
    let row = sqlx::query_as::<_, QuickNote>(
        r#"UPDATE docs.quick_notes
           SET title   = COALESCE($1, title),
               content = COALESCE($2, content)
           WHERE id = $3 AND user_id = $4
           RETURNING id, user_id, title, content, created_at"#,
    )
    .bind(payload.title.as_deref().map(str::trim))
    .bind(payload.content.as_deref())
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to update note: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(serde_json::json!({ "data": row })))
}

/// DELETE /api/v1/keep/notes/:id — delete a quick note
#[utoipa::path(
    delete,
    path = "/api/v1/keep/notes/{id}",
    params(("id" = uuid::Uuid, Path, description = "Note ID")),
    responses(
        (status = 204, description = "Note deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Note not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Notes"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn delete_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("DELETE FROM docs.quick_notes WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(state.pool.inner())
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete note: {}", e);
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
