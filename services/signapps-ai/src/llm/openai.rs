//! OpenAI provider implementation.

use async_trait::async_trait;
use reqwest::Client;
use signapps_common::{Error, Result};
use tokio::sync::mpsc;

use super::providers::{LlmProvider, LlmProviderType};
use super::types::*;

/// OpenAI provider implementation.
pub struct OpenAIProvider {
    client: Client,
    api_key: String,
    default_model: String,
}

impl OpenAIProvider {
    /// Create a new OpenAI provider.
    pub fn new(api_key: &str, default_model: &str) -> Self {
        Self {
            client: Client::new(),
            api_key: api_key.to_string(),
            default_model: default_model.to_string(),
        }
    }
}

#[async_trait]
impl LlmProvider for OpenAIProvider {
    fn provider_type(&self) -> LlmProviderType {
        LlmProviderType::OpenAI
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>> {
        let response = self
            .client
            .get("https://api.openai.com/v1/models")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .send()
            .await
            .map_err(|e| Error::Internal(format!("OpenAI request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(Error::Internal("Failed to list OpenAI models".to_string()));
        }

        let models_response: ModelsResponse = response
            .json()
            .await
            .map_err(|e| Error::Internal(format!("Failed to parse OpenAI models: {}", e)))?;

        // Filter to only chat models
        Ok(models_response
            .data
            .into_iter()
            .filter(|m| m.id.starts_with("gpt-"))
            .collect())
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
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&request)
            .send()
            .await
            .map_err(|e| Error::Internal(format!("OpenAI chat failed: {}", e)))?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Internal(format!("OpenAI error: {}", body)));
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
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&request)
            .send()
            .await
            .map_err(|e| Error::Internal(format!("OpenAI stream failed: {}", e)))?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Internal(format!("OpenAI error: {}", body)));
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
            .get("https://api.openai.com/v1/models")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .send()
            .await
            .map_err(|e| Error::Internal(format!("Health check failed: {}", e)))?;

        Ok(response.status().is_success())
    }
}
