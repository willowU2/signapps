//! Cloud-based image generation worker that calls the OpenAI DALL-E API.

use std::time::Instant;

use anyhow::{Context, Result};
use async_trait::async_trait;
use base64::Engine;
use bytes::Bytes;
use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::gateway::{BackendType, Capability};
use crate::workers::{
    AiWorker, ImageGenRequest, ImageGenResult, ImageGenWorker, Img2ImgRequest, InpaintRequest,
    ModelInfo, UpscaleRequest,
};

// ---------------------------------------------------------------------------
// OpenAI Images API URLs
// ---------------------------------------------------------------------------

const OPENAI_IMAGES_URL: &str = "https://api.openai.com/v1/images/generations";
const OPENAI_IMAGES_EDITS_URL: &str = "https://api.openai.com/v1/images/edits";

// ---------------------------------------------------------------------------
// OpenAI Images API request / response types
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct ImageGenerationRequest<'a> {
    model: &'a str,
    prompt: &'a str,
    n: u32,
    size: &'a str,
    quality: &'a str,
    response_format: &'a str,
}

#[derive(Deserialize)]
struct ImageGenerationResponse {
    data: Vec<ImageData>,
}

#[derive(Deserialize)]
struct ImageData {
    b64_json: Option<String>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Map arbitrary width/height to the nearest DALL-E 3 supported size.
fn map_dalle_size(width: u32, height: u32) -> &'static str {
    let aspect = width as f32 / height as f32;
    if aspect > 1.4 {
        // Landscape
        "1792x1024"
    } else if aspect < 0.7 {
        // Portrait
        "1024x1792"
    } else {
        // Square-ish
        "1024x1024"
    }
}

/// Decode a base64 string into raw bytes.
fn decode_base64(s: &str) -> Result<Bytes> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(s)
        .context("failed to decode base64 image data from OpenAI")?;
    Ok(Bytes::from(bytes))
}

/// Encode raw image bytes as base64.
fn encode_base64(data: &Bytes) -> String {
    base64::engine::general_purpose::STANDARD.encode(data)
}

// ---------------------------------------------------------------------------
// CloudImageGen
// ---------------------------------------------------------------------------

/// Image generation worker that calls the OpenAI DALL-E API for text-to-image
/// generation and image editing.
pub struct CloudImageGen {
    client: reqwest::Client,
    api_key: String,
    model: String,
}

impl CloudImageGen {
    /// Create a new OpenAI cloud image generation worker. Defaults to
    /// `"dall-e-3"` if no model is specified.
    pub fn new(api_key: &str, model: Option<&str>) -> Self {
        Self {
            client: reqwest::Client::new(),
            api_key: api_key.to_string(),
            model: model.unwrap_or("dall-e-3").to_string(),
        }
    }
}

#[async_trait]
impl AiWorker for CloudImageGen {
    fn capability(&self) -> Capability {
        Capability::ImageGen
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
        0.90
    }

    fn is_loaded(&self) -> bool {
        true
    }

    async fn health_check(&self) -> bool {
        // Cloud service is assumed to be always available; calling OpenAI
        // for a health check would consume API quota.
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
impl ImageGenWorker for CloudImageGen {
    async fn generate(&self, request: ImageGenRequest) -> Result<ImageGenResult> {
        let start = Instant::now();

        let width = request.width.unwrap_or(1024);
        let height = request.height.unwrap_or(1024);
        let size = map_dalle_size(width, height);

        let body = ImageGenerationRequest {
            model: request.model.as_deref().unwrap_or(&self.model),
            prompt: &request.prompt,
            n: 1,
            size,
            quality: "hd",
            response_format: "b64_json",
        };

        debug!(
            model = %body.model,
            size = %size,
            prompt_len = request.prompt.len(),
            "OpenAI image generation request"
        );

        let resp = self
            .client
            .post(OPENAI_IMAGES_URL)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&body)
            .send()
            .await
            .context("failed to send image generation request to OpenAI")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("OpenAI image generation API returned {status}: {error_body}");
        }

        let gen: ImageGenerationResponse = resp
            .json()
            .await
            .context("failed to parse OpenAI image generation response")?;

        let images = gen
            .data
            .into_iter()
            .filter_map(|d| d.b64_json)
            .map(|b64| decode_base64(&b64))
            .collect::<Result<Vec<_>>>()?;

        if images.is_empty() {
            anyhow::bail!("OpenAI returned no images");
        }

        let model = request.model.unwrap_or_else(|| self.model.clone());

        Ok(ImageGenResult {
            images,
            seed: None,
            model,
            duration_ms: start.elapsed().as_millis() as u64,
        })
    }

    async fn inpaint(&self, request: InpaintRequest) -> Result<ImageGenResult> {
        let start = Instant::now();

        let model = request.model.as_deref().unwrap_or(&self.model).to_string();

        debug!(
            model = %model,
            prompt_len = request.prompt.len(),
            "OpenAI image edit (inpaint) request"
        );

        // The OpenAI edits endpoint requires multipart form data with
        // image and mask as file uploads.
        let form = reqwest::multipart::Form::new()
            .text("model", model.clone())
            .text("prompt", request.prompt.clone())
            .part(
                "image",
                reqwest::multipart::Part::bytes(request.image.to_vec())
                    .file_name("image.png")
                    .mime_str("image/png")?,
            )
            .part(
                "mask",
                reqwest::multipart::Part::bytes(request.mask.to_vec())
                    .file_name("mask.png")
                    .mime_str("image/png")?,
            )
            .text("n", "1")
            .text("size", "1024x1024")
            .text("response_format", "b64_json");

        let resp = self
            .client
            .post(OPENAI_IMAGES_EDITS_URL)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .multipart(form)
            .send()
            .await
            .context("failed to send image edit request to OpenAI")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("OpenAI image edit API returned {status}: {error_body}");
        }

        let gen: ImageGenerationResponse = resp
            .json()
            .await
            .context("failed to parse OpenAI image edit response")?;

        let images = gen
            .data
            .into_iter()
            .filter_map(|d| d.b64_json)
            .map(|b64| decode_base64(&b64))
            .collect::<Result<Vec<_>>>()?;

        if images.is_empty() {
            anyhow::bail!("OpenAI returned no images for inpaint");
        }

        Ok(ImageGenResult {
            images,
            seed: None,
            model,
            duration_ms: start.elapsed().as_millis() as u64,
        })
    }

    async fn img2img(&self, request: Img2ImgRequest) -> Result<ImageGenResult> {
        let start = Instant::now();

        let model = request.model.as_deref().unwrap_or(&self.model).to_string();

        debug!(
            model = %model,
            prompt_len = request.prompt.len(),
            "OpenAI image edit (img2img / variation) request"
        );

        // Use the edits endpoint with the source image and a prompt to
        // achieve an img2img-like transformation.
        let form = reqwest::multipart::Form::new()
            .text("model", model.clone())
            .text("prompt", request.prompt.clone())
            .part(
                "image",
                reqwest::multipart::Part::bytes(request.image.to_vec())
                    .file_name("image.png")
                    .mime_str("image/png")?,
            )
            .text("n", "1")
            .text("size", "1024x1024")
            .text("response_format", "b64_json");

        let resp = self
            .client
            .post(OPENAI_IMAGES_EDITS_URL)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .multipart(form)
            .send()
            .await
            .context("failed to send image edit request to OpenAI")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("OpenAI image edit API returned {status}: {error_body}");
        }

        let gen: ImageGenerationResponse = resp
            .json()
            .await
            .context("failed to parse OpenAI image edit response")?;

        let images = gen
            .data
            .into_iter()
            .filter_map(|d| d.b64_json)
            .map(|b64| decode_base64(&b64))
            .collect::<Result<Vec<_>>>()?;

        if images.is_empty() {
            anyhow::bail!("OpenAI returned no images for img2img");
        }

        Ok(ImageGenResult {
            images,
            seed: None,
            model,
            duration_ms: start.elapsed().as_millis() as u64,
        })
    }

    async fn upscale(&self, _request: UpscaleRequest) -> Result<ImageGenResult> {
        anyhow::bail!("DALL-E does not support upscaling")
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>> {
        Ok(vec![
            ModelInfo {
                id: "dall-e-3".to_string(),
                name: "DALL-E 3".to_string(),
                description: "Latest DALL-E model with high quality and prompt adherence"
                    .to_string(),
                vram_required_mb: 0,
                quality_score: 0.95,
            },
            ModelInfo {
                id: "dall-e-2".to_string(),
                name: "DALL-E 2".to_string(),
                description: "Previous generation DALL-E model, faster but lower quality"
                    .to_string(),
                vram_required_mb: 0,
                quality_score: 0.80,
            },
        ])
    }
}
