//! LLM Provider abstraction supporting multiple backends.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use tokio::sync::mpsc;

use super::types::*;

// Re-export all concrete providers so callers keep working.
pub use super::anthropic::AnthropicProvider;
pub use super::gemini::GeminiProvider;
pub use super::lmstudio::LmStudioProvider;
pub use super::ollama::OllamaProvider;
pub use super::openai::OpenAIProvider;
pub use super::vllm::VllmProvider;

/// LLM Provider type.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LlmProviderType {
    /// vLLM (local, OpenAI-compatible) — preferred local provider
    Vllm,
    /// LM Studio (local, OpenAI-compatible)
    #[serde(alias = "lmstudio", alias = "lm-studio")]
    LmStudio,
    /// Google Gemini API
    Gemini,
    /// OpenAI API
    OpenAI,
    /// Anthropic Claude API
    Anthropic,
    /// Generic OpenAI-compatible API
    OpenAICompatible,
    /// Ollama (local, legacy)
    Ollama,
    /// Native llama.cpp (GGUF models)
    LlamaCpp,
}

/// Provider configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub provider_type: LlmProviderType,
    pub base_url: String,
    pub api_key: Option<String>,
    pub default_model: String,
    pub enabled: bool,
}

impl Default for ProviderConfig {
    fn default() -> Self {
        Self {
            provider_type: LlmProviderType::Ollama,
            base_url: "http://localhost:11434".to_string(),
            api_key: None,
            default_model: "llama3.2:3b".to_string(),
            enabled: true,
        }
    }
}

/// Trait for LLM providers.
#[async_trait]
pub trait LlmProvider: Send + Sync {
    /// Get provider type.
    fn provider_type(&self) -> LlmProviderType;

    /// List available models.
    async fn list_models(&self) -> Result<Vec<ModelInfo>>;

    /// Chat completion (non-streaming).
    async fn chat(
        &self,
        messages: Vec<ChatMessage>,
        model: Option<&str>,
        max_tokens: Option<u32>,
        temperature: Option<f32>,
    ) -> Result<ChatResponse>;

    /// Chat completion (streaming).
    async fn chat_stream(
        &self,
        messages: Vec<ChatMessage>,
        model: Option<&str>,
        max_tokens: Option<u32>,
        temperature: Option<f32>,
    ) -> Result<mpsc::Receiver<Result<String>>>;

    /// Health check.
    async fn health_check(&self) -> Result<bool>;
}

/// Create a provider from configuration.
pub fn create_provider(config: &ProviderConfig) -> Result<Box<dyn LlmProvider>> {
    match config.provider_type {
        LlmProviderType::Vllm | LlmProviderType::OpenAICompatible => Ok(Box::new(
            VllmProvider::new(&config.base_url, &config.default_model),
        )),
        LlmProviderType::LmStudio => Ok(Box::new(LmStudioProvider::new(
            &config.base_url,
            &config.default_model,
        ))),
        LlmProviderType::Gemini => {
            let api_key = config
                .api_key
                .as_ref()
                .ok_or_else(|| Error::Validation("Google Gemini API key required".to_string()))?;
            Ok(Box::new(GeminiProvider::new(
                api_key,
                &config.default_model,
            )))
        },
        LlmProviderType::OpenAI => {
            let api_key = config
                .api_key
                .as_ref()
                .ok_or_else(|| Error::Validation("OpenAI API key required".to_string()))?;
            Ok(Box::new(OpenAIProvider::new(
                api_key,
                &config.default_model,
            )))
        },
        LlmProviderType::Anthropic => {
            let api_key = config
                .api_key
                .as_ref()
                .ok_or_else(|| Error::Validation("Anthropic API key required".to_string()))?;
            Ok(Box::new(AnthropicProvider::new(
                api_key,
                &config.default_model,
            )))
        },
        LlmProviderType::Ollama => Ok(Box::new(OllamaProvider::new(
            &config.base_url,
            &config.default_model,
        ))),
        LlmProviderType::LlamaCpp => Err(Error::Validation(
            "LlamaCpp provider requires async init via LlamaCppProvider::new()".to_string(),
        )),
    }
}
