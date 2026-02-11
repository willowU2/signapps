//! Provider registry for managing multiple LLM providers.

use std::collections::HashMap;

use signapps_common::{Error, Result};

use super::providers::{LlmProvider, LlmProviderType, ProviderConfig};

/// Registry holding all configured LLM providers.
pub struct ProviderRegistry {
    providers: HashMap<String, (ProviderConfig, Box<dyn LlmProvider>)>,
    default_provider_id: String,
}

impl ProviderRegistry {
    /// Create a new empty registry with a default provider ID.
    pub fn new(default_provider_id: String) -> Self {
        Self {
            providers: HashMap::new(),
            default_provider_id,
        }
    }

    /// Register a provider.
    pub fn register(
        &mut self,
        id: &str,
        config: ProviderConfig,
        provider: Box<dyn LlmProvider>,
    ) {
        self.providers
            .insert(id.to_string(), (config, provider));
    }

    /// Get a provider by ID.
    pub fn get(&self, id: &str) -> Result<&dyn LlmProvider> {
        self.providers
            .get(id)
            .map(|(_, p)| p.as_ref())
            .ok_or_else(|| {
                Error::Validation(format!("Provider '{}' not found", id))
            })
    }

    /// Get the default provider.
    pub fn get_default(&self) -> Result<&dyn LlmProvider> {
        self.get(&self.default_provider_id)
    }

    /// Resolve a provider: use the given ID if Some, otherwise the default.
    pub fn resolve(
        &self,
        id: Option<&str>,
    ) -> Result<&dyn LlmProvider> {
        match id {
            Some(id) => self.get(id),
            None => self.get_default(),
        }
    }

    /// List all registered providers with their configs.
    pub fn list_providers(&self) -> Vec<(&str, &ProviderConfig)> {
        self.providers
            .iter()
            .map(|(id, (config, _))| (id.as_str(), config))
            .collect()
    }

    /// Get the default provider ID.
    pub fn default_provider_id(&self) -> &str {
        &self.default_provider_id
    }

    /// Check if the registry has any providers.
    pub fn is_empty(&self) -> bool {
        self.providers.is_empty()
    }

    /// Get human-readable name for a provider type.
    pub fn provider_name(provider_type: &LlmProviderType) -> &'static str {
        match provider_type {
            LlmProviderType::Ollama => "Ollama (Local)",
            LlmProviderType::Vllm => "vLLM (Local GPU)",
            LlmProviderType::OpenAI => "OpenAI",
            LlmProviderType::Anthropic => "Anthropic Claude",
            LlmProviderType::OpenAICompatible => "OpenAI Compatible",
        }
    }

    /// Set the default provider ID.
    pub fn set_default(&mut self, id: String) {
        self.default_provider_id = id;
    }

    /// Check if a provider type is local.
    pub fn is_local(provider_type: &LlmProviderType) -> bool {
        matches!(
            provider_type,
            LlmProviderType::Ollama
                | LlmProviderType::Vllm
                | LlmProviderType::OpenAICompatible
        )
    }
}
