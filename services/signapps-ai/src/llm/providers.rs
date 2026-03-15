//! LLM Provider abstraction supporting multiple backends.

use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use tokio::sync::mpsc;

use super::types::*;

/// LLM Provider type.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LlmProviderType {
    /// vLLM (local, OpenAI-compatible) â€” preferred local provider
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

/// Ollama provider implementation.
pub struct OllamaProvider {
    client: Client,
    base_url: String,
    default_model: String,
}

impl OllamaProvider {
    pub fn new(base_url: &str, default_model: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            default_model: default_model.to_string(),
        }
    }
}

#[async_trait]
impl LlmProvider for OllamaProvider {
    fn provider_type(&self) -> LlmProviderType {
        LlmProviderType::Ollama
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>> {
        let response = self
            .client
            .get(format!("{}/api/tags", self.base_url))
            .send()
            .await
            .map_err(|e| Error::Internal(format!("Ollama request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(Error::Internal("Failed to list Ollama models".to_string()));
        }

        let ollama_response: OllamaModelsResponse = response
            .json()
            .await
            .map_err(|e| Error::Internal(format!("Failed to parse Ollama models: {}", e)))?;

        Ok(ollama_response
            .models
            .into_iter()
            .map(|m| ModelInfo {
                id: m.name.clone(),
                object: "model".to_string(),
                owned_by: "ollama".to_string(),
            })
            .collect())
    }

    async fn chat(
        &self,
        messages: Vec<ChatMessage>,
        model: Option<&str>,
        max_tokens: Option<u32>,
        temperature: Option<f32>,
    ) -> Result<ChatResponse> {
        // Ollama supports OpenAI-compatible API
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
            .map_err(|e| Error::Internal(format!("Ollama chat failed: {}", e)))?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Internal(format!("Ollama error: {}", body)));
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
            .map_err(|e| Error::Internal(format!("Ollama stream failed: {}", e)))?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Internal(format!("Ollama error: {}", body)));
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
            .get(format!("{}/api/tags", self.base_url))
            .send()
            .await
            .map_err(|e| Error::Internal(format!("Health check failed: {}", e)))?;

        Ok(response.status().is_success())
    }
}

/// vLLM provider implementation (OpenAI-compatible).
pub struct VllmProvider {
    client: Client,
    base_url: String,
    default_model: String,
}

impl VllmProvider {
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

/// OpenAI provider implementation.
pub struct OpenAIProvider {
    client: Client,
    api_key: String,
    default_model: String,
}

impl OpenAIProvider {
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

/// Anthropic Claude provider implementation.
pub struct AnthropicProvider {
    client: Client,
    api_key: String,
    default_model: String,
}

impl AnthropicProvider {
    pub fn new(api_key: &str, default_model: &str) -> Self {
        Self {
            client: Client::new(),
            api_key: api_key.to_string(),
            default_model: default_model.to_string(),
        }
    }
}

/// Anthropic-specific message format
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
        // Extract system message and convert messages
        let mut system_message = None;
        let anthropic_messages: Vec<AnthropicMessage> = messages
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
        let mut system_message = None;
        let anthropic_messages: Vec<AnthropicMessage> = messages
            .iter()
            .filter_map(|m| match m.role {
                Role::System => {
                    system_message = Some(m.content.clone());
                    None
                }
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
                                if let Ok(event) = serde_json::from_str::<serde_json::Value>(data) {
                                    let event_type = event.get("type").and_then(|t| t.as_str());
                                    match event_type {
                                        Some("content_block_delta") => {
                                            if let Some(delta_text) = event
                                                .get("delta")
                                                .and_then(|d| d.get("text"))
                                                .and_then(|t| t.as_str())
                                            {
                                                if tx.send(Ok(delta_text.to_string())).await.is_err() {
                                                    return;
                                                }
                                            }
                                        }
                                        Some("message_stop") => return,
                                        _ => {} // skip other events
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

/// Google Gemini provider implementation.
pub struct GeminiProvider {
    client: Client,
    api_key: String,
    default_model: String,
}

impl GeminiProvider {
    pub fn new(api_key: &str, default_model: &str) -> Self {
        Self {
            client: Client::new(),
            api_key: api_key.to_string(),
            default_model: default_model.to_string(),
        }
    }
}

/// Gemini-specific types
#[derive(Debug, Serialize)]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    system_instruction: Option<GeminiContent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    generation_config: Option<GeminiGenerationConfig>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GeminiContent {
    #[serde(skip_serializing_if = "Option::is_none")]
    role: Option<String>,
    parts: Vec<GeminiPart>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GeminiPart {
    text: String,
}

#[derive(Debug, Serialize)]
struct GeminiGenerationConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    max_output_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
}

#[derive(Debug, Deserialize)]
struct GeminiResponse {
    candidates: Vec<GeminiCandidate>,
    #[serde(default)]
    usage_metadata: Option<GeminiUsageMetadata>,
}

#[derive(Debug, Deserialize)]
struct GeminiCandidate {
    content: GeminiContent,
    #[serde(default)]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GeminiUsageMetadata {
    #[serde(default)]
    prompt_token_count: i32,
    #[serde(default)]
    candidates_token_count: i32,
    #[serde(default)]
    total_token_count: i32,
}

#[derive(Debug, Deserialize)]
struct GeminiModelsResponse {
    models: Vec<GeminiModelInfo>,
}

#[derive(Debug, Deserialize)]
struct GeminiModelInfo {
    name: String,
    #[serde(default)]
    display_name: Option<String>,
}

#[async_trait]
impl LlmProvider for GeminiProvider {
    fn provider_type(&self) -> LlmProviderType {
        LlmProviderType::Gemini
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>> {
        let response = self
            .client
            .get(format!(
                "https://generativelanguage.googleapis.com/v1beta/models?key={}",
                self.api_key
            ))
            .send()
            .await
            .map_err(|e| Error::Internal(format!("Gemini request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(Error::Internal("Failed to list Gemini models".to_string()));
        }

        let models_response: GeminiModelsResponse = response
            .json()
            .await
            .map_err(|e| Error::Internal(format!("Failed to parse Gemini models: {}", e)))?;

        Ok(models_response
            .models
            .into_iter()
            .filter(|m| m.name.contains("gemini"))
            .map(|m| {
                let id = m.name.strip_prefix("models/").unwrap_or(&m.name).to_string();
                ModelInfo {
                    id,
                    object: "model".to_string(),
                    owned_by: "google".to_string(),
                }
            })
            .collect())
    }

    async fn chat(
        &self,
        messages: Vec<ChatMessage>,
        model: Option<&str>,
        max_tokens: Option<u32>,
        temperature: Option<f32>,
    ) -> Result<ChatResponse> {
        let model_name = model.unwrap_or(&self.default_model);

        // Extract system message and convert
        let mut system_instruction = None;
        let contents: Vec<GeminiContent> = messages
            .iter()
            .filter_map(|m| match m.role {
                Role::System => {
                    system_instruction = Some(GeminiContent {
                        role: None,
                        parts: vec![GeminiPart { text: m.content.clone() }],
                    });
                    None
                }
                Role::User => Some(GeminiContent {
                    role: Some("user".to_string()),
                    parts: vec![GeminiPart { text: m.content.clone() }],
                }),
                Role::Assistant => Some(GeminiContent {
                    role: Some("model".to_string()),
                    parts: vec![GeminiPart { text: m.content.clone() }],
                }),
            })
            .collect();

        let request = GeminiRequest {
            contents,
            system_instruction,
            generation_config: Some(GeminiGenerationConfig {
                max_output_tokens: max_tokens,
                temperature,
            }),
        };

        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            model_name, self.api_key
        );

        let response = self
            .client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| Error::Internal(format!("Gemini chat failed: {}", e)))?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Internal(format!("Gemini error: {}", body)));
        }

        let gemini_response: GeminiResponse = response
            .json()
            .await
            .map_err(|e| Error::Internal(format!("Failed to parse Gemini response: {}", e)))?;

        let content = gemini_response
            .candidates
            .first()
            .map(|c| {
                c.content
                    .parts
                    .iter()
                    .map(|p| p.text.clone())
                    .collect::<Vec<_>>()
                    .join("")
            })
            .unwrap_or_default();

        let usage = gemini_response.usage_metadata.map(|u| Usage {
            prompt_tokens: u.prompt_token_count,
            completion_tokens: u.candidates_token_count,
            total_tokens: u.total_token_count,
        });

        Ok(ChatResponse {
            id: format!("gemini-{}", chrono::Utc::now().timestamp()),
            object: "chat.completion".to_string(),
            created: chrono::Utc::now().timestamp(),
            model: model_name.to_string(),
            choices: vec![ChatChoice {
                index: 0,
                message: ChatMessage::assistant(content),
                finish_reason: gemini_response
                    .candidates
                    .first()
                    .and_then(|c| c.finish_reason.clone()),
            }],
            usage,
        })
    }

    async fn chat_stream(
        &self,
        messages: Vec<ChatMessage>,
        model: Option<&str>,
        max_tokens: Option<u32>,
        temperature: Option<f32>,
    ) -> Result<mpsc::Receiver<Result<String>>> {
        let model_name = model.unwrap_or(&self.default_model).to_string();

        let mut system_instruction = None;
        let contents: Vec<GeminiContent> = messages
            .iter()
            .filter_map(|m| match m.role {
                Role::System => {
                    system_instruction = Some(GeminiContent {
                        role: None,
                        parts: vec![GeminiPart { text: m.content.clone() }],
                    });
                    None
                }
                Role::User => Some(GeminiContent {
                    role: Some("user".to_string()),
                    parts: vec![GeminiPart { text: m.content.clone() }],
                }),
                Role::Assistant => Some(GeminiContent {
                    role: Some("model".to_string()),
                    parts: vec![GeminiPart { text: m.content.clone() }],
                }),
            })
            .collect();

        let request = GeminiRequest {
            contents,
            system_instruction,
            generation_config: Some(GeminiGenerationConfig {
                max_output_tokens: max_tokens,
                temperature,
            }),
        };

        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?key={}&alt=sse",
            model_name, self.api_key
        );

        let response = self
            .client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| Error::Internal(format!("Gemini stream failed: {}", e)))?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Internal(format!("Gemini error: {}", body)));
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
                                if let Ok(chunk) = serde_json::from_str::<GeminiResponse>(data) {
                                    if let Some(candidate) = chunk.candidates.first() {
                                        for part in &candidate.content.parts {
                                            if !part.text.is_empty() {
                                                if tx.send(Ok(part.text.clone())).await.is_err() {
                                                    return;
                                                }
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

    async fn health_check(&self) -> Result<bool> {
        let response = self
            .client
            .get(format!(
                "https://generativelanguage.googleapis.com/v1beta/models?key={}",
                self.api_key
            ))
            .send()
            .await
            .map_err(|e| Error::Internal(format!("Health check failed: {}", e)))?;

        Ok(response.status().is_success())
    }
}

/// LM Studio provider implementation (OpenAI-compatible, local).
pub struct LmStudioProvider {
    inner: VllmProvider,
}

impl LmStudioProvider {
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
        self.inner.chat(messages, model, max_tokens, temperature).await
    }

    async fn chat_stream(
        &self,
        messages: Vec<ChatMessage>,
        model: Option<&str>,
        max_tokens: Option<u32>,
        temperature: Option<f32>,
    ) -> Result<mpsc::Receiver<Result<String>>> {
        self.inner.chat_stream(messages, model, max_tokens, temperature).await
    }

    async fn health_check(&self) -> Result<bool> {
        self.inner.health_check().await
    }
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
        LlmProviderType::LlamaCpp => {
            Err(Error::Validation(
                "LlamaCpp provider requires async init via LlamaCppProvider::new()".to_string(),
            ))
        },
    }
}
