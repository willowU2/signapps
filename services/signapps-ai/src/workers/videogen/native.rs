//! Native video generation worker skeleton using candle for CogVideoX-style
//! inference and ffmpeg for frame assembly.
//!
//! This module is only compiled when the `native-videogen` feature is enabled.
//! It provides a skeleton for running CogVideoX-5B locally via candle.
//!
//! # Current status
//!
//! Full native video generation requires the CogVideoX model weights and
//! a complete diffusion + frame-assembly pipeline, which is still under
//! development.  For now, this worker stores the model configuration and
//! returns an informative message directing users to use the HTTP or Cloud
//! backends for production video generation workloads.
#![allow(dead_code)]

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};

use anyhow::Result;
use async_trait::async_trait;
use tracing::{debug, warn};

use crate::gateway::{BackendType, Capability};
use crate::workers::{
    AiWorker, ImgToVideoRequest, ModelInfo, VideoGenRequest, VideoGenResult, VideoGenWorker,
};

// ---------------------------------------------------------------------------
// NativeVideoGen
// ---------------------------------------------------------------------------

/// Video generation worker that wraps a CogVideoX-5B model via candle
/// for local text-to-video and image-to-video inference.
///
/// **Note:** This is currently a skeleton.  Full video generation
/// (3D-VAE + diffusion transformer + ffmpeg frame assembly) requires
/// deeper integration with candle-transformers and ffmpeg-next.  The
/// worker validates configuration and returns descriptive status messages;
/// use [`super::HttpVideoGen`] or [`super::CloudVideoGen`] for production
/// video generation tasks until the native pipeline is complete.
pub struct NativeVideoGen {
    /// Filesystem path to the CogVideoX model directory.
    model_path: PathBuf,
    /// Approximate VRAM needed (CogVideoX-5B ≈ 18 GB).
    vram_mb: u64,
    /// Whether the model has been "loaded" (configuration validated).
    loaded: AtomicBool,
}

impl NativeVideoGen {
    /// Create a new native video generation worker.
    ///
    /// - `model_path` — path to a CogVideoX model directory (e.g.
    ///   `data/models/videogen/cogvideox-5b/`).
    pub fn new(model_path: PathBuf) -> Self {
        Self {
            model_path,
            vram_mb: 18_000,
            loaded: AtomicBool::new(false),
        }
    }

    /// Return a formatted model identifier derived from the model path.
    fn model_id(&self) -> String {
        self.model_path
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "cogvideox-5b".to_string())
    }

    /// Build the beta-notice message returned by generation methods.
    fn beta_notice(&self) -> String {
        format!(
            "Native video generation (model: {}) is in beta. \
             Full CogVideoX diffusion + ffmpeg frame assembly pipeline \
             is pending candle-transformers integration. For production \
             video generation, use VIDEOGEN_URL (HTTP backend) or \
             REPLICATE_API_TOKEN (cloud backend).",
            self.model_id(),
        )
    }
}

// ---------------------------------------------------------------------------
// AiWorker
// ---------------------------------------------------------------------------

#[async_trait]
impl AiWorker for NativeVideoGen {
    fn capability(&self) -> Capability {
        Capability::VideoGen
    }

    fn backend_type(&self) -> BackendType {
        BackendType::Native
    }

    fn required_vram_mb(&self) -> u64 {
        self.vram_mb
    }

    fn quality_score(&self) -> f32 {
        0.65
    }

    fn is_loaded(&self) -> bool {
        self.loaded.load(Ordering::Relaxed)
    }

    async fn health_check(&self) -> bool {
        self.model_path.exists()
    }

    async fn load(&self) -> Result<()> {
        debug!(
            model_path = %self.model_path.display(),
            vram_mb = self.vram_mb,
            "loading native video generation model (skeleton — no inference yet)"
        );

        if !self.model_path.exists() {
            anyhow::bail!(
                "native videogen model path not found: {}",
                self.model_path.display()
            );
        }

        // TODO: When candle-transformers CogVideoX support is complete:
        //   1. Load the 3D-VAE encoder/decoder
        //   2. Load the diffusion transformer
        //   3. Initialize the DDIM/DDPM scheduler
        //   4. Verify ffmpeg availability for frame assembly

        warn!(
            model = %self.model_id(),
            "native videogen skeleton loaded — real CogVideoX inference \
             requires candle-transformers + ffmpeg integration (future work)"
        );

        self.loaded.store(true, Ordering::Relaxed);
        Ok(())
    }

    async fn unload(&self) -> Result<()> {
        debug!(model = %self.model_id(), "unloading native video generation model");
        self.loaded.store(false, Ordering::Relaxed);
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// VideoGenWorker
// ---------------------------------------------------------------------------

#[async_trait]
impl VideoGenWorker for NativeVideoGen {
    async fn text_to_video(&self, request: VideoGenRequest) -> Result<VideoGenResult> {
        debug!(
            model = %self.model_id(),
            prompt_len = request.prompt.len(),
            width = ?request.width,
            height = ?request.height,
            duration_secs = ?request.duration_secs,
            "native text_to_video (skeleton)"
        );

        // TODO: Full implementation outline:
        //   1. Encode text prompt via T5 encoder
        //   2. Run diffusion transformer for N steps to produce latent frames
        //   3. Decode latent frames via 3D-VAE decoder
        //   4. Assemble frames into video via ffmpeg
        //
        // For now, return the beta notice so callers know the backend
        // is not yet producing real videos.

        anyhow::bail!(self.beta_notice())
    }

    async fn img_to_video(&self, request: ImgToVideoRequest) -> Result<VideoGenResult> {
        debug!(
            model = %self.model_id(),
            image_bytes = request.image.len(),
            prompt = ?request.prompt,
            duration_secs = ?request.duration_secs,
            "native img_to_video (skeleton)"
        );

        // TODO: Full implementation outline:
        //   1. Encode input image via 3D-VAE encoder
        //   2. Optionally encode text prompt via T5
        //   3. Run diffusion transformer conditioned on image latents
        //   4. Decode and assemble frames via ffmpeg

        anyhow::bail!(self.beta_notice())
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>> {
        Ok(vec![ModelInfo {
            id: "cogvideox-5b".to_string(),
            name: "CogVideoX-5B".to_string(),
            description: "CogVideoX 5-billion parameter text/image-to-video \
                          diffusion model (native candle skeleton)"
                .to_string(),
            vram_required_mb: self.vram_mb,
            quality_score: 0.65,
        }])
    }
}
