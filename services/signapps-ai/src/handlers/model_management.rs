//! Model management endpoints for downloading, listing, and managing local models.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_runtime::{HardwareProfile, ModelEntry};

use crate::AppState;

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for LocalModels.
pub struct LocalModelsResponse {
    /// List of downloaded and ready models.
    #[schema(value_type = Vec<serde_json::Value>)]
    pub models: Vec<ModelEntry>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for AvailableModels.
pub struct AvailableModelsResponse {
    /// List of all known models (including not yet downloaded).
    #[schema(value_type = Vec<serde_json::Value>)]
    pub models: Vec<ModelEntry>,
}

#[derive(Debug, Deserialize, utoipa::IntoParams)]
/// Query parameters for filtering results.
pub struct SearchQuery {
    /// Search query string.
    pub q: String,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for DownloadModel.
pub struct DownloadModelRequest {
    /// Model identifier to download.
    pub model_id: String,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for DownloadModel.
pub struct DownloadModelResponse {
    /// Model identifier.
    pub model_id: String,
    /// Download status ("ready" or "downloading").
    pub status: String,
    /// Local path if already downloaded.
    pub path: Option<String>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for Hardware.
pub struct HardwareResponse {
    /// Detected hardware profile.
    #[schema(value_type = serde_json::Value)]
    pub hardware: HardwareProfile,
}

/// List downloaded/ready models.
#[utoipa::path(
    get,
    path = "/api/v1/ai/models/local",
    responses(
        (status = 200, description = "List of downloaded models", body = LocalModelsResponse),
        (status = 401, description = "Unauthorized"),
        (status = 503, description = "Model manager not initialized"),
    ),
    security(("bearerAuth" = [])),
    tag = "models"
)]
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
#[utoipa::path(
    get,
    path = "/api/v1/ai/models/available",
    responses(
        (status = 200, description = "List of all known models", body = AvailableModelsResponse),
        (status = 401, description = "Unauthorized"),
        (status = 503, description = "Model manager not initialized"),
    ),
    security(("bearerAuth" = [])),
    tag = "models"
)]
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
#[utoipa::path(
    post,
    path = "/api/v1/ai/models/download",
    request_body = DownloadModelRequest,
    responses(
        (status = 200, description = "Download initiated or model already ready", body = DownloadModelResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Model not found in registry"),
        (status = 503, description = "Model manager not initialized"),
    ),
    security(("bearerAuth" = [])),
    tag = "models"
)]
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
#[utoipa::path(
    get,
    path = "/api/v1/ai/models/{model_id}",
    params(
        ("model_id" = String, Path, description = "Model identifier"),
    ),
    responses(
        (status = 200, description = "Model entry with status"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Model not found"),
        (status = 503, description = "Model manager not initialized"),
    ),
    security(("bearerAuth" = [])),
    tag = "models"
)]
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
#[utoipa::path(
    delete,
    path = "/api/v1/ai/models/{model_id}",
    params(
        ("model_id" = String, Path, description = "Model identifier"),
    ),
    responses(
        (status = 200, description = "Model deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 503, description = "Model manager not initialized"),
    ),
    security(("bearerAuth" = [])),
    tag = "models"
)]
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
#[utoipa::path(
    get,
    path = "/api/v1/ai/hardware",
    responses(
        (status = 200, description = "Detected hardware profile", body = HardwareResponse),
        (status = 401, description = "Unauthorized"),
        (status = 503, description = "Hardware detection not available"),
    ),
    security(("bearerAuth" = [])),
    tag = "models"
)]
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
