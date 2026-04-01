//! Internal Communications endpoints — announcements, polls, news feed
//!
//! All data is stored as JSONB in `platform.comms_data` using
//! an `entity_type` discriminant column.

use crate::AppState;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::Value;
use signapps_common::{Error, Result};
use uuid::Uuid;

// ── Shared row ────────────────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct CommsRow {
    id: Uuid,
    entity_type: String,
    data: Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

// ── DTO ───────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Generic comms record returned to the client.
pub struct CommsRecord {
    pub id: Uuid,
    pub entity_type: String,
    pub data: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<CommsRow> for CommsRecord {
    fn from(r: CommsRow) -> Self {
        CommsRecord {
            id: r.id,
            entity_type: r.entity_type,
            data: r.data,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async fn ensure_table(pool: &signapps_db::DatabasePool) -> Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS platform.comms_data (
            id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            entity_type  VARCHAR(64) NOT NULL,
            data         JSONB       NOT NULL DEFAULT '{}',
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("ensure comms table: {}", e)))?;
    Ok(())
}

async fn insert_row(
    pool: &signapps_db::DatabasePool,
    entity_type: &str,
    data: &Value,
) -> Result<CommsRow> {
    if let Err(e) = ensure_table(pool).await {
        tracing::warn!("comms_data ensure failed: {}", e);
    }
    let row: CommsRow = sqlx::query_as(
        r#"
        INSERT INTO platform.comms_data (entity_type, data)
        VALUES ($1, $2)
        RETURNING *
        "#,
    )
    .bind(entity_type)
    .bind(data)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("comms insert: {}", e)))?;
    Ok(row)
}

async fn list_rows(pool: &signapps_db::DatabasePool, entity_type: &str) -> Result<Vec<CommsRow>> {
    if let Err(e) = ensure_table(pool).await {
        tracing::warn!("comms_data ensure failed: {}", e);
    }
    let rows: Vec<CommsRow> = sqlx::query_as(
        "SELECT * FROM platform.comms_data WHERE entity_type = $1 ORDER BY created_at DESC",
    )
    .bind(entity_type)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("comms list: {}", e)))?;
    Ok(rows)
}

async fn patch_row(pool: &signapps_db::DatabasePool, id: Uuid, patch: &Value) -> Result<CommsRow> {
    if let Err(e) = ensure_table(pool).await {
        tracing::warn!("comms_data ensure failed: {}", e);
    }
    let row: CommsRow = sqlx::query_as(
        r#"
        UPDATE platform.comms_data
           SET data = data || $2, updated_at = NOW()
         WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(patch)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("comms patch: {}", e)))?;
    Ok(row)
}

// ── Announcements ─────────────────────────────────────────────────────────────

/// `GET /api/v1/comms/announcements` — list announcements.
#[utoipa::path(
    get,
    path = "/api/v1/comms/announcements",
    tag = "comms",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of announcements", body = Vec<CommsRecord>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_announcements(State(state): State<AppState>) -> Result<Json<Vec<CommsRecord>>> {
    let rows = list_rows(&state.pool, "announcement").await?;
    Ok(Json(rows.into_iter().map(CommsRecord::from).collect()))
}

/// `POST /api/v1/comms/announcements` — create announcement.
#[utoipa::path(
    post,
    path = "/api/v1/comms/announcements",
    tag = "comms",
    security(("bearerAuth" = [])),
    request_body(content = serde_json::Value, description = "Announcement data"),
    responses(
        (status = 201, description = "Announcement created", body = CommsRecord),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn create_announcement(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> Result<(StatusCode, Json<CommsRecord>)> {
    let row = insert_row(&state.pool, "announcement", &body).await?;
    Ok((StatusCode::CREATED, Json(row.into())))
}

// ── Polls ─────────────────────────────────────────────────────────────────────

/// `GET /api/v1/comms/polls` — list polls.
#[utoipa::path(
    get,
    path = "/api/v1/comms/polls",
    tag = "comms",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of polls", body = Vec<CommsRecord>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_polls(State(state): State<AppState>) -> Result<Json<Vec<CommsRecord>>> {
    let rows = list_rows(&state.pool, "poll").await?;
    Ok(Json(rows.into_iter().map(CommsRecord::from).collect()))
}

/// `POST /api/v1/comms/polls` — create poll.
#[utoipa::path(
    post,
    path = "/api/v1/comms/polls",
    tag = "comms",
    security(("bearerAuth" = [])),
    request_body(content = serde_json::Value, description = "Poll data"),
    responses(
        (status = 201, description = "Poll created", body = CommsRecord),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn create_poll(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> Result<(StatusCode, Json<CommsRecord>)> {
    let row = insert_row(&state.pool, "poll", &body).await?;
    Ok((StatusCode::CREATED, Json(row.into())))
}

/// `PATCH /api/v1/comms/polls/:id` — vote or update a poll.
#[utoipa::path(
    patch,
    path = "/api/v1/comms/polls/{id}",
    tag = "comms",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Poll UUID")),
    request_body(content = serde_json::Value, description = "Poll update / vote data"),
    responses(
        (status = 200, description = "Updated poll record", body = CommsRecord),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn patch_poll(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<Value>,
) -> Result<Json<CommsRecord>> {
    let row = patch_row(&state.pool, id, &body).await?;
    Ok(Json(row.into()))
}

// ── News Feed ─────────────────────────────────────────────────────────────────

/// `GET /api/v1/comms/news-feed` — list news posts.
#[utoipa::path(
    get,
    path = "/api/v1/comms/news-feed",
    tag = "comms",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of news posts", body = Vec<CommsRecord>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_news(State(state): State<AppState>) -> Result<Json<Vec<CommsRecord>>> {
    let rows = list_rows(&state.pool, "news_post").await?;
    Ok(Json(rows.into_iter().map(CommsRecord::from).collect()))
}

/// `POST /api/v1/comms/news-feed` — create news post.
#[utoipa::path(
    post,
    path = "/api/v1/comms/news-feed",
    tag = "comms",
    security(("bearerAuth" = [])),
    request_body(content = serde_json::Value, description = "News post data"),
    responses(
        (status = 201, description = "News post created", body = CommsRecord),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn create_news(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> Result<(StatusCode, Json<CommsRecord>)> {
    let row = insert_row(&state.pool, "news_post", &body).await?;
    Ok((StatusCode::CREATED, Json(row.into())))
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }
}
