//! Provider management handlers.

use axum::{extract::State, Json};
use serde::Serialize;
use signapps_common::Result;

use crate::llm::{LlmProviderType, ProviderRegistry};
use crate::AppState;

/// Provider info for frontend.
#[derive(Debug, Serialize)]
pub struct ProviderInfo {
    pub id: String,
    pub name: String,
    pub provider_type: LlmProviderType,
    pub enabled: bool,
    pub default_model: String,
    pub is_local: bool,
}

/// List providers response.
#[derive(Debug, Serialize)]
pub struct ProvidersResponse {
    pub providers: Vec<ProviderInfo>,
    pub active_provider: String,
}

/// List available providers from the registry.
#[tracing::instrument(skip(state))]
pub async fn list_providers(State(state): State<AppState>) -> Result<Json<ProvidersResponse>> {
    let entries = state.providers.list_providers();

    let providers: Vec<ProviderInfo> = entries
        .iter()
        .map(|(id, config)| ProviderInfo {
            id: id.to_string(),
            name: ProviderRegistry::provider_name(&config.provider_type).to_string(),
            provider_type: config.provider_type.clone(),
            enabled: config.enabled,
            default_model: config.default_model.clone(),
            is_local: ProviderRegistry::is_local(&config.provider_type),
        })
        .collect();

    Ok(Json(ProvidersResponse {
        providers,
        active_provider: state.providers.default_provider_id().to_string(),
    }))
}
