//! Cloud-based vision worker that calls the OpenAI GPT-4o Vision API.

use anyhow::{Context, Result};
use async_trait::async_trait;
use base64::Engine;
use bytes::Bytes;
use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::gateway::{BackendType, Capability};
use crate::workers::{AiWorker, VisionResult, VisionWorker};

// ---------------------------------------------------------------------------
// OpenAI API URL
// ---------------------------------------------------------------------------

const OPENAI_CHAT_URL: &str = "https://api.openai.com/v1/chat/completions";

// ---------------------------------------------------------------------------
// OpenAI multimodal request / response types
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
// CloudVision
// ---------------------------------------------------------------------------

/// Vision worker that calls the OpenAI GPT-4o Vision API for image analysis
/// and visual question answering.
pub struct CloudVision {
    client: reqwest::Client,
    api_key: String,
    model: String,
}

impl CloudVision {
    /// Create a new OpenAI cloud vision worker. If `model` is `None`,
    /// defaults to `"gpt-4o"`.
    pub fn new(api_key: &str, model: Option<&str>) -> Self {
        Self {
            client: reqwest::Client::new(),
            api_key: api_key.to_string(),
            model: model.unwrap_or("gpt-4o").to_string(),
        }
    }

    /// Send a multimodal chat completion request with a single image and
    /// text prompt to the OpenAI API.
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
            model = %self.model,
            prompt_len = text.len(),
            "OpenAI vision chat request"
        );

        let resp = self
            .client
            .post(OPENAI_CHAT_URL)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&body)
            .send()
            .await
            .context("failed to send vision request to OpenAI API")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("OpenAI vision API returned {status}: {error_body}");
        }

        let completion: ChatCompletionResponse = resp
            .json()
            .await
            .context("failed to parse OpenAI chat completion response")?;

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
impl AiWorker for CloudVision {
    fn capability(&self) -> Capability {
        Capability::Vision
    }

    fn backend_type(&self) -> BackendType {
        BackendType::Cloud {
            provider: "openai".to_string(),
        }
    }

    fn required_vram_mb(&self) -> u64 {
        0
    }

    fn quality_score(&self) -> f32 {
        0.95
    }

    fn is_loaded(&self) -> bool {
        true
    }

    async fn health_check(&self) -> bool {
        // Cloud service is assumed to be always available; the OpenAI
        // models endpoint would consume API quota for a health check.
        true
    }

    async fn load(&self) -> Result<()> {
        Ok(())
    }

    async fn unload(&self) -> Result<()> {
        Ok(())
    }
}

#[async_trait]
impl VisionWorker for CloudVision {
    async fn describe(&self, image: Bytes, prompt: Option<&str>) -> Result<VisionResult> {
        let text = prompt.unwrap_or("Describe this image in detail.");
        let (description, model_id) = self.chat_with_image(&image, text).await?;

        Ok(VisionResult {
            text: description,
            confidence: 0.95,
            model: model_id,
        })
    }

    async fn vqa(&self, image: Bytes, question: &str) -> Result<VisionResult> {
        let (answer, model_id) = self.chat_with_image(&image, question).await?;

        Ok(VisionResult {
            text: answer,
            confidence: 0.95,
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
