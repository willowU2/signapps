//! Entity links handlers — SYNC-CROSSLINKS
//!
//! Provides GET /api/v1/links, POST /api/v1/links, DELETE /api/v1/links/:id

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;
use sqlx::FromRow;
use uuid::Uuid;

use crate::AppState;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EntityLink {
    pub id: Uuid,
    pub source_type: String,
    pub source_id: Uuid,
    pub target_type: String,
    pub target_id: Uuid,
    pub relation: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct FindLinksQuery {
    pub entity_type: String,
    pub entity_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct CreateLinkRequest {
    pub source_type: String,
    pub source_id: Uuid,
    pub target_type: String,
    pub target_id: Uuid,
    pub relation: Option<String>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /api/v1/links?entity_type=X&entity_id=Y
#[tracing::instrument(skip_all)]
pub async fn find_links(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Query(q): Query<FindLinksQuery>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, EntityLink>(
        "SELECT id, source_type, source_id, target_type, target_id, relation, created_by, created_at
         FROM identity.entity_links
         WHERE (source_type = $1 AND source_id = $2)
            OR (target_type = $1 AND target_id = $2)
         ORDER BY created_at DESC",
    )
    .bind(&q.entity_type)
    .bind(q.entity_id)
    .fetch_all(&*state.pool)
    .await
    {
        Ok(links) => (StatusCode::OK, Json(serde_json::json!(links))).into_response(),
        Err(e) => {
            tracing::error!("find_links: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
                .into_response()
        },
    }
}

/// POST /api/v1/links
#[tracing::instrument(skip_all)]
pub async fn create_link(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateLinkRequest>,
) -> impl IntoResponse {
    let id = Uuid::new_v4();
    match sqlx::query_as::<_, EntityLink>(
        "INSERT INTO identity.entity_links
             (id, source_type, source_id, target_type, target_id, relation, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, source_type, source_id, target_type, target_id, relation, created_by, created_at",
    )
    .bind(id)
    .bind(&payload.source_type)
    .bind(payload.source_id)
    .bind(&payload.target_type)
    .bind(payload.target_id)
    .bind(&payload.relation)
    .bind(claims.sub)
    .fetch_one(&*state.pool)
    .await
    {
        Ok(link) => (StatusCode::CREATED, Json(serde_json::json!(link))).into_response(),
        Err(e) => {
            tracing::error!("create_link: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
                .into_response()
        },
    }
}

/// DELETE /api/v1/links/:id
#[tracing::instrument(skip_all)]
pub async fn remove_link(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query("DELETE FROM identity.entity_links WHERE id = $1 AND created_by = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(&*state.pool)
        .await
    {
        Ok(r) if r.rows_affected() > 0 => StatusCode::NO_CONTENT.into_response(),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "link not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("remove_link: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
                .into_response()
        },
    }
}
