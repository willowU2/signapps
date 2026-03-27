//! HTTP-based multimodal embeddings worker that calls a CLIP/SigLIP service.
#![allow(dead_code)]

use anyhow::{Context, Result};
use async_trait::async_trait;
use bytes::Bytes;
use serde::Deserialize;
use tracing::debug;

use crate::gateway::{BackendType, Capability};
use crate::workers::{AiWorker, MultimodalEmbedWorker};

// ---------------------------------------------------------------------------
// Internal response types
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct EmbedResponse(Vec<Vec<f32>>);

// ---------------------------------------------------------------------------
// HttpMultimodalEmbed
// ---------------------------------------------------------------------------

/// Multimodal embeddings worker that calls a TEI-compatible HTTP endpoint
/// (e.g. a CLIP or SigLIP service) for text, image, and audio embeddings.
pub struct HttpMultimodalEmbed {
    client: reqwest::Client,
    base_url: String,
    model: String,
    dimension: usize,
}

impl HttpMultimodalEmbed {
    /// Create a new HTTP multimodal embeddings worker.
    ///
    /// - `base_url` — root URL of the embedding service (e.g. `http://localhost:8080`).
    /// - `model` — informational model name; the remote server decides which model to use.
    /// - `dimension` — expected embedding dimension (e.g. 1024 for SigLIP).
    pub fn new(base_url: &str, model: &str, dimension: usize) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            model: model.to_string(),
            dimension,
        }
    }

    /// The embedding dimension this worker produces.
    pub fn dimension(&self) -> usize {
        self.dimension
    }
}

#[async_trait]
impl AiWorker for HttpMultimodalEmbed {
    fn capability(&self) -> Capability {
        Capability::MultimodalEmbed
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
        0.85
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
impl MultimodalEmbedWorker for HttpMultimodalEmbed {
    async fn embed_text(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>> {
        debug!(
            base_url = %self.base_url,
            model = %self.model,
            num_texts = texts.len(),
            "HTTP multimodal embed_text request"
        );

        let body = serde_json::json!({ "inputs": texts });

        let resp = self
            .client
            .post(format!("{}/embed", self.base_url))
            .json(&body)
            .send()
            .await
            .context("failed to send embed_text request to embedding service")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Embedding service /embed returned {status}: {error_body}");
        }

        let embeddings: EmbedResponse = resp
            .json()
            .await
            .context("failed to parse embed_text response")?;

        Ok(embeddings.0)
    }

    async fn embed_image(&self, images: Vec<Bytes>) -> Result<Vec<Vec<f32>>> {
        debug!(
            base_url = %self.base_url,
            model = %self.model,
            num_images = images.len(),
            "HTTP multimodal embed_image request"
        );

        let mut form = reqwest::multipart::Form::new();
        for (i, image) in images.into_iter().enumerate() {
            let part = reqwest::multipart::Part::bytes(image.to_vec())
                .file_name(format!("image_{i}"))
                .mime_str("application/octet-stream")
                .context("failed to build multipart image part")?;
            form = form.part(format!("image_{i}"), part);
        }

        let resp = self
            .client
            .post(format!("{}/embed-image", self.base_url))
            .multipart(form)
            .send()
            .await
            .context("failed to send embed_image request to embedding service")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Embedding service /embed-image returned {status}: {error_body}");
        }

        let embeddings: EmbedResponse = resp
            .json()
            .await
            .context("failed to parse embed_image response")?;

        Ok(embeddings.0)
    }

    async fn embed_audio(&self, audio: Vec<Bytes>) -> Result<Vec<Vec<f32>>> {
        debug!(
            base_url = %self.base_url,
            model = %self.model,
            num_audio = audio.len(),
            "HTTP multimodal embed_audio request"
        );

        let mut form = reqwest::multipart::Form::new();
        for (i, clip) in audio.into_iter().enumerate() {
            let part = reqwest::multipart::Part::bytes(clip.to_vec())
                .file_name(format!("audio_{i}"))
                .mime_str("application/octet-stream")
                .context("failed to build multipart audio part")?;
            form = form.part(format!("audio_{i}"), part);
        }

        let resp = self
            .client
            .post(format!("{}/embed-audio", self.base_url))
            .multipart(form)
            .send()
            .await
            .context("failed to send embed_audio request to embedding service")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Embedding service /embed-audio returned {status}: {error_body}");
        }

        let embeddings: EmbedResponse = resp
            .json()
            .await
            .context("failed to parse embed_audio response")?;

        Ok(embeddings.0)
    }
}
