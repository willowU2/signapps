//! HTTP-based video generation worker that calls a generic video generation
//! service (e.g. CogVideoX server).

use anyhow::{Context, Result};
use async_trait::async_trait;
use bytes::Bytes;
use reqwest::multipart;
use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::gateway::{BackendType, Capability};
use crate::workers::{
    AiWorker, ImgToVideoRequest, ModelInfo, VideoGenRequest, VideoGenResult, VideoGenWorker,
};

// ---------------------------------------------------------------------------
// Internal request / response types
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct TextToVideoHttpRequest<'a> {
    prompt: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    duration: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    fps: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    height: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    negative_prompt: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    seed: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    model: Option<&'a str>,
}

#[derive(Deserialize)]
struct HttpModelInfo {
    id: String,
    name: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    vram_required_mb: u64,
    #[serde(default)]
    quality_score: f32,
}

// ---------------------------------------------------------------------------
// HttpVideoGen
// ---------------------------------------------------------------------------

/// Video generation worker that calls a generic video generation HTTP
/// service (e.g. a CogVideoX inference server).
pub struct HttpVideoGen {
    client: reqwest::Client,
    base_url: String,
    default_model: String,
}

impl HttpVideoGen {
    /// Create a new HTTP video generation worker pointing at `base_url`
    /// (e.g. `http://localhost:8090`).
    pub fn new(base_url: &str, default_model: &str) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            default_model: default_model.to_string(),
        }
    }
}

#[async_trait]
impl AiWorker for HttpVideoGen {
    fn capability(&self) -> Capability {
        Capability::VideoGen
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
        0.70
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
impl VideoGenWorker for HttpVideoGen {
    async fn text_to_video(&self, request: VideoGenRequest) -> Result<VideoGenResult> {
        let start = std::time::Instant::now();
        let model_name = request.model.as_deref().unwrap_or(&self.default_model);

        let body = TextToVideoHttpRequest {
            prompt: &request.prompt,
            duration: request.duration_secs,
            fps: request.fps,
            width: request.width,
            height: request.height,
            negative_prompt: request.negative_prompt.as_deref(),
            seed: request.seed,
            model: Some(model_name),
        };

        let url = format!("{}/api/v1/generate", self.base_url);

        debug!(
            url = %url,
            model = %model_name,
            "HTTP text-to-video generation request"
        );

        let resp = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .with_context(|| format!("failed to send text-to-video request to {url}"))?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!(
                "video generation endpoint {url} returned {status}: \
                 {error_body}"
            );
        }

        let video = resp
            .bytes()
            .await
            .context("failed to read video bytes from response")?;

        let duration_ms = start.elapsed().as_millis() as u64;
        let duration_secs = request.duration_secs.unwrap_or(4.0);
        let fps = request.fps.unwrap_or(24);
        let model = request.model.unwrap_or_else(|| self.default_model.clone());

        Ok(VideoGenResult {
            video,
            duration_secs,
            fps,
            model,
            duration_ms,
        })
    }

    async fn img_to_video(&self, request: ImgToVideoRequest) -> Result<VideoGenResult> {
        let start = std::time::Instant::now();
        let model_name = request.model.as_deref().unwrap_or(&self.default_model);

        let url = format!("{}/api/v1/img2video", self.base_url);

        debug!(
            url = %url,
            model = %model_name,
            "HTTP img-to-video generation request"
        );

        // Build multipart form with image file + parameters
        let mut form = multipart::Form::new().part(
            "image",
            multipart::Part::bytes(request.image.to_vec())
                .file_name("input.png")
                .mime_str("image/png")?,
        );

        if let Some(ref prompt) = request.prompt {
            form = form.text("prompt", prompt.clone());
        }
        if let Some(dur) = request.duration_secs {
            form = form.text("duration", dur.to_string());
        }
        if let Some(fps) = request.fps {
            form = form.text("fps", fps.to_string());
        }
        if let Some(seed) = request.seed {
            form = form.text("seed", seed.to_string());
        }
        form = form.text("model", model_name.to_string());

        let resp = self
            .client
            .post(&url)
            .multipart(form)
            .send()
            .await
            .with_context(|| format!("failed to send img-to-video request to {url}"))?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!(
                "img-to-video endpoint {url} returned {status}: \
                 {error_body}"
            );
        }

        let video = resp
            .bytes()
            .await
            .context("failed to read video bytes from img2video response")?;

        let duration_ms = start.elapsed().as_millis() as u64;
        let duration_secs = request.duration_secs.unwrap_or(4.0);
        let fps = request.fps.unwrap_or(24);
        let model = request.model.unwrap_or_else(|| self.default_model.clone());

        Ok(VideoGenResult {
            video,
            duration_secs,
            fps,
            model,
            duration_ms,
        })
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>> {
        let url = format!("{}/api/v1/models", self.base_url);

        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .context("failed to fetch models from video generation service")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!(
                "video generation models endpoint returned {status}: \
                 {error_body}"
            );
        }

        let models: Vec<HttpModelInfo> = resp
            .json()
            .await
            .context("failed to parse model list response")?;

        Ok(models
            .into_iter()
            .map(|m| ModelInfo {
                id: m.id,
                name: m.name,
                description: m.description,
                vram_required_mb: m.vram_required_mb,
                quality_score: m.quality_score,
            })
            .collect())
    }
}
