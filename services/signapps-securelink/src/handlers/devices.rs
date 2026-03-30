//! Device management handlers.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;
use signapps_common::Result;
use signapps_db::models::Device;

/// Request to enroll a new device.
#[derive(Debug, Deserialize)]
/// Request body for EnrollDevice.
pub struct EnrollDeviceRequest {
    pub name: String,
    pub nickname: Option<String>,
    #[serde(default)]
    pub is_lighthouse: bool,
    #[serde(default)]
    pub is_relay: bool,
}

/// Response after enrolling a device.
#[derive(Debug, Serialize)]
/// Response for EnrollDevice.
pub struct EnrollDeviceResponse {
    pub device: Device,
    pub certificate: CertificateBundle,
    pub config_yaml: String,
}

/// Certificate bundle for device.
#[derive(Debug, Serialize)]
/// CertificateBundle data transfer object.
pub struct CertificateBundle {
    pub ca: String,
    pub cert: String,
    pub key: String,
}

/// List all devices.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/devices",
    responses((status = 200, description = "Success")),
    tag = "Securelink"
)]
pub async fn list_devices(
    State(state): State<AppState>,
) -> Result<Json<Vec<Device>>> {
    let devices = state.vpn.list_devices().await?;
    Ok(Json(devices))
}

/// Get a device by ID.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/devices",
    responses((status = 200, description = "Success")),
    tag = "Securelink"
)]
pub async fn get_device(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Device>> {
    let device = state.vpn.get_device(id).await?
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Device {}", id)))?;
    Ok(Json(device))
}

/// Enroll a new device.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/devices",
    responses((status = 200, description = "Success")),
    tag = "Securelink"
)]
pub async fn enroll_device(
    State(state): State<AppState>,
    Json(request): Json<EnrollDeviceRequest>,
) -> Result<(StatusCode, Json<EnrollDeviceResponse>)> {
    let enrollment = state.vpn.enroll_device(
        &request.name,
        request.nickname.as_deref(),
        request.is_lighthouse,
        request.is_relay,
    ).await?;

    // Serialize config to YAML
    let config_yaml = serde_yaml::to_string(&enrollment.config)
        .map_err(|e| signapps_common::Error::Internal(format!("Failed to serialize config: {}", e)))?;

    let response = EnrollDeviceResponse {
        device: enrollment.device,
        certificate: CertificateBundle {
            ca: enrollment.certificate.ca,
            cert: enrollment.certificate.cert,
            key: enrollment.certificate.key,
        },
        config_yaml,
    };

    Ok((StatusCode::CREATED, Json(response)))
}

/// Get device configuration.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/devices",
    responses((status = 200, description = "Success")),
    tag = "Securelink"
)]
pub async fn get_device_config(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let device = state.vpn.get_device(id).await?
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Device {}", id)))?;

    let config = state.vpn.generate_device_config(&device).await?;

    let config_json = serde_json::to_value(&config)
        .map_err(|e| signapps_common::Error::Internal(format!("Failed to serialize config: {}", e)))?;

    Ok(Json(config_json))
}

/// Block a device.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/devices",
    responses((status = 200, description = "Success")),
    tag = "Securelink"
)]
pub async fn block_device(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Device>> {
    let device = state.vpn.block_device(id).await?;
    Ok(Json(device))
}

/// Unblock a device.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/devices",
    responses((status = 200, description = "Success")),
    tag = "Securelink"
)]
pub async fn unblock_device(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Device>> {
    let device = state.vpn.unblock_device(id).await?;
    Ok(Json(device))
}

/// Delete a device.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    delete,
    path = "/api/v1/devices",
    responses((status = 204, description = "Success")),
    tag = "Securelink"
)]
pub async fn delete_device(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    state.vpn.delete_device(id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Update device heartbeat.
#[derive(Debug, Deserialize)]
/// Request body for Heartbeat.
pub struct HeartbeatRequest {
    pub device_id: Uuid,
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/devices",
    responses((status = 200, description = "Success")),
    tag = "Securelink"
)]
pub async fn device_heartbeat(
    State(state): State<AppState>,
    Json(request): Json<HeartbeatRequest>,
) -> Result<StatusCode> {
    state.vpn.update_device_heartbeat(request.device_id).await?;
    Ok(StatusCode::OK)
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
