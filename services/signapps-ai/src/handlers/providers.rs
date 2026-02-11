//! Provider management handlers.

use axum::{extract::State, Json};
use serde::Serialize;
use signapps_common::Result;

use crate::llm::LlmProviderType;
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

/// List available providers.
#[tracing::instrument(skip(_state))]
pub async fn list_providers(State(_state): State<AppState>) -> Result<Json<ProvidersResponse>> {
    let mut providers = Vec::new();

    // Ollama (always available if configured)
    if let Ok(url) = std::env::var("OLLAMA_URL") {
        providers.push(ProviderInfo {
            id: "ollama".to_string(),
            name: "Ollama (Local)".to_string(),
            provider_type: LlmProviderType::Ollama,
            enabled: !url.is_empty(),
            default_model: std::env::var("OLLAMA_MODEL")
                .unwrap_or_else(|_| "llama3.2:3b".to_string()),
            is_local: true,
        });
    }

    // vLLM
    if let Ok(url) = std::env::var("VLLM_URL") {
        providers.push(ProviderInfo {
            id: "vllm".to_string(),
            name: "vLLM (Local GPU)".to_string(),
            provider_type: LlmProviderType::Vllm,
            enabled: !url.is_empty(),
            default_model: std::env::var("VLLM_MODEL")
                .unwrap_or_else(|_| "meta-llama/Llama-3.2-3B-Instruct".to_string()),
            is_local: true,
        });
    }

    // OpenAI
    if let Ok(key) = std::env::var("OPENAI_API_KEY") {
        providers.push(ProviderInfo {
            id: "openai".to_string(),
            name: "OpenAI".to_string(),
            provider_type: LlmProviderType::OpenAI,
            enabled: !key.is_empty(),
            default_model: std::env::var("OPENAI_MODEL")
                .unwrap_or_else(|_| "gpt-4o-mini".to_string()),
            is_local: false,
        });
    }

    // Anthropic
    if let Ok(key) = std::env::var("ANTHROPIC_API_KEY") {
        providers.push(ProviderInfo {
            id: "anthropic".to_string(),
            name: "Anthropic Claude".to_string(),
            provider_type: LlmProviderType::Anthropic,
            enabled: !key.is_empty(),
            default_model: std::env::var("ANTHROPIC_MODEL")
                .unwrap_or_else(|_| "claude-3-5-sonnet-20241022".to_string()),
            is_local: false,
        });
    }

    let active_provider = std::env::var("LLM_PROVIDER").unwrap_or_else(|_| "ollama".to_string());

    Ok(Json(ProvidersResponse {
        providers,
        active_provider,
    }))
}
