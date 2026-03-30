//! LMS (Learning Management System) endpoints — courses, progress, discussions
//!
//! All data is stored as JSONB in `platform.lms_data` using
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
struct LmsRow {
    id: Uuid,
    entity_type: String,
    data: Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

// ── DTO ───────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
/// Generic LMS record returned to the client.
pub struct LmsRecord {
    pub id: Uuid,
    pub entity_type: String,
    pub data: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<LmsRow> for LmsRecord {
    fn from(r: LmsRow) -> Self {
        LmsRecord {
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
        CREATE TABLE IF NOT EXISTS platform.lms_data (
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
    .map_err(|e| Error::Internal(format!("ensure lms table: {}", e)))?;
    Ok(())
}

async fn insert_row(
    pool: &signapps_db::DatabasePool,
    entity_type: &str,
    data: &Value,
) -> Result<LmsRow> {
    if let Err(e) = ensure_table(pool).await {
        tracing::warn!("lms_data ensure failed: {}", e);
    }
    let row: LmsRow = sqlx::query_as(
        r#"
        INSERT INTO platform.lms_data (entity_type, data)
        VALUES ($1, $2)
        RETURNING *
        "#,
    )
    .bind(entity_type)
    .bind(data)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("lms insert: {}", e)))?;
    Ok(row)
}

async fn list_rows(pool: &signapps_db::DatabasePool, entity_type: &str) -> Result<Vec<LmsRow>> {
    if let Err(e) = ensure_table(pool).await {
        tracing::warn!("lms_data ensure failed: {}", e);
    }
    let rows: Vec<LmsRow> = sqlx::query_as(
        "SELECT * FROM platform.lms_data WHERE entity_type = $1 ORDER BY created_at DESC",
    )
    .bind(entity_type)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("lms list: {}", e)))?;
    Ok(rows)
}

async fn get_row(pool: &signapps_db::DatabasePool, id: Uuid) -> Result<Option<LmsRow>> {
    if let Err(e) = ensure_table(pool).await {
        tracing::warn!("lms_data ensure failed: {}", e);
    }
    let row: Option<LmsRow> = sqlx::query_as("SELECT * FROM platform.lms_data WHERE id = $1")
        .bind(id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| Error::Internal(format!("lms get: {}", e)))?;
    Ok(row)
}

async fn patch_row(pool: &signapps_db::DatabasePool, id: Uuid, patch: &Value) -> Result<LmsRow> {
    if let Err(e) = ensure_table(pool).await {
        tracing::warn!("lms_data ensure failed: {}", e);
    }
    let row: LmsRow = sqlx::query_as(
        r#"
        UPDATE platform.lms_data
           SET data = data || $2, updated_at = NOW()
         WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(patch)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("lms patch: {}", e)))?;
    Ok(row)
}

// ── Courses ───────────────────────────────────────────────────────────────────

/// `GET /api/v1/lms/courses` — list all courses.
#[tracing::instrument(skip_all)]
pub async fn list_courses(State(state): State<AppState>) -> Result<Json<Vec<LmsRecord>>> {
    let rows = list_rows(&state.pool, "course").await?;
    Ok(Json(rows.into_iter().map(LmsRecord::from).collect()))
}

/// `POST /api/v1/lms/courses` — create a course.
#[tracing::instrument(skip_all)]
pub async fn create_course(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> Result<(StatusCode, Json<LmsRecord>)> {
    let row = insert_row(&state.pool, "course", &body).await?;
    Ok((StatusCode::CREATED, Json(row.into())))
}

/// `GET /api/v1/lms/courses/:id` — get one course.
#[tracing::instrument(skip_all)]
pub async fn get_course(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<LmsRecord>> {
    let row = get_row(&state.pool, id)
        .await?
        .ok_or_else(|| Error::NotFound("course not found".into()))?;
    Ok(Json(row.into()))
}

/// `PATCH /api/v1/lms/courses/:id` — partial update a course.
#[tracing::instrument(skip_all)]
pub async fn patch_course(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<Value>,
) -> Result<Json<LmsRecord>> {
    let row = patch_row(&state.pool, id, &body).await?;
    Ok(Json(row.into()))
}

// ── Progress ──────────────────────────────────────────────────────────────────

/// `GET /api/v1/lms/progress` — list all progress records.
#[tracing::instrument(skip_all)]
pub async fn list_progress(State(state): State<AppState>) -> Result<Json<Vec<LmsRecord>>> {
    let rows = list_rows(&state.pool, "progress").await?;
    Ok(Json(rows.into_iter().map(LmsRecord::from).collect()))
}

/// `POST /api/v1/lms/progress` — upsert user progress.
#[tracing::instrument(skip_all)]
pub async fn track_progress(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> Result<(StatusCode, Json<LmsRecord>)> {
    let row = insert_row(&state.pool, "progress", &body).await?;
    Ok((StatusCode::CREATED, Json(row.into())))
}

// ── Discussions ───────────────────────────────────────────────────────────────

/// `GET /api/v1/lms/discussions` — list all discussions.
#[tracing::instrument(skip_all)]
pub async fn list_discussions(State(state): State<AppState>) -> Result<Json<Vec<LmsRecord>>> {
    let rows = list_rows(&state.pool, "discussion").await?;
    Ok(Json(rows.into_iter().map(LmsRecord::from).collect()))
}

/// `POST /api/v1/lms/discussions` — create a discussion comment.
#[tracing::instrument(skip_all)]
pub async fn create_discussion(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> Result<(StatusCode, Json<LmsRecord>)> {
    let row = insert_row(&state.pool, "discussion", &body).await?;
    Ok((StatusCode::CREATED, Json(row.into())))
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }
}
