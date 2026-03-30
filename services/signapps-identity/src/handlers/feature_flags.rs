//! Feature flag management handlers (admin only).
//!
//! Manages global feature flags stored in identity.feature_flags.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use uuid::Uuid;

use crate::AppState;

#[derive(Debug, Serialize)]
/// FeatureFlag data transfer object.
pub struct FeatureFlag {
    pub id: Uuid,
    pub name: String,
    pub enabled: bool,
    pub rollout_pct: i16,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
/// Request body for CreateFeatureFlag.
pub struct CreateFeatureFlagRequest {
    pub name: String,
    pub enabled: Option<bool>,
    pub rollout_pct: Option<i16>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
/// Request body for UpdateFeatureFlag.
pub struct UpdateFeatureFlagRequest {
    pub name: Option<String>,
    pub enabled: Option<bool>,
    pub rollout_pct: Option<i16>,
    pub description: Option<String>,
}

type FlagRow = (
    Uuid,
    String,
    bool,
    i16,
    Option<String>,
    DateTime<Utc>,
    DateTime<Utc>,
);

fn row_to_flag(r: FlagRow) -> FeatureFlag {
    FeatureFlag {
        id: r.0,
        name: r.1,
        enabled: r.2,
        rollout_pct: r.3,
        description: r.4,
        created_at: r.5,
        updated_at: r.6,
    }
}

/// GET /api/v1/admin/feature-flags — List all feature flags.
#[tracing::instrument(skip(state))]
#[utoipa::path(
    get,
    path = "/api/v1/feature_flags",
    responses((status = 200, description = "Success")),
    tag = "Identity"
)]
pub async fn list(State(state): State<AppState>) -> Result<Json<Vec<FeatureFlag>>> {
    let rows = sqlx::query_as::<_, FlagRow>(
        "SELECT id, name, enabled, rollout_pct, description, created_at, updated_at
         FROM identity.feature_flags
         ORDER BY name",
    )
    .fetch_all(&*state.pool)
    .await?;

    Ok(Json(rows.into_iter().map(row_to_flag).collect()))
}

/// POST /api/v1/admin/feature-flags — Create a feature flag.
#[tracing::instrument(skip(state, payload))]
#[utoipa::path(
    post,
    path = "/api/v1/feature_flags",
    responses((status = 201, description = "Success")),
    tag = "Identity"
)]
pub async fn create(
    State(state): State<AppState>,
    Json(payload): Json<CreateFeatureFlagRequest>,
) -> Result<(StatusCode, Json<FeatureFlag>)> {
    if payload.name.is_empty() || payload.name.len() > 128 {
        return Err(Error::Validation(
            "Name must be 1-128 characters".to_string(),
        ));
    }

    let rollout = payload.rollout_pct.unwrap_or(0);
    if !(0..=100).contains(&rollout) {
        return Err(Error::Validation("rollout_pct must be 0-100".to_string()));
    }

    let row = sqlx::query_as::<_, FlagRow>(
        r#"INSERT INTO identity.feature_flags (name, enabled, rollout_pct, description)
           VALUES ($1, $2, $3, $4)
           RETURNING id, name, enabled, rollout_pct, description, created_at, updated_at"#,
    )
    .bind(&payload.name)
    .bind(payload.enabled.unwrap_or(false))
    .bind(rollout)
    .bind(payload.description)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| {
        if e.to_string().contains("unique") {
            Error::AlreadyExists(format!("Feature flag '{}' already exists", payload.name))
        } else {
            Error::Database(e.to_string())
        }
    })?;

    Ok((StatusCode::CREATED, Json(row_to_flag(row))))
}

/// PUT /api/v1/admin/feature-flags/:id — Replace a feature flag.
#[tracing::instrument(skip(state, payload))]
#[utoipa::path(
    put,
    path = "/api/v1/feature_flags",
    responses((status = 200, description = "Success")),
    tag = "Identity"
)]
pub async fn update(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateFeatureFlagRequest>,
) -> Result<Json<FeatureFlag>> {
    if let Some(ref name) = payload.name {
        if name.is_empty() || name.len() > 128 {
            return Err(Error::Validation(
                "Name must be 1-128 characters".to_string(),
            ));
        }
    }
    if let Some(pct) = payload.rollout_pct {
        if !(0..=100).contains(&pct) {
            return Err(Error::Validation("rollout_pct must be 0-100".to_string()));
        }
    }

    let row = sqlx::query_as::<_, FlagRow>(
        r#"UPDATE identity.feature_flags
           SET name        = COALESCE($2, name),
               enabled     = COALESCE($3, enabled),
               rollout_pct = COALESCE($4, rollout_pct),
               description = COALESCE($5, description),
               updated_at  = NOW()
           WHERE id = $1
           RETURNING id, name, enabled, rollout_pct, description, created_at, updated_at"#,
    )
    .bind(id)
    .bind(payload.name)
    .bind(payload.enabled)
    .bind(payload.rollout_pct)
    .bind(payload.description)
    .fetch_optional(&*state.pool)
    .await?
    .ok_or_else(|| Error::NotFound(format!("Feature flag {}", id)))?;

    Ok(Json(row_to_flag(row)))
}

/// DELETE /api/v1/admin/feature-flags/:id — Delete a feature flag.
#[tracing::instrument(skip(state))]
#[utoipa::path(
    delete,
    path = "/api/v1/feature_flags/{id}",
    responses((status = 204, description = "Success")),
    tag = "Identity"
)]
pub async fn delete(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<StatusCode> {
    let result = sqlx::query("DELETE FROM identity.feature_flags WHERE id = $1")
        .bind(id)
        .execute(&*state.pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(Error::NotFound(format!("Feature flag {}", id)));
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
