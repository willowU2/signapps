//! GPU status, hardware profiles, and model recommendation endpoints.

use axum::{extract::State, http::StatusCode, Json};
use serde::Serialize;

use crate::gateway::HardwareTier;
use crate::models::profiles::{build_profile, LoadProfile};
use crate::models::GpuState;
use crate::AppState;

/// Response for the GPU status endpoint.
#[derive(Debug, Serialize)]
/// Response for GpuStatus.
pub struct GpuStatusResponse {
    pub gpus: Vec<GpuState>,
    pub total_vram_mb: u64,
    pub free_vram_mb: u64,
    pub tier: HardwareTier,
}

/// Get current GPU status including loaded models and VRAM usage.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/gpu_status",
    responses((status = 200, description = "Success")),
    tag = "Ai"
)]
#[tracing::instrument(skip_all)]
pub async fn get_gpu_status(
    State(state): State<AppState>,
) -> Result<Json<GpuStatusResponse>, (StatusCode, String)> {
    let gateway = state.gateway.as_ref().ok_or((
        StatusCode::SERVICE_UNAVAILABLE,
        "Gateway not initialized".to_string(),
    ))?;

    let orchestrator = gateway.orchestrator();
    let gpus = orchestrator.gpu_status().await;
    let free_vram_mb = orchestrator.total_free_vram().await;

    let hardware = orchestrator.hardware();
    let total_vram_mb = hardware.total_vram_mb;
    let tier = HardwareTier::from_vram_mb(total_vram_mb);

    Ok(Json(GpuStatusResponse {
        gpus,
        total_vram_mb,
        free_vram_mb,
        tier,
    }))
}

/// List load profiles for all hardware tiers.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/gpu_status",
    responses((status = 200, description = "Success")),
    tag = "Ai"
)]
#[tracing::instrument(skip_all)]
pub async fn list_profiles() -> Json<Vec<LoadProfile>> {
    let tiers = [
        HardwareTier::Cpu,
        HardwareTier::LowVram,
        HardwareTier::MidVram,
        HardwareTier::HighVram,
        HardwareTier::UltraVram,
    ];

    let profiles: Vec<LoadProfile> = tiers.iter().map(|t| build_profile(*t)).collect();
    Json(profiles)
}

/// Get recommended models based on detected hardware.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/gpu_status",
    responses((status = 200, description = "Success")),
    tag = "Ai"
)]
#[tracing::instrument(skip_all)]
pub async fn get_recommended_models(
    State(state): State<AppState>,
) -> Result<Json<LoadProfile>, (StatusCode, String)> {
    let gateway = state.gateway.as_ref().ok_or((
        StatusCode::SERVICE_UNAVAILABLE,
        "Gateway not initialized".to_string(),
    ))?;

    let hardware = gateway.orchestrator().hardware();
    let tier = HardwareTier::from_vram_mb(hardware.total_vram_mb);
    let profile = build_profile(tier);

    Ok(Json(profile))
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
