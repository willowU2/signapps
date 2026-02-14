//! Model management endpoints for downloading, listing, and managing local models.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_runtime::{HardwareProfile, ModelEntry};

use crate::AppState;

#[derive(Debug, Serialize)]
pub struct LocalModelsResponse {
    pub models: Vec<ModelEntry>,
}

#[derive(Debug, Serialize)]
pub struct AvailableModelsResponse {
    pub models: Vec<ModelEntry>,
}

#[derive(Debug, Deserialize)]
pub struct DownloadModelRequest {
    pub model_id: String,
}

#[derive(Debug, Serialize)]
pub struct DownloadModelResponse {
    pub model_id: String,
    pub status: String,
    pub path: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct HardwareResponse {
    pub hardware: HardwareProfile,
}

/// List downloaded/ready models.
pub async fn list_local_models(
    State(state): State<AppState>,
) -> Result<Json<LocalModelsResponse>, (StatusCode, String)> {
    let model_manager = state
        .model_manager
        .as_ref()
        .ok_or((
            StatusCode::SERVICE_UNAVAILABLE,
            "Model manager not initialized".to_string(),
        ))?;

    let models = model_manager
        .list_models(None)
        .into_iter()
        .filter(|m| {
            matches!(
                m.status,
                signapps_runtime::ModelStatus::Ready | signapps_runtime::ModelStatus::Loaded
            )
        })
        .collect();

    Ok(Json(LocalModelsResponse { models }))
}

/// List all available models (including not-yet-downloaded).
pub async fn list_available_models(
    State(state): State<AppState>,
) -> Result<Json<AvailableModelsResponse>, (StatusCode, String)> {
    let model_manager = state
        .model_manager
        .as_ref()
        .ok_or((
            StatusCode::SERVICE_UNAVAILABLE,
            "Model manager not initialized".to_string(),
        ))?;

    let models = model_manager.list_models(None);
    Ok(Json(AvailableModelsResponse { models }))
}

/// Download a model.
pub async fn download_model(
    State(state): State<AppState>,
    Json(request): Json<DownloadModelRequest>,
) -> Result<Json<DownloadModelResponse>, (StatusCode, String)> {
    let model_manager = state
        .model_manager
        .as_ref()
        .ok_or((
            StatusCode::SERVICE_UNAVAILABLE,
            "Model manager not initialized".to_string(),
        ))?;

    let path = model_manager
        .ensure_model(&request.model_id)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Download failed: {}", e),
            )
        })?;

    Ok(Json(DownloadModelResponse {
        model_id: request.model_id,
        status: "ready".to_string(),
        path: Some(path.to_string_lossy().to_string()),
    }))
}

/// Delete a downloaded model.
pub async fn delete_model(
    State(state): State<AppState>,
    Path(model_id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let model_manager = state
        .model_manager
        .as_ref()
        .ok_or((
            StatusCode::SERVICE_UNAVAILABLE,
            "Model manager not initialized".to_string(),
        ))?;

    model_manager.delete_model(&model_id).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Delete failed: {}", e),
        )
    })?;

    Ok(Json(serde_json::json!({
        "model_id": model_id,
        "status": "deleted"
    })))
}

/// Get detected hardware profile.
pub async fn get_hardware(
    State(state): State<AppState>,
) -> Result<Json<HardwareResponse>, (StatusCode, String)> {
    let hardware = state
        .hardware
        .as_ref()
        .ok_or((
            StatusCode::SERVICE_UNAVAILABLE,
            "Hardware detection not available".to_string(),
        ))?;

    Ok(Json(HardwareResponse {
        hardware: hardware.clone(),
    }))
}
