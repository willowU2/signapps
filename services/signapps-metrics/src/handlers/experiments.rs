use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use signapps_common::{Claims, Error, Result};
use uuid::Uuid;

use crate::AppState;

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
/// Experiment data transfer object.
pub struct Experiment {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub variants: serde_json::Value,
    pub traffic_split: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, serde::Deserialize)]
/// Request body for CreateExperiment.
pub struct CreateExperimentRequest {
    pub name: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub variants: Option<serde_json::Value>,
    pub traffic_split: Option<serde_json::Value>,
}

#[derive(Debug, serde::Deserialize)]
/// Request body for UpdateExperiment.
pub struct UpdateExperimentRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub variants: Option<serde_json::Value>,
    pub traffic_split: Option<serde_json::Value>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/experiments",
    responses((status = 200, description = "Success")),
    tag = "Metrics"
)]
pub async fn list_experiments(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> Result<impl IntoResponse> {
    let pool = state.pool.inner();
    let rows = sqlx::query_as::<_, Experiment>(
        "SELECT id, name, description, status, variants, traffic_split, created_at, updated_at
         FROM metrics.experiments
         ORDER BY created_at DESC
         LIMIT 200",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok((StatusCode::OK, Json(serde_json::json!(rows))))
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/experiments",
    responses((status = 201, description = "Success")),
    tag = "Metrics"
)]
pub async fn create_experiment(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Json(payload): Json<CreateExperimentRequest>,
) -> Result<impl IntoResponse> {
    if payload.name.trim().is_empty() {
        return Err(Error::Validation(
            "Experiment name cannot be empty".to_string(),
        ));
    }

    let pool = state.pool.inner();
    let id = Uuid::new_v4();
    let now = Utc::now();
    let status = payload.status.unwrap_or_else(|| "draft".to_string());
    let variants = payload.variants.unwrap_or_else(|| serde_json::json!([]));
    let traffic_split = payload
        .traffic_split
        .unwrap_or_else(|| serde_json::json!({}));

    let row = sqlx::query_as::<_, Experiment>(
        "INSERT INTO metrics.experiments
            (id, name, description, status, variants, traffic_split, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, name, description, status, variants, traffic_split, created_at, updated_at",
    )
    .bind(id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&status)
    .bind(&variants)
    .bind(&traffic_split)
    .bind(now)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok((StatusCode::CREATED, Json(serde_json::json!(row))))
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    put,
    path = "/api/v1/experiments",
    responses((status = 200, description = "Success")),
    tag = "Metrics"
)]
pub async fn update_experiment(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateExperimentRequest>,
) -> Result<impl IntoResponse> {
    let pool = state.pool.inner();

    let existing = sqlx::query_as::<_, Experiment>(
        "SELECT id, name, description, status, variants, traffic_split, created_at, updated_at
         FROM metrics.experiments WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?
    .ok_or_else(|| Error::NotFound(format!("Experiment {id}")))?;

    let name = payload.name.unwrap_or(existing.name);
    let description = payload.description.or(existing.description);
    let status = payload.status.unwrap_or(existing.status);
    let variants = payload.variants.unwrap_or(existing.variants);
    let traffic_split = payload.traffic_split.unwrap_or(existing.traffic_split);

    let row = sqlx::query_as::<_, Experiment>(
        "UPDATE metrics.experiments
         SET name = $1, description = $2, status = $3, variants = $4,
             traffic_split = $5, updated_at = NOW()
         WHERE id = $6
         RETURNING id, name, description, status, variants, traffic_split, created_at, updated_at",
    )
    .bind(&name)
    .bind(&description)
    .bind(&status)
    .bind(&variants)
    .bind(&traffic_split)
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok((StatusCode::OK, Json(serde_json::json!(row))))
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    delete,
    path = "/api/v1/experiments",
    responses((status = 204, description = "Success")),
    tag = "Metrics"
)]
pub async fn delete_experiment(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let pool = state.pool.inner();
    let result = sqlx::query("DELETE FROM metrics.experiments WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    if result.rows_affected() > 0 {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(Error::NotFound(format!("Experiment {id}")))
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
