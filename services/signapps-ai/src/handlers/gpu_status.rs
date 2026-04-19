//! GPU status, hardware profiles, and model recommendation endpoints.

use axum::{extract::State, http::StatusCode, Json};
use serde::Serialize;

use crate::gateway::HardwareTier;
use crate::models::profiles::{build_profile, LoadProfile};
use crate::models::GpuState;
use crate::AppState;

/// Response for the GPU status endpoint.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for GpuStatus.
pub struct GpuStatusResponse {
    /// List of GPU devices with loaded model info.
    #[schema(value_type = Vec<serde_json::Value>)]
    pub gpus: Vec<GpuState>,
    /// Total VRAM in megabytes.
    pub total_vram_mb: u64,
    /// Free VRAM in megabytes.
    pub free_vram_mb: u64,
    /// Hardware tier classification.
    #[schema(value_type = String)]
    pub tier: HardwareTier,
}

/// Get current GPU status including loaded models and VRAM usage.
#[utoipa::path(
    get,
    path = "/api/v1/ai/gpu/status",
    responses(
        (status = 200, description = "Current GPU status", body = GpuStatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 503, description = "Gateway not initialized"),
    ),
    security(("bearerAuth" = [])),
    tag = "gpu"
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
#[utoipa::path(
    get,
    path = "/api/v1/ai/gpu/profiles",
    responses(
        (status = 200, description = "Load profiles for all hardware tiers"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearerAuth" = [])),
    tag = "gpu"
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
#[utoipa::path(
    get,
    path = "/api/v1/ai/gpu/recommended",
    responses(
        (status = 200, description = "Recommended model load profile for current hardware"),
        (status = 401, description = "Unauthorized"),
        (status = 503, description = "Gateway not initialized"),
    ),
    security(("bearerAuth" = [])),
    tag = "gpu"
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
        // Placeholder: ensures the module compiles.
        let _ = module_path!();
    }
}
