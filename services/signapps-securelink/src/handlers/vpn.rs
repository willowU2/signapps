//! VPN status and management handlers.

use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::AppState;
use crate::vpn::service::NetworkStatus;
use signapps_common::Result;

/// VPN initialization request.
#[derive(Debug, Deserialize)]
/// Request body for InitVpn.
pub struct InitVpnRequest {
    pub name: String,
}

/// VPN initialization response.
#[derive(Debug, Serialize)]
/// Response for InitVpn.
pub struct InitVpnResponse {
    pub message: String,
    pub ca_certificate: String,
}

/// Initialize VPN CA.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/vpn",
    responses((status = 200, description = "Success")),
    tag = "Securelink"
)]
#[tracing::instrument(skip_all)]
pub async fn init_vpn(
    State(state): State<AppState>,
    Json(request): Json<InitVpnRequest>,
) -> Result<(StatusCode, Json<InitVpnResponse>)> {
    state.vpn.init_ca(&request.name).await?;
    let ca_cert = state.vpn.get_ca_certificate().await?;

    Ok((StatusCode::CREATED, Json(InitVpnResponse {
        message: format!("VPN CA '{}' initialized successfully", request.name),
        ca_certificate: ca_cert,
    })))
}

/// Get VPN network status.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/vpn",
    responses((status = 200, description = "Success")),
    tag = "Securelink"
)]
#[tracing::instrument(skip_all)]
pub async fn get_vpn_status(
    State(state): State<AppState>,
) -> Result<Json<NetworkStatus>> {
    let status = state.vpn.get_network_status().await?;
    Ok(Json(status))
}

/// Get CA certificate.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/vpn",
    responses((status = 200, description = "Success")),
    tag = "Securelink"
)]
#[tracing::instrument(skip_all)]
pub async fn get_ca_certificate(
    State(state): State<AppState>,
) -> Result<Json<CaCertificateResponse>> {
    let ca_cert = state.vpn.get_ca_certificate().await?;
    Ok(Json(CaCertificateResponse { certificate: ca_cert }))
}

/// CA certificate response.
#[derive(Debug, Serialize)]
/// Response for CaCertificate.
pub struct CaCertificateResponse {
    pub certificate: String,
}

/// Regenerate all device configurations.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/vpn",
    responses((status = 200, description = "Success")),
    tag = "Securelink"
)]
#[tracing::instrument(skip_all)]
pub async fn regenerate_configs(
    State(state): State<AppState>,
) -> Result<Json<RegenerateResponse>> {
    state.vpn.regenerate_all_configs().await?;

    let devices = state.vpn.list_active_devices().await?;

    Ok(Json(RegenerateResponse {
        message: "Configurations regenerated successfully".to_string(),
        device_count: devices.len(),
    }))
}

/// Regenerate response.
#[derive(Debug, Serialize)]
/// Response for Regenerate.
pub struct RegenerateResponse {
    pub message: String,
    pub device_count: usize,
}

/// Health check for VPN service.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/vpn",
    responses((status = 200, description = "Success")),
    tag = "Securelink"
)]
#[tracing::instrument(skip_all)]
pub async fn health_check(
    State(state): State<AppState>,
) -> Result<Json<HealthResponse>> {
    let status = state.vpn.get_network_status().await?;

    let health = if status.healthy {
        "healthy"
    } else {
        "degraded"
    };

    Ok(Json(HealthResponse {
        status: health.to_string(),
        network_status: status,
    }))
}

/// Health response.
#[derive(Debug, Serialize)]
/// Response for Health.
pub struct HealthResponse {
    pub status: String,
    pub network_status: NetworkStatus,
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
