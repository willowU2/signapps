//! Provider management handlers.

use axum::{extract::State, Json};
use serde::Serialize;
use signapps_common::Result;

use crate::llm::{LlmProviderType, ProviderRegistry};
use crate::AppState;

/// Provider info for frontend.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// ProviderInfo data transfer object.
pub struct ProviderInfo {
    /// Provider identifier.
    pub id: String,
    /// Human-readable provider name.
    pub name: String,
    /// Provider backend type (ollama, vllm, openai, anthropic, llamacpp).
    #[schema(value_type = String)]
    pub provider_type: LlmProviderType,
    /// Whether the provider is currently enabled.
    pub enabled: bool,
    /// Default model name for this provider.
    pub default_model: String,
    /// Whether the provider runs locally.
    pub is_local: bool,
}

/// List providers response.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for Providers.
pub struct ProvidersResponse {
    pub providers: Vec<ProviderInfo>,
    pub active_provider: String,
}

/// List available providers from the registry.
/// Probes local providers for connectivity and marks unreachable ones as disabled.
#[utoipa::path(
    get,
    path = "/api/v1/ai/providers",
    responses(
        (status = 200, description = "List of registered LLM providers", body = ProvidersResponse),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearerAuth" = [])),
    tag = "providers"
)]
#[tracing::instrument(skip_all)]
pub async fn list_providers(State(state): State<AppState>) -> Result<Json<ProvidersResponse>> {
    let entries = state.providers.list_providers();

    let mut providers: Vec<ProviderInfo> = Vec::new();
    let mut first_available: Option<String> = None;
    let default_id = state.providers.default_provider_id().to_string();

    for (id, config) in &entries {
        let is_local = ProviderRegistry::is_local(&config.provider_type);
        let mut enabled = config.enabled;

        // For local providers, probe connectivity
        if is_local && enabled {
            if let Ok(provider) = state.providers.get(id) {
                match tokio::time::timeout(
                    std::time::Duration::from_secs(2),
                    provider.health_check(),
                )
                .await
                {
                    Ok(Ok(true)) => {},
                    _ => {
                        tracing::debug!(
                            provider = id,
                            "Local provider unreachable, marking disabled"
                        );
                        enabled = false;
                    },
                }
            }
        }

        if enabled && first_available.is_none() {
            first_available = Some(id.to_string());
        }

        providers.push(ProviderInfo {
            id: id.to_string(),
            name: ProviderRegistry::provider_name(&config.provider_type).to_string(),
            provider_type: config.provider_type.clone(),
            enabled,
            default_model: config.default_model.clone(),
            is_local,
        });
    }

    // If the default provider is disabled, fall back to first available
    let active = if providers.iter().any(|p| p.id == default_id && p.enabled) {
        default_id
    } else {
        first_available.unwrap_or(default_id)
    };

    Ok(Json(ProvidersResponse {
        providers,
        active_provider: active,
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
        // Placeholder: ensures the module compiles.
        let _ = module_path!();
    }
}
