//! Model management handlers.

use axum::{
    extract::{Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::Result;

use crate::AppState;

/// Model info.
#[derive(Debug, Serialize)]
pub struct ModelInfo {
    pub id: String,
    pub object: String,
    pub owned_by: String,
}

/// Models list response.
#[derive(Debug, Serialize)]
pub struct ModelsResponse {
    pub models: Vec<ModelInfo>,
}

/// Query parameters for list_models.
#[derive(Debug, Deserialize)]
pub struct ModelsQuery {
    pub provider: Option<String>,
}

/// List available models (optionally for a specific provider).
#[tracing::instrument(skip_all)]
pub async fn list_models(
    State(state): State<AppState>,
    Query(query): Query<ModelsQuery>,
) -> Result<Json<ModelsResponse>> {
    let provider = state.providers.resolve(query.provider.as_deref())?;
    let models = provider.list_models().await?;

    let model_infos: Vec<ModelInfo> = models
        .into_iter()
        .map(|m| ModelInfo {
            id: m.id,
            object: m.object,
            owned_by: m.owned_by,
        })
        .collect();

    Ok(Json(ModelsResponse {
        models: model_infos,
    }))
}
