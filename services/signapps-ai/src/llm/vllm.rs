//! vLLM provider implementation (OpenAI-compatible).

use async_trait::async_trait;
use reqwest::Client;
use signapps_common::{Error, Result};
use tokio::sync::mpsc;

use super::providers::{LlmProvider, LlmProviderType};
use super::types::*;

/// vLLM provider implementation (OpenAI-compatible).
pub struct VllmProvider {
    client: Client,
    base_url: String,
    default_model: String,
}

impl VllmProvider {
    /// Create a new vLLM provider.
    ///
    /// Normalizes the base URL by stripping a trailing `/v1` suffix if present.
    pub fn new(base_url: &str, default_model: &str) -> Self {
        // Normalize: strip trailing /v1 if present (we add it in each request)
        let base = base_url.trim_end_matches('/');
        let base = base.strip_suffix("/v1").unwrap_or(base);
        Self {
            client: Client::new(),
            base_url: base.to_string(),
            default_model: default_model.to_string(),
        }
    }
}

#[async_trait]
impl LlmProvider for VllmProvider {
    fn provider_type(&self) -> LlmProviderType {
        LlmProviderType::Vllm
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>> {
        let response = self
            .client
            .get(format!("{}/v1/models", self.base_url))
            .send()
            .await
            .map_err(|e| Error::Internal(format!("vLLM request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(Error::Internal("Failed to list vLLM models".to_string()));
        }

        let models_response: ModelsResponse = response
            .json()
            .await
            .map_err(|e| Error::Internal(format!("Failed to parse vLLM models: {}", e)))?;

        Ok(models_response.data)
    }

    async fn chat(
        &self,
        messages: Vec<ChatMessage>,
        model: Option<&str>,
        max_tokens: Option<u32>,
        temperature: Option<f32>,
    ) -> Result<ChatResponse> {
        let request = ChatRequest {
            model: model.unwrap_or(&self.default_model).to_string(),
            messages,
            max_tokens: max_tokens.or(Some(1024)),
            temperature,
            stream: Some(false),
        };

        let response = self
            .client
            .post(format!("{}/v1/chat/completions", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| Error::Internal(format!("vLLM chat failed: {}", e)))?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Internal(format!("vLLM error: {}", body)));
        }

        response
            .json()
            .await
            .map_err(|e| Error::Internal(format!("Failed to parse response: {}", e)))
    }

    async fn chat_stream(
        &self,
        messages: Vec<ChatMessage>,
        model: Option<&str>,
        max_tokens: Option<u32>,
        temperature: Option<f32>,
    ) -> Result<mpsc::Receiver<Result<String>>> {
        let request = ChatRequest {
            model: model.unwrap_or(&self.default_model).to_string(),
            messages,
            max_tokens: max_tokens.or(Some(1024)),
            temperature,
            stream: Some(true),
        };

        let response = self
            .client
            .post(format!("{}/v1/chat/completions", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| Error::Internal(format!("vLLM stream failed: {}", e)))?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Internal(format!("vLLM error: {}", body)));
        }

        let (tx, rx) = mpsc::channel(100);

        tokio::spawn(async move {
            use futures_util::StreamExt;
            let mut stream = response.bytes_stream();

            while let Some(chunk_result) = stream.next().await {
                match chunk_result {
                    Ok(bytes) => {
                        let text = String::from_utf8_lossy(&bytes);
                        for line in text.lines() {
                            if let Some(data) = line.strip_prefix("data: ") {
                                if data.trim() == "[DONE]" {
                                    break;
                                }
                                if let Ok(chunk) = serde_json::from_str::<ChatChunk>(data) {
                                    if let Some(choice) = chunk.choices.first() {
                                        if let Some(content) = &choice.delta.content {
                                            if tx.send(Ok(content.clone())).await.is_err() {
                                                return;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    Err(e) => {
                        let _ = tx
                            .send(Err(Error::Internal(format!("Stream error: {}", e))))
                            .await;
                        return;
                    },
                }
            }
        });

        Ok(rx)
    }

    async fn health_check(&self) -> Result<bool> {
        let response = self
            .client
            .get(format!("{}/health", self.base_url))
            .send()
            .await
            .map_err(|e| Error::Internal(format!("Health check failed: {}", e)))?;

        Ok(response.status().is_success())
    }
}
