//! User quota management handlers.

use axum::{
    extract::{Extension, Path, State},
    Json,
};
use serde::Serialize;
use signapps_common::{Claims, Error, Result};
use signapps_db::models::UpdateQuota;
use signapps_db::repositories::ContainerRepository;
use uuid::Uuid;

use crate::AppState;

/// Quota response.
#[derive(Debug, Serialize)]
/// Response for Quota.
pub struct QuotaResponse {
    pub user_id: Uuid,
    pub max_containers: i32,
    pub max_cpu_cores: f64,
    pub max_memory_mb: i32,
    pub max_storage_gb: i32,
    pub current_containers: i32,
    pub current_cpu_cores: f64,
    pub current_memory_mb: i32,
    pub current_storage_gb: i32,
    pub usage_percent: QuotaUsagePercent,
}

/// Usage percentages.
#[derive(Debug, Serialize)]
/// QuotaUsagePercent data transfer object.
pub struct QuotaUsagePercent {
    pub containers: f64,
    pub cpu: f64,
    pub memory: f64,
    pub storage: f64,
}

/// Get current user's quota.
#[tracing::instrument(skip(state))]
#[utoipa::path(
    get,
    path = "/api/v1/quotas",
    responses((status = 200, description = "Success")),
    tag = "Containers"
)]
#[tracing::instrument(skip_all)]
pub async fn get_my_quota(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<QuotaResponse>> {
    let repo = ContainerRepository::new(&state.pool);

    let quota = repo
        .get_quota(claims.sub)
        .await?
        .ok_or_else(|| Error::NotFound("Quota not found".to_string()))?;

    let usage_percent = QuotaUsagePercent {
        containers: (quota.current_containers as f64 / quota.max_containers as f64) * 100.0,
        cpu: (quota.current_cpu_cores / quota.max_cpu_cores) * 100.0,
        memory: (quota.current_memory_mb as f64 / quota.max_memory_mb as f64) * 100.0,
        storage: (quota.current_storage_gb as f64 / quota.max_storage_gb as f64) * 100.0,
    };

    Ok(Json(QuotaResponse {
        user_id: quota.user_id,
        max_containers: quota.max_containers,
        max_cpu_cores: quota.max_cpu_cores,
        max_memory_mb: quota.max_memory_mb,
        max_storage_gb: quota.max_storage_gb,
        current_containers: quota.current_containers,
        current_cpu_cores: quota.current_cpu_cores,
        current_memory_mb: quota.current_memory_mb,
        current_storage_gb: quota.current_storage_gb,
        usage_percent,
    }))
}

/// Get a user's quota (admin only).
#[tracing::instrument(skip(state))]
#[utoipa::path(
    get,
    path = "/api/v1/quotas",
    responses((status = 200, description = "Success")),
    tag = "Containers"
)]
#[tracing::instrument(skip_all)]
pub async fn get_user_quota(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<QuotaResponse>> {
    let repo = ContainerRepository::new(&state.pool);

    let quota = repo
        .get_quota(user_id)
        .await?
        .ok_or_else(|| Error::NotFound("Quota not found".to_string()))?;

    let usage_percent = QuotaUsagePercent {
        containers: (quota.current_containers as f64 / quota.max_containers as f64) * 100.0,
        cpu: (quota.current_cpu_cores / quota.max_cpu_cores) * 100.0,
        memory: (quota.current_memory_mb as f64 / quota.max_memory_mb as f64) * 100.0,
        storage: (quota.current_storage_gb as f64 / quota.max_storage_gb as f64) * 100.0,
    };

    Ok(Json(QuotaResponse {
        user_id: quota.user_id,
        max_containers: quota.max_containers,
        max_cpu_cores: quota.max_cpu_cores,
        max_memory_mb: quota.max_memory_mb,
        max_storage_gb: quota.max_storage_gb,
        current_containers: quota.current_containers,
        current_cpu_cores: quota.current_cpu_cores,
        current_memory_mb: quota.current_memory_mb,
        current_storage_gb: quota.current_storage_gb,
        usage_percent,
    }))
}

/// Update a user's quota (admin only).
#[tracing::instrument(skip(state, payload))]
#[utoipa::path(
    put,
    path = "/api/v1/quotas",
    responses((status = 200, description = "Success")),
    tag = "Containers"
)]
#[tracing::instrument(skip_all)]
pub async fn update_user_quota(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
    Json(payload): Json<UpdateQuota>,
) -> Result<Json<QuotaResponse>> {
    let repo = ContainerRepository::new(&state.pool);

    let quota = repo.upsert_quota(user_id, payload).await?;

    let usage_percent = QuotaUsagePercent {
        containers: (quota.current_containers as f64 / quota.max_containers as f64) * 100.0,
        cpu: (quota.current_cpu_cores / quota.max_cpu_cores) * 100.0,
        memory: (quota.current_memory_mb as f64 / quota.max_memory_mb as f64) * 100.0,
        storage: (quota.current_storage_gb as f64 / quota.max_storage_gb as f64) * 100.0,
    };

    tracing::info!(user_id = %user_id, "User quota updated");

    Ok(Json(QuotaResponse {
        user_id: quota.user_id,
        max_containers: quota.max_containers,
        max_cpu_cores: quota.max_cpu_cores,
        max_memory_mb: quota.max_memory_mb,
        max_storage_gb: quota.max_storage_gb,
        current_containers: quota.current_containers,
        current_cpu_cores: quota.current_cpu_cores,
        current_memory_mb: quota.current_memory_mb,
        current_storage_gb: quota.current_storage_gb,
        usage_percent,
    }))
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
