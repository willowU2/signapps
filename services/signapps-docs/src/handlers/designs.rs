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
pub struct Design {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub format_width: i32,
    pub format_height: i32,
    pub pages: serde_json::Value,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDesignRequest {
    pub name: String,
    #[serde(default = "default_width")]
    pub format_width: i32,
    #[serde(default = "default_height")]
    pub format_height: i32,
    #[serde(default)]
    pub pages: serde_json::Value,
    #[serde(default)]
    pub metadata: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDesignRequest {
    pub name: Option<String>,
    pub format_width: Option<i32>,
    pub format_height: Option<i32>,
    pub pages: Option<serde_json::Value>,
    pub metadata: Option<serde_json::Value>,
}

fn default_width() -> i32 {
    1920
}
fn default_height() -> i32 {
    1080
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/designs
#[tracing::instrument(skip_all)]
pub async fn list_designs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let rows = sqlx::query_as::<_, Design>(
        r#"SELECT id, user_id, name, format_width, format_height, pages, metadata,
                  created_at, updated_at
           FROM docs.designs
           WHERE user_id = $1
           ORDER BY updated_at DESC"#,
    )
    .bind(claims.sub)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to list designs: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!({ "data": rows })))
}

/// POST /api/v1/designs
#[tracing::instrument(skip_all)]
pub async fn create_design(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateDesignRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), StatusCode> {
    if payload.name.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let pages = if payload.pages.is_null() {
        serde_json::json!([])
    } else {
        payload.pages
    };
    let metadata = if payload.metadata.is_null() {
        serde_json::json!({})
    } else {
        payload.metadata
    };

    let row = sqlx::query_as::<_, Design>(
        r#"INSERT INTO docs.designs (user_id, name, format_width, format_height, pages, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, user_id, name, format_width, format_height, pages, metadata,
                     created_at, updated_at"#,
    )
    .bind(claims.sub)
    .bind(payload.name.trim())
    .bind(payload.format_width)
    .bind(payload.format_height)
    .bind(&pages)
    .bind(&metadata)
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to create design: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "data": row })),
    ))
}

/// GET /api/v1/designs/:id
#[tracing::instrument(skip_all)]
pub async fn get_design(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let row = sqlx::query_as::<_, Design>(
        r#"SELECT id, user_id, name, format_width, format_height, pages, metadata,
                  created_at, updated_at
           FROM docs.designs
           WHERE id = $1 AND user_id = $2"#,
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to get design: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(serde_json::json!({ "data": row })))
}

/// PUT /api/v1/designs/:id
#[tracing::instrument(skip_all)]
pub async fn update_design(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateDesignRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let row = sqlx::query_as::<_, Design>(
        r#"UPDATE docs.designs
           SET name          = COALESCE($1, name),
               format_width  = COALESCE($2, format_width),
               format_height = COALESCE($3, format_height),
               pages         = COALESCE($4, pages),
               metadata      = COALESCE($5, metadata),
               updated_at    = now()
           WHERE id = $6 AND user_id = $7
           RETURNING id, user_id, name, format_width, format_height, pages, metadata,
                     created_at, updated_at"#,
    )
    .bind(payload.name.as_deref().map(str::trim))
    .bind(payload.format_width)
    .bind(payload.format_height)
    .bind(payload.pages.as_ref())
    .bind(payload.metadata.as_ref())
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to update design: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(serde_json::json!({ "data": row })))
}

/// DELETE /api/v1/designs/:id
#[tracing::instrument(skip_all)]
pub async fn delete_design(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("DELETE FROM docs.designs WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(state.pool.inner())
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete design: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}
