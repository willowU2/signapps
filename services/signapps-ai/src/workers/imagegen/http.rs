//! HTTP-based image generation worker that calls a ComfyUI or
//! Automatic1111/SDAPI-compatible endpoint.

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
// Automatic1111 SDAPI request / response types
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct Txt2ImgRequest<'a> {
    prompt: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    negative_prompt: Option<&'a str>,
    width: u32,
    height: u32,
    steps: u32,
    cfg_scale: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    seed: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    override_settings: Option<OverrideSettings<'a>>,
}

#[derive(Serialize)]
struct Img2ImgRequest_<'a> {
    prompt: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    negative_prompt: Option<&'a str>,
    init_images: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    mask: Option<String>,
    denoising_strength: f32,
    width: u32,
    height: u32,
    steps: u32,
    cfg_scale: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    seed: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    inpainting_fill: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    inpaint_full_res: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    override_settings: Option<OverrideSettings<'a>>,
}

#[derive(Serialize)]
struct OverrideSettings<'a> {
    sd_model_checkpoint: &'a str,
}

#[derive(Serialize)]
struct ExtraSingleImageRequest {
    image: String,
    upscaling_resize: u32,
    upscaler_1: String,
}

#[derive(Deserialize)]
struct GenerationResponse {
    images: Vec<String>,
    #[serde(default)]
    info: Option<String>,
}

#[derive(Deserialize)]
struct ExtraImageResponse {
    image: String,
}

/// Info embedded in the generation response.
#[derive(Deserialize)]
struct GenerationInfo {
    #[serde(default)]
    seed: Option<i64>,
}

#[derive(Deserialize)]
struct SdModel {
    title: String,
    model_name: String,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Encode raw image bytes as a base64 string (no data URL prefix).
fn encode_base64(data: &Bytes) -> String {
    base64::engine::general_purpose::STANDARD.encode(data)
}

/// Decode a base64 string into raw bytes.
fn decode_base64(s: &str) -> Result<Bytes> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(s)
        .context("failed to decode base64 image data")?;
    Ok(Bytes::from(bytes))
}

// ---------------------------------------------------------------------------
// HttpImageGen
// ---------------------------------------------------------------------------

/// Image generation worker that calls a ComfyUI or Automatic1111/SDAPI-
/// compatible endpoint for txt2img, img2img, inpainting, and upscaling.
pub struct HttpImageGen {
    client: reqwest::Client,
    base_url: String,
    default_model: String,
}

impl HttpImageGen {
    /// Create a new HTTP image generation worker pointing at `base_url`
    /// (e.g. `http://localhost:7860`).
    pub fn new(base_url: &str, default_model: &str) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            default_model: default_model.to_string(),
        }
    }

    /// Build override settings if the request specifies a model different
    /// from the default.
    fn override_settings<'a>(&'a self, model: &'a Option<String>) -> Option<OverrideSettings<'a>> {
        model.as_deref().map(|m| OverrideSettings {
            sd_model_checkpoint: m,
        })
    }

    /// Parse the `info` JSON string returned by Automatic1111 to extract
    /// the seed.
    fn parse_seed(info: &Option<String>) -> Option<i64> {
        info.as_deref().and_then(|s| {
            serde_json::from_str::<GenerationInfo>(s)
                .ok()
                .and_then(|i| i.seed)
        })
    }
}

#[async_trait]
impl AiWorker for HttpImageGen {
    fn capability(&self) -> Capability {
        Capability::ImageGen
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
impl ImageGenWorker for HttpImageGen {
    async fn generate(&self, request: ImageGenRequest) -> Result<ImageGenResult> {
        let start = Instant::now();

        let body = Txt2ImgRequest {
            prompt: &request.prompt,
            negative_prompt: request.negative_prompt.as_deref(),
            width: request.width.unwrap_or(512),
            height: request.height.unwrap_or(512),
            steps: request.steps.unwrap_or(20),
            cfg_scale: request.guidance_scale.unwrap_or(7.0),
            seed: request.seed,
            override_settings: self.override_settings(&request.model),
        };

        debug!(
            base_url = %self.base_url,
            prompt_len = request.prompt.len(),
            "HTTP txt2img request"
        );

        let resp = self
            .client
            .post(format!("{}/sdapi/v1/txt2img", self.base_url))
            .json(&body)
            .send()
            .await
            .context("failed to send txt2img request")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("txt2img endpoint returned {status}: {error_body}");
        }

        let gen: GenerationResponse = resp
            .json()
            .await
            .context("failed to parse txt2img response")?;

        let images = gen
            .images
            .iter()
            .map(|b64| decode_base64(b64))
            .collect::<Result<Vec<_>>>()?;

        let seed = Self::parse_seed(&gen.info);
        let model = request.model.unwrap_or_else(|| self.default_model.clone());

        Ok(ImageGenResult {
            images,
            seed,
            model,
            duration_ms: start.elapsed().as_millis() as u64,
        })
    }

    async fn inpaint(&self, request: InpaintRequest) -> Result<ImageGenResult> {
        let start = Instant::now();

        let body = Img2ImgRequest_ {
            prompt: &request.prompt,
            negative_prompt: request.negative_prompt.as_deref(),
            init_images: vec![encode_base64(&request.image)],
            mask: Some(encode_base64(&request.mask)),
            denoising_strength: 0.75,
            width: 512,
            height: 512,
            steps: request.steps.unwrap_or(20),
            cfg_scale: request.guidance_scale.unwrap_or(7.0),
            seed: None,
            inpainting_fill: Some(1),
            inpaint_full_res: Some(true),
            override_settings: self.override_settings(&request.model),
        };

        debug!(
            base_url = %self.base_url,
            prompt_len = request.prompt.len(),
            "HTTP inpaint request"
        );

        let resp = self
            .client
            .post(format!("{}/sdapi/v1/img2img", self.base_url))
            .json(&body)
            .send()
            .await
            .context("failed to send inpaint request")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("inpaint endpoint returned {status}: {error_body}");
        }

        let gen: GenerationResponse = resp
            .json()
            .await
            .context("failed to parse inpaint response")?;

        let images = gen
            .images
            .iter()
            .map(|b64| decode_base64(b64))
            .collect::<Result<Vec<_>>>()?;

        let seed = Self::parse_seed(&gen.info);
        let model = request.model.unwrap_or_else(|| self.default_model.clone());

        Ok(ImageGenResult {
            images,
            seed,
            model,
            duration_ms: start.elapsed().as_millis() as u64,
        })
    }

    async fn img2img(&self, request: Img2ImgRequest) -> Result<ImageGenResult> {
        let start = Instant::now();

        let body = Img2ImgRequest_ {
            prompt: &request.prompt,
            negative_prompt: request.negative_prompt.as_deref(),
            init_images: vec![encode_base64(&request.image)],
            mask: None,
            denoising_strength: request.strength.unwrap_or(0.75),
            width: 512,
            height: 512,
            steps: request.steps.unwrap_or(20),
            cfg_scale: request.guidance_scale.unwrap_or(7.0),
            seed: None,
            inpainting_fill: None,
            inpaint_full_res: None,
            override_settings: self.override_settings(&request.model),
        };

        debug!(
            base_url = %self.base_url,
            prompt_len = request.prompt.len(),
            strength = request.strength.unwrap_or(0.75),
            "HTTP img2img request"
        );

        let resp = self
            .client
            .post(format!("{}/sdapi/v1/img2img", self.base_url))
            .json(&body)
            .send()
            .await
            .context("failed to send img2img request")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("img2img endpoint returned {status}: {error_body}");
        }

        let gen: GenerationResponse = resp
            .json()
            .await
            .context("failed to parse img2img response")?;

        let images = gen
            .images
            .iter()
            .map(|b64| decode_base64(b64))
            .collect::<Result<Vec<_>>>()?;

        let seed = Self::parse_seed(&gen.info);
        let model = request.model.unwrap_or_else(|| self.default_model.clone());

        Ok(ImageGenResult {
            images,
            seed,
            model,
            duration_ms: start.elapsed().as_millis() as u64,
        })
    }

    async fn upscale(&self, request: UpscaleRequest) -> Result<ImageGenResult> {
        let start = Instant::now();

        let body = ExtraSingleImageRequest {
            image: encode_base64(&request.image),
            upscaling_resize: request.scale_factor.unwrap_or(2),
            upscaler_1: request
                .model
                .clone()
                .unwrap_or_else(|| "R-ESRGAN 4x+".to_string()),
        };

        debug!(
            base_url = %self.base_url,
            scale = body.upscaling_resize,
            upscaler = %body.upscaler_1,
            "HTTP upscale request"
        );

        let resp = self
            .client
            .post(format!("{}/sdapi/v1/extra-single-image", self.base_url))
            .json(&body)
            .send()
            .await
            .context("failed to send upscale request")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("upscale endpoint returned {status}: {error_body}");
        }

        let extra: ExtraImageResponse = resp
            .json()
            .await
            .context("failed to parse upscale response")?;

        let image = decode_base64(&extra.image)?;
        let model = request.model.unwrap_or_else(|| "R-ESRGAN 4x+".to_string());

        Ok(ImageGenResult {
            images: vec![image],
            seed: None,
            model,
            duration_ms: start.elapsed().as_millis() as u64,
        })
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>> {
        let resp = self
            .client
            .get(format!("{}/sdapi/v1/sd-models", self.base_url))
            .send()
            .await
            .context("failed to fetch SD models list")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("sd-models endpoint returned {status}: {error_body}");
        }

        let models: Vec<SdModel> = resp
            .json()
            .await
            .context("failed to parse SD models response")?;

        Ok(models
            .into_iter()
            .map(|m| ModelInfo {
                id: m.model_name.clone(),
                name: m.title,
                description: format!("Stable Diffusion model: {}", m.model_name),
                vram_required_mb: 0,
                quality_score: 0.85,
            })
            .collect())
    }
}
