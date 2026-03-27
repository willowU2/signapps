//! Native image generation worker using candle-transformers for
//! Stable Diffusion / FLUX inference.
//!
//! This is a **skeleton** that establishes the module structure, interface
//! contract, and model-type configuration. The full diffusion pipeline
//! (CLIP encoder, UNet scheduler, VAE decoder, latent-space operations) is
//! ~500 lines of code and is deferred to a dedicated project phase once the
//! architecture is validated.
#![allow(dead_code)]

use std::fmt;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};

use anyhow::Result;
use async_trait::async_trait;

use crate::gateway::{BackendType, Capability};
use crate::workers::{
    AiWorker, ImageGenRequest, ImageGenResult, ImageGenWorker, Img2ImgRequest, InpaintRequest,
    ModelInfo, UpscaleRequest,
};

// ---------------------------------------------------------------------------
// Model type
// ---------------------------------------------------------------------------

/// Supported diffusion model architectures.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiffusionModelType {
    /// Stable Diffusion 1.5 (~2 GB VRAM)
    StableDiffusion15,
    /// Stable Diffusion XL (~8 GB VRAM)
    StableDiffusionXL,
    /// FLUX.1-schnell — fast, distilled (~24 GB VRAM)
    Flux1Schnell,
    /// FLUX.1-dev — high-quality guidance-distilled (~24 GB VRAM)
    Flux1Dev,
}

impl DiffusionModelType {
    /// Approximate VRAM requirement in megabytes.
    fn vram_mb(&self) -> u64 {
        match self {
            DiffusionModelType::StableDiffusion15 => 2_000,
            DiffusionModelType::StableDiffusionXL => 8_000,
            DiffusionModelType::Flux1Schnell => 24_000,
            DiffusionModelType::Flux1Dev => 24_000,
        }
    }

    /// Quality score (0.0 .. 1.0) reflecting typical output fidelity.
    fn quality_score(&self) -> f32 {
        match self {
            DiffusionModelType::StableDiffusion15 => 0.60,
            DiffusionModelType::StableDiffusionXL => 0.80,
            DiffusionModelType::Flux1Schnell => 0.85,
            DiffusionModelType::Flux1Dev => 0.95,
        }
    }

    /// Short identifier used in model listings and error messages.
    fn id(&self) -> &'static str {
        match self {
            DiffusionModelType::StableDiffusion15 => "sd-1.5",
            DiffusionModelType::StableDiffusionXL => "sdxl",
            DiffusionModelType::Flux1Schnell => "flux.1-schnell",
            DiffusionModelType::Flux1Dev => "flux.1-dev",
        }
    }

    /// Human-readable display name.
    fn display_name(&self) -> &'static str {
        match self {
            DiffusionModelType::StableDiffusion15 => "Stable Diffusion 1.5",
            DiffusionModelType::StableDiffusionXL => "Stable Diffusion XL",
            DiffusionModelType::Flux1Schnell => "FLUX.1-schnell",
            DiffusionModelType::Flux1Dev => "FLUX.1-dev",
        }
    }
}

impl fmt::Display for DiffusionModelType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.display_name())
    }
}

// ---------------------------------------------------------------------------
// NativeImageGen
// ---------------------------------------------------------------------------

/// Native image generation worker backed by candle-transformers.
///
/// Currently a skeleton: calling `generate()` will return an informative
/// error directing users to download model files or use an HTTP/Cloud
/// backend. The full diffusion pipeline will be implemented in a future
/// phase.
pub struct NativeImageGen {
    model_path: PathBuf,
    model_type: DiffusionModelType,
    vram_mb: u64,
    loaded: AtomicBool,
}

impl NativeImageGen {
    /// Create a new native image generation worker.
    ///
    /// * `model_path` — directory containing the safetensors weights,
    ///   tokenizer, and VAE for the chosen architecture.
    /// * `model_type` — which diffusion architecture to use.
    pub fn new(model_path: PathBuf, model_type: DiffusionModelType) -> Self {
        let vram_mb = model_type.vram_mb();
        Self {
            model_path,
            model_type,
            vram_mb,
            loaded: AtomicBool::new(false),
        }
    }

    /// Short name for the configured model type (for error messages).
    fn model_type_name(&self) -> &'static str {
        self.model_type.display_name()
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
        // Verify model files exist at model_path.
        // For SD: check for model.safetensors, vae.safetensors, tokenizer.json, etc.
        // Don't actually load into VRAM yet — that happens on first generate().
        let path = &self.model_path;
        if !path.exists() {
            anyhow::bail!("Model path {:?} does not exist", path);
        }

        self.loaded.store(true, Ordering::Relaxed);
        tracing::info!(
            model_type = %self.model_type,
            path = %path.display(),
            "Native image gen model marked as available"
        );
        Ok(())
    }

    async fn unload(&self) -> Result<()> {
        self.loaded.store(false, Ordering::Relaxed);
        tracing::info!(
            model_type = %self.model_type,
            "Native image gen model unloaded"
        );
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// ImageGenWorker
// ---------------------------------------------------------------------------

#[async_trait]
impl ImageGenWorker for NativeImageGen {
    async fn generate(&self, _request: ImageGenRequest) -> Result<ImageGenResult> {
        if !self.loaded.load(Ordering::Relaxed) {
            anyhow::bail!("Model not loaded. Call load() first.");
        }

        // TODO: Full diffusion pipeline implementation
        // This requires:
        // 1. Load CLIP text encoder -> encode prompt
        // 2. Initialize latent noise (from seed)
        // 3. Run UNet denoising loop (num_steps iterations)
        // 4. Decode latents with VAE
        // 5. Convert to image bytes
        //
        // For now, return an error indicating native gen is available
        // but the full pipeline needs the model files downloaded.

        anyhow::bail!(
            "Native image generation via candle is configured but the full diffusion \
             pipeline is not yet implemented. Download {} model files to {:?} first. \
             Use IMAGEGEN_URL for HTTP backend (ComfyUI/A1111) or OPENAI_API_KEY for \
             DALL-E.",
            self.model_type_name(),
            self.model_path
        )
    }

    async fn inpaint(&self, _request: InpaintRequest) -> Result<ImageGenResult> {
        if !self.loaded.load(Ordering::Relaxed) {
            anyhow::bail!("Model not loaded. Call load() first.");
        }

        anyhow::bail!(
            "Native inpainting via candle is not yet implemented for {}. \
             Use IMAGEGEN_URL for HTTP backend (ComfyUI/A1111) or OPENAI_API_KEY \
             for cloud-based inpainting.",
            self.model_type_name()
        )
    }

    async fn img2img(&self, _request: Img2ImgRequest) -> Result<ImageGenResult> {
        if !self.loaded.load(Ordering::Relaxed) {
            anyhow::bail!("Model not loaded. Call load() first.");
        }

        anyhow::bail!(
            "Native img2img via candle is not yet implemented for {}. \
             Use IMAGEGEN_URL for HTTP backend (ComfyUI/A1111) or OPENAI_API_KEY \
             for cloud-based image editing.",
            self.model_type_name()
        )
    }

    async fn upscale(&self, _request: UpscaleRequest) -> Result<ImageGenResult> {
        if !self.loaded.load(Ordering::Relaxed) {
            anyhow::bail!("Model not loaded. Call load() first.");
        }

        anyhow::bail!(
            "Native upscaling via candle is not yet implemented. \
             Use IMAGEGEN_URL for HTTP backend (A1111 supports ESRGAN upscaling)."
        )
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>> {
        Ok(vec![ModelInfo {
            id: self.model_type.id().to_string(),
            name: self.model_type.display_name().to_string(),
            description: format!(
                "Native {} via candle-transformers (requires ~{} MB VRAM)",
                self.model_type.display_name(),
                self.vram_mb
            ),
            vram_required_mb: self.vram_mb,
            quality_score: self.model_type.quality_score(),
        }])
    }
}
