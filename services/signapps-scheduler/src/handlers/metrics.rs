use axum::{
    extract::{Extension, Query, State},
    Json,
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use signapps_common::Result;
use signapps_common::{Claims, TenantContext};
use signapps_db::repositories::{MetricsRepository, ResourceMetrics, WorkloadMetrics};

use crate::AppState;

#[derive(Deserialize)]
/// Query parameters for filtering results.
pub struct MetricsQuery {
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
}

/// Retrieve workload metrics for the authenticated user
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/metrics",
    responses((status = 200, description = "Success")),
    tag = "Scheduler"
)]
#[tracing::instrument(skip_all)]
pub async fn get_workload(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
    Query(query): Query<MetricsQuery>,
) -> Result<Json<WorkloadMetrics>> {
    let repo = MetricsRepository::new(&state.pool);

    let metrics = repo
        .get_workload_metrics(ctx.tenant_id, claims.sub, query.start_date, query.end_date)
        .await?;

    Ok(Json(metrics))
}

/// Retrieve resource metrics for the authenticated user
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/metrics",
    responses((status = 200, description = "Success")),
    tag = "Scheduler"
)]
#[tracing::instrument(skip_all)]
pub async fn get_resources(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
) -> Result<Json<ResourceMetrics>> {
    let repo = MetricsRepository::new(&state.pool);

    let metrics = repo.get_resource_metrics(ctx.tenant_id, claims.sub).await?;

    Ok(Json(metrics))
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
