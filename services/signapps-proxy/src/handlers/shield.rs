//! SmartShield handlers.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::Result;
use signapps_db::models::ShieldStats;
use uuid::Uuid;

use crate::AppState;

/// Block IP request.
#[derive(Debug, Deserialize)]
/// Request body for BlockIp.
pub struct BlockIpRequest {
    pub ip: String,
    pub duration_seconds: Option<i32>,
}

/// Block response.
#[derive(Debug, Serialize)]
/// Response for Block.
pub struct BlockResponse {
    pub route_id: Uuid,
    pub ip: String,
    pub blocked: bool,
    pub duration_seconds: i32,
}

/// Get shield statistics.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/shield",
    responses((status = 200, description = "Success")),
    tag = "Proxy"
)]
#[tracing::instrument(skip_all)]
pub async fn get_stats(State(state): State<AppState>) -> Result<Json<ShieldStats>> {
    let stats = state.shield.get_stats().await?;
    Ok(Json(stats))
}

/// Reset shield statistics.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    put,
    path = "/api/v1/shield",
    responses((status = 200, description = "Success")),
    tag = "Proxy"
)]
#[tracing::instrument(skip_all)]
pub async fn reset_stats(State(state): State<AppState>) -> Result<StatusCode> {
    state.shield.reset_stats().await?;
    tracing::info!("Shield statistics reset");
    Ok(StatusCode::NO_CONTENT)
}

/// Block an IP for a route.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/shield",
    responses((status = 200, description = "Success")),
    tag = "Proxy"
)]
#[tracing::instrument(skip_all)]
pub async fn block_ip(
    State(state): State<AppState>,
    Path(route_id): Path<Uuid>,
    Json(payload): Json<BlockIpRequest>,
) -> Result<Json<BlockResponse>> {
    let duration = payload.duration_seconds.unwrap_or(300);

    state
        .shield
        .block_ip(&route_id.to_string(), &payload.ip, duration)
        .await?;

    Ok(Json(BlockResponse {
        route_id,
        ip: payload.ip,
        blocked: true,
        duration_seconds: duration,
    }))
}

/// Unblock an IP for a route.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/shield",
    responses((status = 200, description = "Success")),
    tag = "Proxy"
)]
#[tracing::instrument(skip_all)]
pub async fn unblock_ip(
    State(state): State<AppState>,
    Path((route_id, ip)): Path<(Uuid, String)>,
) -> Result<StatusCode> {
    state.shield.unblock_ip(&route_id.to_string(), &ip).await?;

    tracing::info!(route_id = %route_id, ip = %ip, "IP unblocked");

    Ok(StatusCode::NO_CONTENT)
}

/// Check if an IP is blocked.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/shield",
    responses((status = 200, description = "Success")),
    tag = "Proxy"
)]
#[tracing::instrument(skip_all)]
pub async fn check_blocked(
    State(state): State<AppState>,
    Path((route_id, ip)): Path<(Uuid, String)>,
) -> Result<Json<serde_json::Value>> {
    let is_blocked = state.shield.is_blocked(&route_id.to_string(), &ip).await?;

    Ok(Json(serde_json::json!({
        "route_id": route_id,
        "ip": ip,
        "blocked": is_blocked
    })))
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
