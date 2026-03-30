use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use chrono::{DateTime, Utc};
use signapps_common::{Claims, Error, Result};
use uuid::Uuid;

use crate::AppState;

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
/// EsgScore data transfer object.
pub struct EsgScore {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub category: String,
    pub score: f64,
    pub trend: Option<String>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
/// EsgQuarterly data transfer object.
pub struct EsgQuarterly {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub quarter: i32,
    pub year: i32,
    pub score: f64,
}

#[derive(Debug, serde::Deserialize)]
/// Request body for UpsertEsgScore.
pub struct UpsertEsgScoreRequest {
    pub category: String,
    pub score: f64,
    pub trend: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
/// Request body for UpsertEsgQuarterly.
pub struct UpsertEsgQuarterlyRequest {
    pub quarter: i32,
    pub year: i32,
    pub score: f64,
}

// ---------------------------------------------------------------------------
// Handlers — Scores
// ---------------------------------------------------------------------------

/// GET /api/v1/esg/scores
#[tracing::instrument(skip_all)]
pub async fn get_esg_scores(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse> {
    let pool = state.pool.inner();
    let rows = sqlx::query_as::<_, EsgScore>(
        "SELECT id, tenant_id, category, score, trend, updated_at
         FROM metrics.esg_scores
         WHERE tenant_id = $1
         ORDER BY category",
    )
    .bind(claims.sub)
    .fetch_all(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok((StatusCode::OK, Json(serde_json::json!(rows))))
}

/// PUT /api/v1/esg/scores
#[tracing::instrument(skip_all)]
pub async fn upsert_esg_score(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<UpsertEsgScoreRequest>,
) -> Result<impl IntoResponse> {
    if payload.category.trim().is_empty() {
        return Err(Error::Validation("Category cannot be empty".to_string()));
    }

    let pool = state.pool.inner();
    let row = sqlx::query_as::<_, EsgScore>(
        "INSERT INTO metrics.esg_scores (id, tenant_id, category, score, trend, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
         ON CONFLICT (tenant_id, category) DO UPDATE
             SET score      = EXCLUDED.score,
                 trend      = EXCLUDED.trend,
                 updated_at = NOW()
         RETURNING id, tenant_id, category, score, trend, updated_at",
    )
    .bind(claims.sub)
    .bind(&payload.category)
    .bind(payload.score)
    .bind(&payload.trend)
    .fetch_one(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok((StatusCode::OK, Json(serde_json::json!(row))))
}

// ---------------------------------------------------------------------------
// Handlers — Quarterly
// ---------------------------------------------------------------------------

/// GET /api/v1/esg/quarterly
#[tracing::instrument(skip_all)]
pub async fn get_esg_quarterly(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse> {
    let pool = state.pool.inner();
    let rows = sqlx::query_as::<_, EsgQuarterly>(
        "SELECT id, tenant_id, quarter, year, score
         FROM metrics.esg_quarterly
         WHERE tenant_id = $1
         ORDER BY year DESC, quarter DESC",
    )
    .bind(claims.sub)
    .fetch_all(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok((StatusCode::OK, Json(serde_json::json!(rows))))
}

/// PUT /api/v1/esg/quarterly
#[tracing::instrument(skip_all)]
pub async fn upsert_esg_quarterly(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<UpsertEsgQuarterlyRequest>,
) -> Result<impl IntoResponse> {
    if payload.quarter < 1 || payload.quarter > 4 {
        return Err(Error::Validation(
            "Quarter must be between 1 and 4".to_string(),
        ));
    }

    let pool = state.pool.inner();
    let row = sqlx::query_as::<_, EsgQuarterly>(
        "INSERT INTO metrics.esg_quarterly (id, tenant_id, quarter, year, score)
         VALUES (gen_random_uuid(), $1, $2, $3, $4)
         ON CONFLICT (tenant_id, quarter, year) DO UPDATE
             SET score = EXCLUDED.score
         RETURNING id, tenant_id, quarter, year, score",
    )
    .bind(claims.sub)
    .bind(payload.quarter)
    .bind(payload.year)
    .bind(payload.score)
    .fetch_one(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok((StatusCode::OK, Json(serde_json::json!(row))))
}
