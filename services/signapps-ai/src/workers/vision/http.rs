//! HTTP-based vision worker that calls a vLLM/Ollama multimodal endpoint
//! (OpenAI-compatible chat completions with image support).

use anyhow::{Context, Result};
use async_trait::async_trait;
use base64::Engine;
use bytes::Bytes;
use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::gateway::{BackendType, Capability};
use crate::workers::{AiWorker, VisionResult, VisionWorker};

// ---------------------------------------------------------------------------
// OpenAI-compatible multimodal request / response types
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct ChatCompletionRequest<'a> {
    model: &'a str,
    messages: Vec<ChatMessage<'a>>,
    max_tokens: u32,
}

#[derive(Serialize)]
struct ChatMessage<'a> {
    role: &'a str,
    content: Vec<ContentPart<'a>>,
}

#[derive(Serialize)]
#[serde(tag = "type")]
enum ContentPart<'a> {
    #[serde(rename = "image_url")]
    ImageUrl { image_url: ImageUrlObj },
    #[serde(rename = "text")]
    Text { text: &'a str },
}

#[derive(Serialize)]
struct ImageUrlObj {
    url: String,
}

#[derive(Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<Choice>,
    model: Option<String>,
}

#[derive(Deserialize)]
struct Choice {
    message: ResponseMessage,
}

#[derive(Deserialize)]
struct ResponseMessage {
    content: Option<String>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Encode raw image bytes as a base64 data URL suitable for multimodal APIs.
fn encode_image_data_url(image: &Bytes) -> String {
    let b64 = base64::engine::general_purpose::STANDARD.encode(image);
    format!("data:image/jpeg;base64,{b64}")
}

// ---------------------------------------------------------------------------
// HttpVision
// ---------------------------------------------------------------------------

/// Vision worker that calls a vLLM or Ollama multimodal endpoint using the
/// OpenAI-compatible chat completions API with image content parts.
pub struct HttpVision {
    client: reqwest::Client,
    base_url: String,
    model: String,
}

impl HttpVision {
    /// Create a new HTTP vision worker pointing at `base_url` (e.g.
    /// `http://localhost:8000`). The `model` string specifies which
    /// multimodal model to request.
    pub fn new(base_url: &str, model: &str) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            model: model.to_string(),
        }
    }

    /// Send a multimodal chat completion request with a single image and
    /// text prompt.
    async fn chat_with_image(&self, image: &Bytes, text: &str) -> Result<(String, String)> {
        let data_url = encode_image_data_url(image);

        let body = ChatCompletionRequest {
            model: &self.model,
            messages: vec![ChatMessage {
                role: "user",
                content: vec![
                    ContentPart::ImageUrl {
                        image_url: ImageUrlObj { url: data_url },
                    },
                    ContentPart::Text { text },
                ],
            }],
            max_tokens: 1024,
        };

        debug!(
            base_url = %self.base_url,
            model = %self.model,
            prompt_len = text.len(),
            "HTTP vision chat request"
        );

        let resp = self
            .client
            .post(format!("{}/v1/chat/completions", self.base_url))
            .json(&body)
            .send()
            .await
            .context("failed to send vision request to multimodal endpoint")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("multimodal endpoint returned {status}: {error_body}");
        }

        let completion: ChatCompletionResponse = resp
            .json()
            .await
            .context("failed to parse multimodal chat completion response")?;

        let text_out = completion
            .choices
            .into_iter()
            .next()
            .and_then(|c| c.message.content)
            .unwrap_or_default();

        let model_id = completion.model.unwrap_or_else(|| self.model.clone());

        Ok((text_out, model_id))
    }
}

#[async_trait]
impl AiWorker for HttpVision {
    fn capability(&self) -> Capability {
        Capability::Vision
    }

    fn backend_type(&self) -> BackendType {
        BackendType::Http {
            url: self.base_url.clone(),
        }
    }

    fn required_vram_mb(&self) -> u64 {
        0
    }

    fn quality_score(&self) -> f32 {
        0.80
    }

    fn is_loaded(&self) -> bool {
        true
    }

    async fn health_check(&self) -> bool {
        self.client
            .get(&self.base_url)
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
    }

    async fn load(&self) -> Result<()> {
        Ok(())
    }

    async fn unload(&self) -> Result<()> {
        Ok(())
    }
}

#[async_trait]
impl VisionWorker for HttpVision {
    async fn describe(&self, image: Bytes, prompt: Option<&str>) -> Result<VisionResult> {
        let text = prompt.unwrap_or("Describe this image in detail.");
        let (description, model_id) = self.chat_with_image(&image, text).await?;

        Ok(VisionResult {
            text: description,
            confidence: 0.80,
            model: model_id,
        })
    }

    async fn vqa(&self, image: Bytes, question: &str) -> Result<VisionResult> {
        let (answer, model_id) = self.chat_with_image(&image, question).await?;

        Ok(VisionResult {
            text: answer,
            confidence: 0.80,
            model: model_id,
        })
    }

    async fn batch_describe(&self, images: Vec<Bytes>) -> Result<Vec<VisionResult>> {
        let mut results = Vec::with_capacity(images.len());
        for image in images {
            results.push(self.describe(image, None).await?);
        }
        Ok(results)
    }
}
