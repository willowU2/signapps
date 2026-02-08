//! Model management handlers.

use axum::{extract::State, Json};
use serde::Serialize;
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

/// List available models.
#[tracing::instrument(skip(state))]
pub async fn list_models(State(state): State<AppState>) -> Result<Json<ModelsResponse>> {
    let models = state.llm.list_models().await?;

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
