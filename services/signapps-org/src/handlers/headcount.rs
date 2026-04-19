//! SO3 handlers for `/api/v1/org/headcount`.
//!
//! Endpoints :
//! - `GET    /api/v1/org/headcount?tenant_id=X`                  — list plans + rollups
//! - `GET    /api/v1/org/headcount/rollup?tenant_id=X&node_id=Y` — single rollup
//! - `POST   /api/v1/org/headcount`                              — create plan
//! - `PUT    /api/v1/org/headcount/:id`                          — update
//! - `DELETE /api/v1/org/headcount/:id`                          — delete

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use signapps_common::pg_events::NewEvent;
use signapps_common::{Error, Result};
use signapps_db::models::org::{HeadcountPlan, HeadcountRollup};
use signapps_db::repositories::org::HeadcountRepository;
use uuid::Uuid;

use crate::AppState;

/// Build the headcount router (nested at `/api/v1/org/headcount`).
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/rollup", get(rollup_single))
        .route("/:id", axum::routing::put(update).delete(delete_plan))
}

// ─── DTOs ───────────────────────────────────────────────────────────

/// Query params for `GET /api/v1/org/headcount`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListQuery {
    /// Tenant UUID — required.
    pub tenant_id: Uuid,
    /// Optional node filter.
    pub node_id: Option<Uuid>,
}

/// Query for single rollup.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct RollupQuery {
    /// Tenant UUID — required.
    pub tenant_id: Uuid,
    /// Node UUID — required.
    pub node_id: Uuid,
}

/// Request body for `POST /api/v1/org/headcount`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreatePlanBody {
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Node ciblé.
    pub node_id: Uuid,
    /// Effectif cible.
    pub target_head_count: i32,
    /// Date d'atteinte visée.
    pub target_date: NaiveDate,
    /// Notes libres.
    pub notes: Option<String>,
}

/// Request body for `PUT /api/v1/org/headcount/:id`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdatePlanBody {
    /// Nouveau head_count.
    pub target_head_count: Option<i32>,
    /// Nouvelle date.
    pub target_date: Option<NaiveDate>,
    /// Nouvelles notes.
    pub notes: Option<String>,
}

/// Combined response : plans + per-node rollups.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct PlansWithRollups {
    /// Plans.
    pub plans: Vec<HeadcountPlan>,
    /// Rollups calculés pour les nodes référencés.
    pub rollups: Vec<HeadcountRollup>,
}

// ─── Handlers ───────────────────────────────────────────────────────

/// GET /api/v1/org/headcount — list plans + auto-rollup per node.
#[utoipa::path(
    get,
    path = "/api/v1/org/headcount",
    tag = "Org",
    params(ListQuery),
    responses(
        (status = 200, description = "Plans + rollups", body = PlansWithRollups),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<PlansWithRollups>> {
    let repo = HeadcountRepository::new(st.pool.inner());
    let plans = repo
        .list_by_tenant(q.tenant_id, q.node_id)
        .await
        .map_err(|e| Error::Database(format!("list headcount plans: {e}")))?;

    // Dédupliquer les nodes pour lesquels calculer un rollup.
    let mut unique_nodes: Vec<Uuid> = plans.iter().map(|p| p.node_id).collect();
    unique_nodes.sort_unstable();
    unique_nodes.dedup();

    let mut rollups = Vec::with_capacity(unique_nodes.len());
    for node_id in unique_nodes {
        let r = repo
            .compute_rollup(q.tenant_id, node_id)
            .await
            .map_err(|e| Error::Database(format!("rollup: {e}")))?;
        rollups.push(r);
    }

    Ok(Json(PlansWithRollups { plans, rollups }))
}

/// GET /api/v1/org/headcount/rollup — single node rollup.
#[utoipa::path(
    get,
    path = "/api/v1/org/headcount/rollup",
    tag = "Org",
    params(RollupQuery),
    responses(
        (status = 200, description = "Rollup", body = HeadcountRollup),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn rollup_single(
    State(st): State<AppState>,
    Query(q): Query<RollupQuery>,
) -> Result<Json<HeadcountRollup>> {
    let r = HeadcountRepository::new(st.pool.inner())
        .compute_rollup(q.tenant_id, q.node_id)
        .await
        .map_err(|e| Error::Database(format!("rollup: {e}")))?;
    Ok(Json(r))
}

/// POST /api/v1/org/headcount — create a plan.
#[utoipa::path(
    post,
    path = "/api/v1/org/headcount",
    tag = "Org",
    request_body = CreatePlanBody,
    responses(
        (status = 201, description = "Plan created", body = HeadcountPlan),
        (status = 400, description = "Invalid body"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn create(
    State(st): State<AppState>,
    Json(body): Json<CreatePlanBody>,
) -> Result<(StatusCode, Json<HeadcountPlan>)> {
    let plan = HeadcountRepository::new(st.pool.inner())
        .create(
            body.tenant_id,
            body.node_id,
            body.target_head_count,
            body.target_date,
            body.notes.as_deref(),
        )
        .await
        .map_err(|e| Error::Database(format!("create plan: {e}")))?;

    if let Ok(payload) = serde_json::to_value(&plan) {
        let _ = st
            .event_bus
            .publish(NewEvent {
                event_type: "org.headcount_plan.created".to_string(),
                aggregate_id: Some(plan.id),
                payload,
            })
            .await;
    }
    Ok((StatusCode::CREATED, Json(plan)))
}

/// PUT /api/v1/org/headcount/:id — update a plan.
#[utoipa::path(
    put,
    path = "/api/v1/org/headcount/{id}",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Plan UUID")),
    request_body = UpdatePlanBody,
    responses(
        (status = 200, description = "Plan updated", body = HeadcountPlan),
        (status = 404, description = "Plan not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn update(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePlanBody>,
) -> Result<Json<HeadcountPlan>> {
    let plan = HeadcountRepository::new(st.pool.inner())
        .update(id, body.target_head_count, body.target_date, body.notes.as_deref())
        .await
        .map_err(|e| Error::Database(format!("update plan: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("plan {id}")))?;
    Ok(Json(plan))
}

/// DELETE /api/v1/org/headcount/:id — delete plan.
#[utoipa::path(
    delete,
    path = "/api/v1/org/headcount/{id}",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Plan UUID")),
    responses(
        (status = 204, description = "Plan deleted"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn delete_plan(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    HeadcountRepository::new(st.pool.inner())
        .delete(id)
        .await
        .map_err(|e| Error::Database(format!("delete plan: {e}")))?;
    Ok(StatusCode::NO_CONTENT)
}
