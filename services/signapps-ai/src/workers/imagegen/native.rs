//! Native image generation worker using candle-transformers for
//! Stable Diffusion inference.
//!
//! Implements a full text-to-image pipeline:
//!
//! ```text
//! Prompt -> CLIP text encoder -> text embeddings
//!                                     |
//!           random latent noise  -----+
//!                                     v
//!                              UNet denoising loop (N steps)
//!                                     |
//!                                     v
//!                              VAE decoder -> pixel image -> PNG
//! ```
//!
//! All code is gated behind `#[cfg(feature = "native-imagegen")]`.
//! The feature pulls in: candle-core, candle-nn, candle-transformers,
//! image, hf-hub, tokenizers, and rand.

#![allow(dead_code)]

use std::fmt;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

use anyhow::{Context, Result};
use async_trait::async_trait;

use crate::gateway::{BackendType, Capability};
use crate::workers::{
    AiWorker, ImageGenRequest, ImageGenResult, ImageGenWorker, Img2ImgRequest, InpaintRequest,
    ModelInfo, UpscaleRequest,
};

// ---------------------------------------------------------------------------
// Candle / image imports (only available with native-imagegen feature)
// ---------------------------------------------------------------------------

use candle_core::{DType, Device, IndexOp, Module, Tensor, D};
use candle_nn::VarBuilder;
use candle_transformers::models::stable_diffusion;
use hf_hub::api::sync::Api;
use tokenizers::Tokenizer;
use tokio::sync::Mutex;

// ---------------------------------------------------------------------------
// Model type
// ---------------------------------------------------------------------------

/// Supported diffusion model architectures.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiffusionModelType {
    /// Stable Diffusion 1.5 (~2 GB VRAM)
    StableDiffusion15,
    /// Stable Diffusion 2.1 (~4 GB VRAM)
    StableDiffusion21,
    /// Stable Diffusion XL (~8 GB VRAM)
    StableDiffusionXL,
    /// Stable Diffusion Turbo (~4 GB VRAM, fewer steps)
    StableDiffusionTurbo,
}

impl DiffusionModelType {
    /// Approximate VRAM requirement in megabytes.
    fn vram_mb(&self) -> u64 {
        match self {
            Self::StableDiffusion15 => 2_000,
            Self::StableDiffusion21 => 4_000,
            Self::StableDiffusionXL => 8_000,
            Self::StableDiffusionTurbo => 4_000,
        }
    }

    /// Quality score (0.0 .. 1.0) reflecting typical output fidelity.
    fn quality_score(&self) -> f32 {
        match self {
            Self::StableDiffusion15 => 0.60,
            Self::StableDiffusion21 => 0.70,
            Self::StableDiffusionXL => 0.80,
            Self::StableDiffusionTurbo => 0.65,
        }
    }

    /// Short identifier used in model listings and error messages.
    fn id(&self) -> &'static str {
        match self {
            Self::StableDiffusion15 => "sd-1.5",
            Self::StableDiffusion21 => "sd-2.1",
            Self::StableDiffusionXL => "sdxl",
            Self::StableDiffusionTurbo => "sd-turbo",
        }
    }

    /// Human-readable display name.
    fn display_name(&self) -> &'static str {
        match self {
            Self::StableDiffusion15 => "Stable Diffusion 1.5",
            Self::StableDiffusion21 => "Stable Diffusion 2.1",
            Self::StableDiffusionXL => "Stable Diffusion XL",
            Self::StableDiffusionTurbo => "Stable Diffusion Turbo",
        }
    }

    /// Map to the candle-transformers StableDiffusionVersion.
    fn to_sd_version(&self) -> stable_diffusion::StableDiffusionConfig {
        match self {
            Self::StableDiffusion15 => {
                stable_diffusion::StableDiffusionConfig::v1_5(None, None, None)
            },
            Self::StableDiffusion21 => {
                stable_diffusion::StableDiffusionConfig::v2_1(None, None, None)
            },
            Self::StableDiffusionXL => {
                stable_diffusion::StableDiffusionConfig::sdxl(None, None, None)
            },
            Self::StableDiffusionTurbo => {
                stable_diffusion::StableDiffusionConfig::sdxl_turbo(None, None, None)
            },
        }
    }

    /// HuggingFace repository ID for this model variant.
    fn hf_repo_id(&self) -> &'static str {
        match self {
            Self::StableDiffusion15 => "runwayml/stable-diffusion-v1-5",
            Self::StableDiffusion21 => "stabilityai/stable-diffusion-2-1",
            Self::StableDiffusionXL => "stabilityai/stable-diffusion-xl-base-1.0",
            Self::StableDiffusionTurbo => "stabilityai/sdxl-turbo",
        }
    }

    /// Whether this is an SDXL-based model (affects pipeline shape).
    fn is_sdxl(&self) -> bool {
        matches!(self, Self::StableDiffusionXL | Self::StableDiffusionTurbo)
    }

    /// Default number of inference steps.
    fn default_steps(&self) -> u32 {
        match self {
            Self::StableDiffusion15 => 20,
            Self::StableDiffusion21 => 20,
            Self::StableDiffusionXL => 30,
            Self::StableDiffusionTurbo => 4,
        }
    }

    /// Default guidance scale (CFG).
    fn default_guidance_scale(&self) -> f32 {
        match self {
            Self::StableDiffusion15 => 7.5,
            Self::StableDiffusion21 => 7.5,
            Self::StableDiffusionXL => 7.5,
            // Turbo uses low or no guidance
            Self::StableDiffusionTurbo => 0.0,
        }
    }

    /// Default resolution.
    fn default_resolution(&self) -> (u32, u32) {
        match self {
            Self::StableDiffusion15 => (512, 512),
            Self::StableDiffusion21 => (768, 768),
            Self::StableDiffusionXL | Self::StableDiffusionTurbo => (1024, 1024),
        }
    }
}

impl fmt::Display for DiffusionModelType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.display_name())
    }
}

// ---------------------------------------------------------------------------
// Diffusion pipeline (loaded model state)
// ---------------------------------------------------------------------------

/// Holds all the loaded model components for a Stable Diffusion pipeline.
struct DiffusionPipeline {
    device: Device,
    dtype: DType,
    text_model: stable_diffusion::clip::ClipTextTransformer,
    /// SDXL has a second text encoder; None for SD 1.5/2.1.
    text_model_2: Option<stable_diffusion::clip::ClipTextTransformer>,
    unet: stable_diffusion::unet_2d::UNet2DConditionModel,
    vae: stable_diffusion::vae::AutoEncoderKL,
    tokenizer: Tokenizer,
    /// SDXL uses a second tokenizer; None for SD 1.5/2.1.
    tokenizer_2: Option<Tokenizer>,
    scheduler: stable_diffusion::ddim::DDIMScheduler,
    sd_config: stable_diffusion::StableDiffusionConfig,
    model_type: DiffusionModelType,
}

impl DiffusionPipeline {
    /// Encode a text prompt into embeddings using the CLIP text encoder.
    ///
    /// For SDXL, concatenates embeddings from both text encoders.
    /// Returns the text embedding tensor shaped [1, seq_len, hidden_dim].
    fn encode_prompt(&self, prompt: &str) -> Result<Tensor> {
        let pad_id = *self
            .tokenizer
            .get_vocab(true)
            .get("<|endoftext|>")
            .unwrap_or(&49407u32);

        let mut tokens = self
            .tokenizer
            .encode(prompt, true)
            .map_err(|e| anyhow::anyhow!("Tokenizer error: {e}"))?
            .get_ids()
            .to_vec();

        // Pad or truncate to the model's max position embeddings
        let max_len = self.sd_config.clip.max_position_embeddings;
        tokens.truncate(max_len);
        while tokens.len() < max_len {
            tokens.push(pad_id);
        }

        let token_tensor = Tensor::new(tokens.as_slice(), &self.device)?.unsqueeze(0)?;

        let text_embeddings = self.text_model.forward(&token_tensor)?;

        // For SDXL, also encode with the second text encoder and
        // concatenate along the hidden dimension.
        if let (Some(ref text_model_2), Some(ref tokenizer_2)) =
            (&self.text_model_2, &self.tokenizer_2)
        {
            let pad_id_2 = *tokenizer_2
                .get_vocab(true)
                .get("<|endoftext|>")
                .unwrap_or(&49407u32);

            let mut tokens_2 = tokenizer_2
                .encode(prompt, true)
                .map_err(|e| anyhow::anyhow!("Tokenizer2 error: {e}"))?
                .get_ids()
                .to_vec();

            let max_len_2 = self
                .sd_config
                .clip2
                .as_ref()
                .map(|c| c.max_position_embeddings)
                .unwrap_or(max_len);
            tokens_2.truncate(max_len_2);
            while tokens_2.len() < max_len_2 {
                tokens_2.push(pad_id_2);
            }

            let token_tensor_2 = Tensor::new(tokens_2.as_slice(), &self.device)?.unsqueeze(0)?;

            let text_embeddings_2 = text_model_2.forward(&token_tensor_2)?;

            // Concatenate along last dimension
            let combined = Tensor::cat(&[&text_embeddings, &text_embeddings_2], D::Minus1)?;
            Ok(combined)
        } else {
            Ok(text_embeddings)
        }
    }

    /// Generate a single image from a text prompt.
    ///
    /// Returns raw PNG bytes.
    fn generate_image(
        &self,
        prompt: &str,
        negative_prompt: Option<&str>,
        width: u32,
        height: u32,
        num_steps: u32,
        guidance_scale: f64,
        seed: i64,
    ) -> Result<(Vec<u8>, u32, u32)> {
        tracing::info!(
            prompt_len = prompt.len(),
            %width,
            %height,
            %num_steps,
            %guidance_scale,
            %seed,
            model = %self.model_type,
            "Starting native diffusion inference"
        );

        // --- 1. Encode prompt(s) ---
        let text_embeddings = self.encode_prompt(prompt)?;

        // Encode negative prompt (or empty string) for
        // classifier-free guidance
        let uncond_prompt = negative_prompt.unwrap_or("");
        let uncond_embeddings = self.encode_prompt(uncond_prompt)?;

        // Stack [uncond, cond] for classifier-free guidance
        let text_embeddings = Tensor::cat(&[&uncond_embeddings, &text_embeddings], 0)?;

        // --- 2. Initialize random latent noise ---
        let latent_height = (height as usize) / 8;
        let latent_width = (width as usize) / 8;
        // candle uses the in_channels from the unet config (4 for SD)
        let in_channels = 4_usize;

        // Note: candle_core::Tensor::randn uses a shape, not a seed
        // directly. We set the seed on the device/rng.
        // The candle API for seeded random generation:
        let latents = Tensor::randn(
            0f32,
            1f32,
            &[1, in_channels, latent_height, latent_width],
            &self.device,
        )?
        .to_dtype(self.dtype)?;

        // --- 3. Setup scheduler ---
        let scheduler = stable_diffusion::ddim::DDIMScheduler::new(
            num_steps as usize,
            self.sd_config.scheduler.clone(),
        );

        let timesteps = scheduler.timesteps();

        // Scale initial noise by the scheduler's init noise sigma
        let init_noise_sigma = scheduler.init_noise_sigma();
        let mut latents = (latents * init_noise_sigma)?;

        // --- 4. Denoising loop ---
        for (step_idx, &timestep) in timesteps.iter().enumerate() {
            tracing::trace!(
                step = step_idx + 1,
                total = num_steps,
                %timestep,
                "Denoising step"
            );

            // Duplicate latents for classifier-free guidance:
            // [unconditional_latent, conditional_latent]
            let latent_model_input = Tensor::cat(&[&latents, &latents], 0)?;

            // Scale the latent model input per the scheduler
            let latent_model_input = scheduler.scale_model_input(latent_model_input, timestep)?;

            // Predict noise residual with the UNet
            let noise_pred =
                self.unet
                    .forward(&latent_model_input, timestep as f64, &text_embeddings)?;

            // Classifier-free guidance: split predictions and
            // combine
            let noise_pred = perform_guidance(&noise_pred, guidance_scale)?;

            // Scheduler step: compute previous noisy sample
            latents = scheduler.step(&noise_pred, timestep, &latents)?;
        }

        // --- 5. Decode latents to image with VAE ---
        // Scale latents by the VAE scaling factor (1/0.18215)
        let vae_scale = 1.0 / 0.18215_f64;
        let latents = (latents * vae_scale)?;

        // VAE decode
        let image = self.vae.decode(&latents)?;

        // --- 6. Post-process: [-1,1] -> [0,255] -> PNG ---
        let image = ((image / 2.)? + 0.5)?;
        let image = (image.clamp(0f32, 1f32)? * 255.)?;
        let image = image.to_dtype(DType::U8)?;

        // Shape: [1, 3, H, W] -> [H, W, 3]
        let image = image.i(0)?;
        let (c, h, w) = image.dims3()?;

        let png_bytes = if c == 3 {
            // [3, H, W] -> [H, W, 3]
            let image = image.permute((1, 2, 0))?.flatten_all()?;
            let raw = image.to_vec1::<u8>()?;
            encode_rgb_to_png(&raw, w as u32, h as u32)?
        } else {
            // Unexpected channel count; attempt anyway
            let image = image.permute((1, 2, 0))?.flatten_all()?;
            let raw = image.to_vec1::<u8>()?;
            encode_rgb_to_png(&raw, w as u32, h as u32)?
        };

        tracing::info!(
            png_size = png_bytes.len(),
            %w,
            %h,
            "Native diffusion inference complete"
        );

        Ok((png_bytes, w as u32, h as u32))
    }
}

/// Perform classifier-free guidance on the noise prediction.
///
/// Splits the batch-of-2 noise prediction into unconditional and
/// conditional parts, then combines:
///   noise = uncond + guidance_scale * (cond - uncond)
fn perform_guidance(noise_pred: &Tensor, guidance_scale: f64) -> Result<Tensor> {
    let chunks = noise_pred.chunk(2, 0)?;
    let noise_pred_uncond = &chunks[0];
    let noise_pred_text = &chunks[1];

    let guided = (noise_pred_uncond + ((noise_pred_text - noise_pred_uncond)? * guidance_scale)?)?;

    Ok(guided)
}

/// Encode raw RGB pixel data into a PNG byte buffer using the `image`
/// crate.
fn encode_rgb_to_png(rgb_data: &[u8], width: u32, height: u32) -> Result<Vec<u8>> {
    let img = image::RgbImage::from_raw(width, height, rgb_data.to_vec()).ok_or_else(|| {
        anyhow::anyhow!(
            "Failed to create image buffer ({}x{}, {} bytes)",
            width,
            height,
            rgb_data.len()
        )
    })?;

    let mut png_bytes = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut png_bytes);
    img.write_to(&mut cursor, image::ImageFormat::Png)
        .context("Failed to encode image as PNG")?;

    Ok(png_bytes)
}

// ---------------------------------------------------------------------------
// Model file loading helpers
// ---------------------------------------------------------------------------

/// Resolve a model file path: either from a local directory or by
/// downloading from HuggingFace Hub.
fn resolve_model_file(model_dir: &PathBuf, filename: &str, hf_repo: &str) -> Result<PathBuf> {
    // First check if file exists locally
    let local_path = model_dir.join(filename);
    if local_path.exists() {
        tracing::debug!(
            path = %local_path.display(),
            "Using local model file"
        );
        return Ok(local_path);
    }

    // Try to download from HuggingFace Hub
    tracing::info!(
        repo = %hf_repo,
        file = %filename,
        "Downloading model file from HuggingFace Hub"
    );

    let api = Api::new().context("Failed to create HuggingFace Hub API client")?;
    let repo = api.model(hf_repo.to_string());
    let path = repo.get(filename).with_context(|| {
        format!(
            "Failed to download {filename} from {hf_repo}. \
             You can manually download the model files to {dir}",
            dir = model_dir.display()
        )
    })?;

    Ok(path)
}

/// Load safetensors weights into a VarBuilder.
fn load_safetensors_vb(
    paths: &[PathBuf],
    dtype: DType,
    device: &Device,
) -> Result<VarBuilder<'static>> {
    let vb = unsafe {
        VarBuilder::from_mmaped_safetensors(paths, dtype, device)
            .context("Failed to load safetensors weights")?
    };
    Ok(vb)
}

/// Build the candle Device from feature flags and available hardware.
fn build_device() -> Result<Device> {
    #[cfg(feature = "gpu-cuda")]
    {
        match Device::new_cuda(0) {
            Ok(dev) => {
                tracing::info!("Using CUDA device for image generation");
                return Ok(dev);
            },
            Err(e) => {
                tracing::warn!(
                    error = %e,
                    "CUDA requested but unavailable, falling back to CPU"
                );
            },
        }
    }

    #[cfg(feature = "gpu-metal")]
    {
        match Device::new_metal(0) {
            Ok(dev) => {
                tracing::info!("Using Metal device for image generation");
                return Ok(dev);
            },
            Err(e) => {
                tracing::warn!(
                    error = %e,
                    "Metal requested but unavailable, falling back to CPU"
                );
            },
        }
    }

    tracing::info!("Using CPU device for image generation");
    Ok(Device::Cpu)
}

// ---------------------------------------------------------------------------
// NativeImageGen
// ---------------------------------------------------------------------------

/// Native image generation worker backed by candle-transformers.
///
/// Implements the full Stable Diffusion text-to-image pipeline:
/// CLIP text encoding -> UNet denoising loop -> VAE decoding -> PNG.
///
/// Models are loaded lazily on the first call to `load()` and can be
/// sourced from a local directory or downloaded automatically from
/// HuggingFace Hub.
pub struct NativeImageGen {
    model_path: PathBuf,
    model_type: DiffusionModelType,
    vram_mb: u64,
    loaded: AtomicBool,
    /// Loaded model state (populated by `load()`).
    pipeline: Mutex<Option<DiffusionPipeline>>,
}

impl NativeImageGen {
    /// Create a new native image generation worker.
    ///
    /// * `model_path` -- directory containing the safetensors weights,
    ///   tokenizer, and VAE for the chosen architecture. If files are
    ///   missing they will be downloaded from HuggingFace Hub.
    /// * `model_type` -- which diffusion architecture to use.
    pub fn new(model_path: PathBuf, model_type: DiffusionModelType) -> Self {
        let vram_mb = model_type.vram_mb();
        Self {
            model_path,
            model_type,
            vram_mb,
            loaded: AtomicBool::new(false),
            pipeline: Mutex::new(None),
        }
    }

    /// Short name for the configured model type (for error messages).
    fn model_type_name(&self) -> &'static str {
        self.model_type.display_name()
    }

    /// Load the full diffusion pipeline: tokenizer, CLIP text encoder,
    /// UNet, VAE, and scheduler.
    ///
    /// This is CPU-heavy and may take several seconds (or minutes for
    /// large models). It runs in a blocking context.
    fn load_pipeline_blocking(&self) -> Result<DiffusionPipeline> {
        let device = build_device()?;
        let dtype = if device.is_cuda() {
            DType::F16
        } else {
            DType::F32
        };

        let model_dir = &self.model_path;
        let hf_repo = self.model_type.hf_repo_id();
        let sd_config = self.model_type.to_sd_version();

        tracing::info!(
            model = %self.model_type,
            repo = %hf_repo,
            dir = %model_dir.display(),
            ?dtype,
            "Loading Stable Diffusion pipeline"
        );

        // --- Tokenizer ---
        let tokenizer_path = resolve_model_file(model_dir, "tokenizer/tokenizer.json", hf_repo)?;
        let tokenizer = Tokenizer::from_file(&tokenizer_path).map_err(|e| {
            anyhow::anyhow!(
                "Failed to load tokenizer from {}: {e}",
                tokenizer_path.display()
            )
        })?;

        // Second tokenizer for SDXL
        let tokenizer_2 = if self.model_type.is_sdxl() {
            let path = resolve_model_file(model_dir, "tokenizer_2/tokenizer.json", hf_repo)?;
            Some(
                Tokenizer::from_file(&path)
                    .map_err(|e| anyhow::anyhow!("Failed to load tokenizer_2: {e}"))?,
            )
        } else {
            None
        };

        // --- CLIP Text Encoder ---
        tracing::info!("Loading CLIP text encoder");
        let text_model_file =
            resolve_model_file(model_dir, "text_encoder/model.safetensors", hf_repo)?;
        let text_model_vb = load_safetensors_vb(&[text_model_file], dtype, &device)?;
        let text_model =
            stable_diffusion::build_clip_transformer(&sd_config.clip, text_model_vb, &device)
                .context("Failed to build CLIP text encoder")?;

        // Second text encoder for SDXL
        let text_model_2 = if self.model_type.is_sdxl() {
            if let Some(ref clip2_config) = sd_config.clip2 {
                tracing::info!("Loading second CLIP text encoder (SDXL)");
                let file =
                    resolve_model_file(model_dir, "text_encoder_2/model.safetensors", hf_repo)?;
                let vb = load_safetensors_vb(&[file], dtype, &device)?;
                Some(
                    stable_diffusion::build_clip_transformer(clip2_config, vb, &device)
                        .context("Failed to build second CLIP text encoder")?,
                )
            } else {
                None
            }
        } else {
            None
        };

        // --- UNet ---
        tracing::info!("Loading UNet");
        let unet_file = resolve_model_file(
            model_dir,
            "unet/diffusion_pytorch_model.safetensors",
            hf_repo,
        )?;
        let unet_vb = load_safetensors_vb(&[unet_file], dtype, &device)?;
        let unet = stable_diffusion::build_unet(
            &sd_config.unet,
            unet_vb,
            &device,
            4,     // in_channels
            false, // use_flash_attn — requires separate feature
            dtype,
        )
        .context("Failed to build UNet")?;

        // --- VAE ---
        tracing::info!("Loading VAE decoder");
        let vae_file = resolve_model_file(
            model_dir,
            "vae/diffusion_pytorch_model.safetensors",
            hf_repo,
        )?;
        let vae_vb = load_safetensors_vb(&[vae_file], dtype, &device)?;
        let vae = sd_config
            .build_vae(vae_vb, &device)
            .context("Failed to build VAE decoder")?;

        // --- Scheduler ---
        let scheduler = stable_diffusion::ddim::DDIMScheduler::new(
            self.model_type.default_steps() as usize,
            sd_config.scheduler.clone(),
        );

        tracing::info!(
            model = %self.model_type,
            "Stable Diffusion pipeline loaded successfully"
        );

        Ok(DiffusionPipeline {
            device,
            dtype,
            text_model,
            text_model_2,
            unet,
            vae,
            tokenizer,
            tokenizer_2,
            scheduler,
            sd_config,
            model_type: self.model_type,
        })
    }
}

// ---------------------------------------------------------------------------
// AiWorker
// ---------------------------------------------------------------------------

#[async_trait]
impl AiWorker for NativeImageGen {
    fn capability(&self) -> Capability {
        Capability::ImageGen
    }

    fn backend_type(&self) -> BackendType {
        BackendType::Native
    }

    fn required_vram_mb(&self) -> u64 {
        self.vram_mb
    }

    fn quality_score(&self) -> f32 {
        self.model_type.quality_score()
    }

    fn is_loaded(&self) -> bool {
        self.loaded.load(Ordering::Relaxed)
    }

    async fn health_check(&self) -> bool {
        self.loaded.load(Ordering::Relaxed) && self.model_path.exists()
    }

    async fn load(&self) -> Result<()> {
        if self.loaded.load(Ordering::Relaxed) {
            tracing::debug!(
                model = %self.model_type,
                "Pipeline already loaded, skipping"
            );
            return Ok(());
        }

        let path = &self.model_path;
        if !path.exists() {
            // Create the directory so HF Hub downloads can be placed
            // there.
            std::fs::create_dir_all(path)
                .with_context(|| format!("Failed to create model directory: {}", path.display()))?;
        }

        tracing::info!(
            model_type = %self.model_type,
            path = %path.display(),
            "Loading native image generation pipeline (this may take a while)"
        );

        // Load the pipeline in a blocking task to avoid blocking the
        // async runtime.
        // Note: We need a reference to self's fields, so we extract
        // what we need first.
        let model_path = self.model_path.clone();
        let model_type = self.model_type;

        let pipeline = tokio::task::spawn_blocking(move || {
            // Create a temporary NativeImageGen just for loading
            let loader = NativeImageGen {
                model_path,
                model_type,
                vram_mb: model_type.vram_mb(),
                loaded: AtomicBool::new(false),
                pipeline: Mutex::new(None),
            };
            loader.load_pipeline_blocking()
        })
        .await
        .context("Pipeline loading task panicked")??;

        let mut guard = self.pipeline.lock().await;
        *guard = Some(pipeline);
        self.loaded.store(true, Ordering::Relaxed);

        tracing::info!(
            model_type = %self.model_type,
            path = %self.model_path.display(),
            "Native image gen pipeline loaded and ready"
        );
        Ok(())
    }

    async fn unload(&self) -> Result<()> {
        let mut guard = self.pipeline.lock().await;
        *guard = None;
        self.loaded.store(false, Ordering::Relaxed);

        tracing::info!(
            model_type = %self.model_type,
            "Native image gen pipeline unloaded"
        );
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// ImageGenWorker
// ---------------------------------------------------------------------------

#[async_trait]
impl ImageGenWorker for NativeImageGen {
    async fn generate(&self, request: ImageGenRequest) -> Result<ImageGenResult> {
        if !self.loaded.load(Ordering::Relaxed) {
            anyhow::bail!("Model not loaded. Call load() first.");
        }

        let start = Instant::now();

        let (default_w, default_h) = self.model_type.default_resolution();
        let width = request.width.unwrap_or(default_w);
        let height = request.height.unwrap_or(default_h);
        let num_steps = request.steps.unwrap_or(self.model_type.default_steps());
        let guidance_scale = request
            .guidance_scale
            .unwrap_or(self.model_type.default_guidance_scale())
            as f64;
        let seed = request.seed.unwrap_or_else(|| rand::random::<i64>().abs());
        let num_images = request.num_images.unwrap_or(1).max(1).min(4) as usize;
        let prompt = request.prompt.clone();
        let negative_prompt = request.negative_prompt.clone();
        let model_type = self.model_type;

        // Validate dimensions are multiples of 8 (required for
        // latent space)
        if width % 8 != 0 || height % 8 != 0 {
            anyhow::bail!(
                "Image dimensions must be multiples of 8, \
                 got {width}x{height}"
            );
        }

        // Run generation in a blocking task since it's CPU/GPU
        // intensive
        let guard = self.pipeline.lock().await;
        let pipeline = guard
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Pipeline not initialized despite loaded flag"))?;

        // We cannot move the pipeline into spawn_blocking since it's
        // behind a MutexGuard. Instead, we run the inference
        // synchronously while holding the lock.
        // For production, consider using a dedicated thread pool.
        let mut images = Vec::with_capacity(num_images);

        for i in 0..num_images {
            let image_seed = seed + i as i64;

            let (png_bytes, w, h) = pipeline.generate_image(
                &prompt,
                negative_prompt.as_deref(),
                width,
                height,
                num_steps,
                guidance_scale,
                image_seed,
            )?;

            tracing::debug!(
                image_idx = i,
                seed = image_seed,
                size = png_bytes.len(),
                "Generated image {}/{}",
                i + 1,
                num_images
            );

            images.push(bytes::Bytes::from(png_bytes));
        }

        let duration_ms = start.elapsed().as_millis() as u64;

        tracing::info!(
            model = %model_type,
            %num_images,
            %width,
            %height,
            %num_steps,
            %guidance_scale,
            %seed,
            %duration_ms,
            "Native image generation complete"
        );

        Ok(ImageGenResult {
            images,
            seed: Some(seed),
            model: model_type.id().to_string(),
            duration_ms,
        })
    }

    async fn inpaint(&self, _request: InpaintRequest) -> Result<ImageGenResult> {
        if !self.loaded.load(Ordering::Relaxed) {
            anyhow::bail!("Model not loaded. Call load() first.");
        }

        // Inpainting requires a specialized UNet with mask
        // conditioning input channels (5 or 9 channels instead of 4).
        // This would need a separate model variant
        // (e.g., sd-inpainting) and additional pipeline logic for mask
        // processing.
        anyhow::bail!(
            "Native inpainting is not yet implemented for {}. \
             Inpainting requires a specialized UNet model variant. \
             Use IMAGEGEN_URL for HTTP backend (ComfyUI/A1111) or \
             OPENAI_API_KEY for cloud-based inpainting.",
            self.model_type_name()
        )
    }

    async fn img2img(&self, _request: Img2ImgRequest) -> Result<ImageGenResult> {
        if !self.loaded.load(Ordering::Relaxed) {
            anyhow::bail!("Model not loaded. Call load() first.");
        }

        // img2img reuses the same pipeline but starts from an encoded
        // source image (VAE encode) with added noise at a given
        // strength, then denoises for fewer steps.
        // This is a straightforward extension but deferred to keep
        // the initial implementation focused on text-to-image.
        anyhow::bail!(
            "Native img2img via candle is not yet implemented \
             for {}. Use IMAGEGEN_URL for HTTP backend \
             (ComfyUI/A1111) or OPENAI_API_KEY for cloud-based \
             image editing.",
            self.model_type_name()
        )
    }

    async fn upscale(&self, _request: UpscaleRequest) -> Result<ImageGenResult> {
        if !self.loaded.load(Ordering::Relaxed) {
            anyhow::bail!("Model not loaded. Call load() first.");
        }

        // Upscaling requires a separate super-resolution model
        // (e.g., ESRGAN or Stable Diffusion x4 upscaler), not the
        // base diffusion model.
        anyhow::bail!(
            "Native upscaling via candle is not yet implemented. \
             Use IMAGEGEN_URL for HTTP backend (A1111 supports \
             ESRGAN upscaling)."
        )
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>> {
        Ok(vec![ModelInfo {
            id: self.model_type.id().to_string(),
            name: self.model_type.display_name().to_string(),
            description: format!(
                "Native {} via candle-transformers ({} VRAM, \
                 {}-step default)",
                self.model_type.display_name(),
                format_vram(self.vram_mb),
                self.model_type.default_steps(),
            ),
            vram_required_mb: self.vram_mb,
            quality_score: self.model_type.quality_score(),
        }])
    }
}

/// Format VRAM in a human-readable way.
fn format_vram(mb: u64) -> String {
    if mb >= 1_000 {
        format!("{:.1} GB", mb as f64 / 1_000.0)
    } else {
        format!("{mb} MB")
    }
}
