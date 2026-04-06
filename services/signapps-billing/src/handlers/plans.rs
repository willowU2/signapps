//! Billing plan CRUD handlers.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{AppState, Plan};

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/// Request payload for creating a new billing plan.
#[derive(Debug, Deserialize)]
pub struct CreatePlanRequest {
    pub name: String,
    pub description: Option<String>,
    pub price_cents: i32,
    pub currency: Option<String>,
    pub features: Option<serde_json::Value>,
}

/// Request payload for updating an existing billing plan.
#[derive(Debug, Deserialize)]
pub struct UpdatePlanRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub price_cents: Option<i32>,
    pub currency: Option<String>,
    pub features: Option<serde_json::Value>,
    pub is_active: Option<bool>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// List all billing plans ordered by price ascending.
pub async fn list_plans(
    State(state): State<AppState>,
) -> Result<Json<Vec<Plan>>, (StatusCode, String)> {
    let plans = sqlx::query_as::<_, Plan>("SELECT * FROM billing.plans ORDER BY price_cents ASC")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list plans: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?;

    Ok(Json(plans))
}

/// Create a new billing plan.
pub async fn create_plan(
    State(state): State<AppState>,
    Json(payload): Json<CreatePlanRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    if payload.name.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Plan name cannot be empty".to_string(),
        ));
    }
    let plan = sqlx::query_as::<_, Plan>(
        r#"INSERT INTO billing.plans (name, description, price_cents, currency, features)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *"#,
    )
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(payload.price_cents)
    .bind(payload.currency.as_deref().unwrap_or("EUR"))
    .bind(payload.features.unwrap_or(serde_json::json!([])))
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create plan: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;
    tracing::info!(id = %plan.id, name = %plan.name, "Plan created");
    Ok((StatusCode::CREATED, Json(plan)))
}

/// Update an existing billing plan by UUID.
pub async fn update_plan(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdatePlanRequest>,
) -> Result<Json<Plan>, (StatusCode, String)> {
    let plan = sqlx::query_as::<_, Plan>(
        r#"UPDATE billing.plans SET
            name        = COALESCE($2, name),
            description = COALESCE($3, description),
            price_cents = COALESCE($4, price_cents),
            currency    = COALESCE($5, currency),
            features    = COALESCE($6, features),
            is_active   = COALESCE($7, is_active)
           WHERE id = $1
           RETURNING *"#,
    )
    .bind(id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(payload.price_cents)
    .bind(&payload.currency)
    .bind(&payload.features)
    .bind(payload.is_active)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update plan {}: {}", id, e);
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?
    .ok_or_else(|| (StatusCode::NOT_FOUND, "Plan not found".to_string()))?;
    tracing::info!(id = %id, "Plan updated");
    Ok(Json(plan))
}

/// Delete a billing plan by UUID.
// TODO: add tenant_id column to billing.plans for tenant isolation
pub async fn delete_plan(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let r = sqlx::query("DELETE FROM billing.plans WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete plan {}: {}", id, e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?;
    if r.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Plan not found".to_string()));
    }
    tracing::info!(id = %id, "Plan deleted");
    Ok(StatusCode::NO_CONTENT)
}
