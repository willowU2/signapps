//! LM Studio provider implementation (OpenAI-compatible, local).

use async_trait::async_trait;
use signapps_common::Result;
use tokio::sync::mpsc;

use super::providers::{LlmProvider, LlmProviderType};
use super::types::*;
use super::vllm::VllmProvider;

/// LM Studio provider implementation (delegates to VllmProvider).
pub struct LmStudioProvider {
    inner: VllmProvider,
}

impl LmStudioProvider {
    /// Create a new LM Studio provider.
    pub fn new(base_url: &str, default_model: &str) -> Self {
        Self {
            inner: VllmProvider::new(base_url, default_model),
        }
    }
}

#[async_trait]
impl LlmProvider for LmStudioProvider {
    fn provider_type(&self) -> LlmProviderType {
        LlmProviderType::LmStudio
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>> {
        self.inner.list_models().await
    }

    async fn chat(
        &self,
        messages: Vec<ChatMessage>,
        model: Option<&str>,
        max_tokens: Option<u32>,
        temperature: Option<f32>,
    ) -> Result<ChatResponse> {
        self.inner
            .chat(messages, model, max_tokens, temperature)
            .await
    }

    async fn chat_stream(
        &self,
        messages: Vec<ChatMessage>,
        model: Option<&str>,
        max_tokens: Option<u32>,
        temperature: Option<f32>,
    ) -> Result<mpsc::Receiver<Result<String>>> {
        self.inner
            .chat_stream(messages, model, max_tokens, temperature)
            .await
    }

    async fn health_check(&self) -> Result<bool> {
        self.inner.health_check().await
    }
}
