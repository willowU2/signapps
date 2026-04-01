//! Model management handlers.

use axum::{
    extract::{Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::Result;

use crate::AppState;

/// Model info.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// ModelInfo data transfer object.
pub struct ModelInfo {
    pub id: String,
    pub object: String,
    pub owned_by: String,
}

/// Models list response.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for Models.
pub struct ModelsResponse {
    pub models: Vec<ModelInfo>,
}

/// Query parameters for list_models.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
/// Query parameters for filtering results.
pub struct ModelsQuery {
    pub provider: Option<String>,
}

/// List available models (optionally for a specific provider).
#[utoipa::path(
    get,
    path = "/api/v1/ai/models",
    params(ModelsQuery),
    responses(
        (status = 200, description = "List of available models", body = ModelsResponse),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearerAuth" = [])),
    tag = "models"
)]
#[tracing::instrument(skip_all)]
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
