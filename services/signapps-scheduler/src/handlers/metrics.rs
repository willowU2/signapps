use axum::{
    extract::{Extension, Query, State},
    Json,
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use signapps_common::{Claims, TenantContext};
use signapps_common::Result;
use signapps_db::repositories::{MetricsRepository, ResourceMetrics, WorkloadMetrics};

use crate::AppState;

#[derive(Deserialize)]
pub struct MetricsQuery {
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
}

/// Retrieve workload metrics for the authenticated user
pub async fn get_workload(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
    Query(query): Query<MetricsQuery>,
) -> Result<Json<WorkloadMetrics>> {
    let repo = MetricsRepository::new(&state.pool);

    let metrics = repo
        .get_workload_metrics(
            ctx.tenant_id,
            claims.sub,
            query.start_date,
            query.end_date,
        )
        .await?;

    Ok(Json(metrics))
}

/// Retrieve resource metrics for the authenticated user
pub async fn get_resources(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
) -> Result<Json<ResourceMetrics>> {
    let repo = MetricsRepository::new(&state.pool);

    let metrics = repo
        .get_resource_metrics(ctx.tenant_id, claims.sub)
        .await?;

    Ok(Json(metrics))
}
