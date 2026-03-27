//! Cloud-based multimodal embeddings worker that calls the OpenAI Embeddings API.

use anyhow::{Context, Result};
use async_trait::async_trait;
use bytes::Bytes;
use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::gateway::{BackendType, Capability};
use crate::workers::{AiWorker, MultimodalEmbedWorker};

// ---------------------------------------------------------------------------
// OpenAI API URL
// ---------------------------------------------------------------------------

const OPENAI_EMBEDDINGS_URL: &str = "https://api.openai.com/v1/embeddings";

// ---------------------------------------------------------------------------
// Internal request / response types for OpenAI Embeddings API
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct OpenAiEmbeddingsRequest<'a> {
    input: &'a [String],
    model: &'a str,
}

#[derive(Deserialize)]
struct OpenAiEmbeddingsResponse {
    data: Vec<OpenAiEmbeddingItem>,
}

#[derive(Deserialize)]
struct OpenAiEmbeddingItem {
    embedding: Vec<f32>,
    #[allow(dead_code)]
    index: usize,
}

// ---------------------------------------------------------------------------
// CloudMultimodalEmbed
// ---------------------------------------------------------------------------

/// Multimodal embeddings worker that calls the OpenAI Embeddings API.
///
/// Text embedding is fully supported. Image and audio embeddings are not
/// supported by OpenAI's text-embedding models and will return errors.
pub struct CloudMultimodalEmbed {
    client: reqwest::Client,
    api_key: String,
    model: String,
}

impl CloudMultimodalEmbed {
    /// Create a new OpenAI cloud embeddings worker. If `model` is `None`,
    /// defaults to `"text-embedding-3-large"`.
    pub fn new(api_key: &str, model: Option<&str>) -> Self {
        Self {
            client: reqwest::Client::new(),
            api_key: api_key.to_string(),
            model: model.unwrap_or("text-embedding-3-large").to_string(),
        }
    }
}

#[async_trait]
impl AiWorker for CloudMultimodalEmbed {
    fn capability(&self) -> Capability {
        Capability::MultimodalEmbed
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
        0.80
    }

    fn is_loaded(&self) -> bool {
        true
    }

    async fn health_check(&self) -> bool {
        // Cloud service is assumed to be always available; no lightweight
        // health endpoint exists on OpenAI that doesn't consume credits.
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
impl MultimodalEmbedWorker for CloudMultimodalEmbed {
    async fn embed_text(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>> {
        debug!(
            model = %self.model,
            num_texts = texts.len(),
            "OpenAI embed_text request"
        );

        let body = OpenAiEmbeddingsRequest {
            input: &texts,
            model: &self.model,
        };

        let resp = self
            .client
            .post(OPENAI_EMBEDDINGS_URL)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&body)
            .send()
            .await
            .context("failed to send embeddings request to OpenAI API")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("OpenAI embeddings API returned {status}: {error_body}");
        }

        let openai_resp: OpenAiEmbeddingsResponse = resp
            .json()
            .await
            .context("failed to parse OpenAI embeddings response")?;

        // OpenAI returns items sorted by index, but we sort explicitly to be safe.
        let mut items = openai_resp.data;
        items.sort_by_key(|item| item.index);

        let embeddings = items.into_iter().map(|item| item.embedding).collect();
        Ok(embeddings)
    }

    async fn embed_image(&self, _images: Vec<Bytes>) -> Result<Vec<Vec<f32>>> {
        anyhow::bail!(
            "OpenAI text-embedding models don't support image input directly. \
             Use an HTTP multimodal embedding service (CLIP/SigLIP) for image \
             embeddings instead."
        )
    }

    async fn embed_audio(&self, _audio: Vec<Bytes>) -> Result<Vec<Vec<f32>>> {
        anyhow::bail!(
            "Audio embeddings are not supported by OpenAI text-embedding models. \
             Use an HTTP multimodal embedding service for audio embeddings instead."
        )
    }
}
