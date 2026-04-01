//! Google Gemini provider implementation.

use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use tokio::sync::mpsc;

use super::providers::{LlmProvider, LlmProviderType};
use super::types::*;

/// Google Gemini provider implementation.
pub struct GeminiProvider {
    client: Client,
    api_key: String,
    default_model: String,
}

impl GeminiProvider {
    /// Create a new Gemini provider.
    pub fn new(api_key: &str, default_model: &str) -> Self {
        Self {
            client: Client::new(),
            api_key: api_key.to_string(),
            default_model: default_model.to_string(),
        }
    }
}

/// Gemini-specific types.
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
#[allow(dead_code)]
struct GeminiModelInfo {
    name: String,
    #[serde(default)]
    display_name: Option<String>,
}

fn messages_to_gemini(messages: &[ChatMessage]) -> (Vec<GeminiContent>, Option<GeminiContent>) {
    let mut system_instruction = None;
    let contents = messages
        .iter()
        .filter_map(|m| match m.role {
            Role::System => {
                system_instruction = Some(GeminiContent {
                    role: None,
                    parts: vec![GeminiPart {
                        text: m.content.clone(),
                    }],
                });
                None
            },
            Role::User => Some(GeminiContent {
                role: Some("user".to_string()),
                parts: vec![GeminiPart {
                    text: m.content.clone(),
                }],
            }),
            Role::Assistant => Some(GeminiContent {
                role: Some("model".to_string()),
                parts: vec![GeminiPart {
                    text: m.content.clone(),
                }],
            }),
        })
        .collect();
    (contents, system_instruction)
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
                let id = m
                    .name
                    .strip_prefix("models/")
                    .unwrap_or(&m.name)
                    .to_string();
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
        let (contents, system_instruction) = messages_to_gemini(&messages);

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
        let (contents, system_instruction) = messages_to_gemini(&messages);

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
                                if let Ok(chunk) =
                                    serde_json::from_str::<GeminiResponse>(data)
                                {
                                    if let Some(candidate) = chunk.candidates.first() {
                                        for part in &candidate.content.parts {
                                            if !part.text.is_empty()
                                                && tx
                                                    .send(Ok(part.text.clone()))
                                                    .await
                                                    .is_err()
                                            {
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
