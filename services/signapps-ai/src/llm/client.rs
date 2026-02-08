//! LLM client for vLLM (OpenAI-compatible API).

use futures_util::StreamExt;
use reqwest::Client;
use signapps_common::{Error, Result};
use std::pin::Pin;
use tokio::sync::mpsc;

use super::types::*;

/// Default model to use.
pub const DEFAULT_MODEL: &str = "meta-llama/Llama-3.2-3B-Instruct";

/// Client for LLM inference via vLLM.
#[derive(Clone)]
pub struct LlmClient {
    client: Client,
    base_url: String,
    default_model: String,
}

impl LlmClient {
    /// Create a new LLM client.
    pub fn new(base_url: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            default_model: DEFAULT_MODEL.to_string(),
        }
    }

    /// Create a new LLM client with a specific default model.
    pub fn with_model(base_url: &str, model: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            default_model: model.to_string(),
        }
    }

    /// Complete a chat conversation.
    pub async fn chat(&self, messages: Vec<ChatMessage>) -> Result<ChatResponse> {
        self.chat_with_options(messages, None, None).await
    }

    /// Complete a chat with options.
    pub async fn chat_with_options(
        &self,
        messages: Vec<ChatMessage>,
        max_tokens: Option<u32>,
        temperature: Option<f32>,
    ) -> Result<ChatResponse> {
        let request = ChatRequest {
            model: self.default_model.clone(),
            messages,
            max_tokens: max_tokens.or(Some(1024)),
            temperature,
            stream: Some(false),
        };

        let response = self.client
            .post(format!("{}/v1/chat/completions", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| Error::Internal(format!("LLM request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Internal(format!(
                "LLM API error ({}): {}",
                status, body
            )));
        }

        let chat_response: ChatResponse = response
            .json()
            .await
            .map_err(|e| Error::Internal(format!("Failed to parse LLM response: {}", e)))?;

        Ok(chat_response)
    }

    /// Stream a chat conversation.
    pub async fn chat_stream(
        &self,
        messages: Vec<ChatMessage>,
        max_tokens: Option<u32>,
        temperature: Option<f32>,
    ) -> Result<mpsc::Receiver<Result<String>>> {
        let request = ChatRequest {
            model: self.default_model.clone(),
            messages,
            max_tokens: max_tokens.or(Some(1024)),
            temperature,
            stream: Some(true),
        };

        let response = self.client
            .post(format!("{}/v1/chat/completions", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| Error::Internal(format!("LLM request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Internal(format!(
                "LLM API error ({}): {}",
                status, body
            )));
        }

        let (tx, rx) = mpsc::channel(100);

        // Spawn task to process stream
        tokio::spawn(async move {
            let mut stream = response.bytes_stream();

            while let Some(chunk_result) = stream.next().await {
                match chunk_result {
                    Ok(bytes) => {
                        let text = String::from_utf8_lossy(&bytes);

                        // Parse SSE data
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
                    }
                    Err(e) => {
                        let _ = tx.send(Err(Error::Internal(format!("Stream error: {}", e)))).await;
                        return;
                    }
                }
            }
        });

        Ok(rx)
    }

    /// List available models.
    pub async fn list_models(&self) -> Result<Vec<ModelInfo>> {
        let response = self.client
            .get(format!("{}/v1/models", self.base_url))
            .send()
            .await
            .map_err(|e| Error::Internal(format!("Models request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Internal(format!(
                "Models API error ({}): {}",
                status, body
            )));
        }

        let models: ModelsResponse = response
            .json()
            .await
            .map_err(|e| Error::Internal(format!("Failed to parse models: {}", e)))?;

        Ok(models.data)
    }

    /// Check if the LLM service is healthy.
    pub async fn health_check(&self) -> Result<bool> {
        let response = self.client
            .get(format!("{}/health", self.base_url))
            .send()
            .await
            .map_err(|e| Error::Internal(format!("Health check failed: {}", e)))?;

        Ok(response.status().is_success())
    }
}
