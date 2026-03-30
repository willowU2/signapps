//! Model management endpoints for downloading, listing, and managing local models.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_runtime::{HardwareProfile, ModelEntry};

use crate::AppState;

#[derive(Debug, Serialize)]
/// Response for LocalModels.
pub struct LocalModelsResponse {
    pub models: Vec<ModelEntry>,
}

#[derive(Debug, Serialize)]
/// Response for AvailableModels.
pub struct AvailableModelsResponse {
    pub models: Vec<ModelEntry>,
}

#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct SearchQuery {
    pub q: String,
}

#[derive(Debug, Deserialize)]
/// Request body for DownloadModel.
pub struct DownloadModelRequest {
    pub model_id: String,
}

#[derive(Debug, Serialize)]
/// Response for DownloadModel.
pub struct DownloadModelResponse {
    pub model_id: String,
    pub status: String,
    pub path: Option<String>,
}

#[derive(Debug, Serialize)]
/// Response for Hardware.
pub struct HardwareResponse {
    pub hardware: HardwareProfile,
}

/// List downloaded/ready models.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_local_models(
    State(state): State<AppState>,
) -> Result<Json<LocalModelsResponse>, (StatusCode, String)> {
    let model_manager = state.model_manager.as_ref().ok_or((
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
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_available_models(
    State(state): State<AppState>,
) -> Result<Json<AvailableModelsResponse>, (StatusCode, String)> {
    let model_manager = state.model_manager.as_ref().ok_or((
        StatusCode::SERVICE_UNAVAILABLE,
        "Model manager not initialized".to_string(),
    ))?;

    let models = model_manager.list_models(None);
    Ok(Json(AvailableModelsResponse { models }))
}

/// Dynamically search HuggingFace for models.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn search_models(
    State(state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<AvailableModelsResponse>, (StatusCode, String)> {
    let model_manager = state.model_manager.as_ref().ok_or((
        StatusCode::SERVICE_UNAVAILABLE,
        "Model manager not initialized".to_string(),
    ))?;

    let models = model_manager
        .search_huggingface(&query.q)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("HF search failed: {}", e),
            )
        })?;

    Ok(Json(AvailableModelsResponse { models }))
}

/// Download a model (async — spawns background task and returns immediately).
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn download_model(
    State(state): State<AppState>,
    Json(request): Json<DownloadModelRequest>,
) -> Result<Json<DownloadModelResponse>, (StatusCode, String)> {
    let model_manager = state.model_manager.as_ref().ok_or((
        StatusCode::SERVICE_UNAVAILABLE,
        "Model manager not initialized".to_string(),
    ))?;

    // Verify model exists in registry
    let entry = model_manager.get_model(&request.model_id).ok_or((
        StatusCode::NOT_FOUND,
        format!("Model '{}' not found", request.model_id),
    ))?;

    // If already downloaded, return immediately
    if let Some(ref path) = entry.local_path {
        if path.exists() {
            return Ok(Json(DownloadModelResponse {
                model_id: request.model_id,
                status: "ready".to_string(),
                path: Some(path.to_string_lossy().to_string()),
            }));
        }
    }

    // Spawn download in background task
    let mm = model_manager.clone();
    let model_id = request.model_id.clone();
    tokio::spawn(async move {
        if let Err(e) = mm.ensure_model(&model_id).await {
            tracing::error!("Background download failed for '{}': {}", model_id, e);
        }
    });

    Ok(Json(DownloadModelResponse {
        model_id: request.model_id,
        status: "downloading".to_string(),
        path: None,
    }))
}

/// Get status of a single model.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_model_status(
    State(state): State<AppState>,
    Path(model_id): Path<String>,
) -> Result<Json<ModelEntry>, (StatusCode, String)> {
    let model_manager = state.model_manager.as_ref().ok_or((
        StatusCode::SERVICE_UNAVAILABLE,
        "Model manager not initialized".to_string(),
    ))?;

    let entry = model_manager.get_model(&model_id).ok_or((
        StatusCode::NOT_FOUND,
        format!("Model '{}' not found", model_id),
    ))?;

    Ok(Json(entry))
}

/// Delete a downloaded model.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn delete_model(
    State(state): State<AppState>,
    Path(model_id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let model_manager = state.model_manager.as_ref().ok_or((
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
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_hardware(
    State(state): State<AppState>,
) -> Result<Json<HardwareResponse>, (StatusCode, String)> {
    let hardware = state.hardware.as_ref().ok_or((
        StatusCode::SERVICE_UNAVAILABLE,
        "Hardware detection not available".to_string(),
    ))?;

    Ok(Json(HardwareResponse {
        hardware: hardware.clone(),
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
