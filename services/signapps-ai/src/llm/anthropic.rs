//! Anthropic Claude provider implementation.

use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use tokio::sync::mpsc;

use super::providers::{LlmProvider, LlmProviderType};
use super::types::*;

/// Anthropic Claude provider implementation.
pub struct AnthropicProvider {
    client: Client,
    api_key: String,
    default_model: String,
}

impl AnthropicProvider {
    /// Create a new Anthropic provider.
    pub fn new(api_key: &str, default_model: &str) -> Self {
        Self {
            client: Client::new(),
            api_key: api_key.to_string(),
            default_model: default_model.to_string(),
        }
    }
}

/// Anthropic-specific message format.
#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<AnthropicMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
}

#[derive(Debug, Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    id: String,
    content: Vec<AnthropicContent>,
    model: String,
    usage: AnthropicUsage,
}

#[derive(Debug, Deserialize)]
struct AnthropicContent {
    #[serde(rename = "type")]
    content_type: String,
    text: String,
}

#[derive(Debug, Deserialize)]
struct AnthropicUsage {
    input_tokens: i32,
    output_tokens: i32,
}

fn build_anthropic_messages(
    messages: &[ChatMessage],
) -> (Vec<AnthropicMessage>, Option<String>) {
    let mut system_message = None;
    let anthropic_messages = messages
        .iter()
        .filter_map(|m| match m.role {
            Role::System => {
                system_message = Some(m.content.clone());
                None
            },
            Role::User => Some(AnthropicMessage {
                role: "user".to_string(),
                content: m.content.clone(),
            }),
            Role::Assistant => Some(AnthropicMessage {
                role: "assistant".to_string(),
                content: m.content.clone(),
            }),
        })
        .collect();
    (anthropic_messages, system_message)
}

#[async_trait]
impl LlmProvider for AnthropicProvider {
    fn provider_type(&self) -> LlmProviderType {
        LlmProviderType::Anthropic
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>> {
        // Anthropic doesn't have a public models endpoint, return known models
        Ok(vec![
            ModelInfo {
                id: "claude-opus-4-0-20250514".to_string(),
                object: "model".to_string(),
                owned_by: "anthropic".to_string(),
            },
            ModelInfo {
                id: "claude-sonnet-4-0-20250514".to_string(),
                object: "model".to_string(),
                owned_by: "anthropic".to_string(),
            },
            ModelInfo {
                id: "claude-3-7-sonnet-20250219".to_string(),
                object: "model".to_string(),
                owned_by: "anthropic".to_string(),
            },
            ModelInfo {
                id: "claude-3-5-haiku-20241022".to_string(),
                object: "model".to_string(),
                owned_by: "anthropic".to_string(),
            },
        ])
    }

    async fn chat(
        &self,
        messages: Vec<ChatMessage>,
        model: Option<&str>,
        max_tokens: Option<u32>,
        temperature: Option<f32>,
    ) -> Result<ChatResponse> {
        let (anthropic_messages, system_message) = build_anthropic_messages(&messages);

        let request = AnthropicRequest {
            model: model.unwrap_or(&self.default_model).to_string(),
            max_tokens: max_tokens.unwrap_or(1024),
            messages: anthropic_messages,
            system: system_message,
            temperature,
            stream: Some(false),
        };

        let response = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| Error::Internal(format!("Anthropic chat failed: {}", e)))?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Internal(format!("Anthropic error: {}", body)));
        }

        let anthropic_response: AnthropicResponse = response
            .json()
            .await
            .map_err(|e| Error::Internal(format!("Failed to parse response: {}", e)))?;

        // Convert to standard format
        let content = anthropic_response
            .content
            .iter()
            .filter(|c| c.content_type == "text")
            .map(|c| c.text.clone())
            .collect::<Vec<_>>()
            .join("");

        Ok(ChatResponse {
            id: anthropic_response.id,
            object: "chat.completion".to_string(),
            created: chrono::Utc::now().timestamp(),
            model: anthropic_response.model,
            choices: vec![ChatChoice {
                index: 0,
                message: ChatMessage::assistant(content),
                finish_reason: Some("stop".to_string()),
            }],
            usage: Some(Usage {
                prompt_tokens: anthropic_response.usage.input_tokens,
                completion_tokens: anthropic_response.usage.output_tokens,
                total_tokens: anthropic_response.usage.input_tokens
                    + anthropic_response.usage.output_tokens,
            }),
        })
    }

    async fn chat_stream(
        &self,
        messages: Vec<ChatMessage>,
        model: Option<&str>,
        max_tokens: Option<u32>,
        temperature: Option<f32>,
    ) -> Result<mpsc::Receiver<Result<String>>> {
        let (anthropic_messages, system_message) = build_anthropic_messages(&messages);

        let request = AnthropicRequest {
            model: model.unwrap_or(&self.default_model).to_string(),
            max_tokens: max_tokens.unwrap_or(1024),
            messages: anthropic_messages,
            system: system_message,
            temperature,
            stream: Some(true),
        };

        let response = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| Error::Internal(format!("Anthropic stream failed: {}", e)))?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Internal(format!("Anthropic error: {}", body)));
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
                                // Anthropic SSE: content_block_delta events contain text
                                if let Ok(event) =
                                    serde_json::from_str::<serde_json::Value>(data)
                                {
                                    let event_type =
                                        event.get("type").and_then(|t| t.as_str());
                                    match event_type {
                                        Some("content_block_delta") => {
                                            if let Some(delta_text) = event
                                                .get("delta")
                                                .and_then(|d| d.get("text"))
                                                .and_then(|t| t.as_str())
                                            {
                                                if tx
                                                    .send(Ok(delta_text.to_string()))
                                                    .await
                                                    .is_err()
                                                {
                                                    return;
                                                }
                                            }
                                        },
                                        Some("message_stop") => return,
                                        _ => {}, // skip other events
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
            .get("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .send()
            .await;

        Ok(response.is_ok())
    }
}
