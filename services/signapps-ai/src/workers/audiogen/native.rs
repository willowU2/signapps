//! Native audio generation worker skeleton using candle for MusicGen inference.
//!
//! This module is only compiled when the `native-audiogen` feature is enabled.
//! It provides a skeleton for running MusicGen-Large locally via candle.
//!
//! # Current status
//!
//! Full native audio generation requires the MusicGen model weights and
//! a complete EnCodec + transformer pipeline, which is still under
//! development.  For now, this worker stores the model configuration and
//! returns an informative message directing users to use the HTTP or Cloud
//! backends for production audio generation workloads.
#![allow(dead_code)]

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};

use anyhow::Result;
use async_trait::async_trait;
use tracing::{debug, warn};

use crate::gateway::{BackendType, Capability};
use crate::workers::{
    AiWorker, AudioGenResult, AudioGenWorker, ModelInfo, MusicGenRequest, SfxGenRequest,
};

// ---------------------------------------------------------------------------
// NativeAudioGen
// ---------------------------------------------------------------------------

/// Audio generation worker that wraps a MusicGen-Large model via candle
/// for local music and sound-effect generation.
///
/// **Note:** This is currently a skeleton.  Full audio generation
/// (T5 text encoder + transformer decoder + EnCodec) requires deeper
/// integration with candle-transformers.  The worker validates
/// configuration and returns descriptive status messages; use
/// [`super::HttpAudioGen`] or [`super::CloudAudioGen`] for production
/// audio generation tasks until the native pipeline is complete.
pub struct NativeAudioGen {
    /// Filesystem path to the MusicGen model directory.
    model_path: PathBuf,
    /// Approximate VRAM needed (MusicGen-Large ≈ 14 GB).
    vram_mb: u64,
    /// Whether the model has been "loaded" (configuration validated).
    loaded: AtomicBool,
}

impl NativeAudioGen {
    /// Create a new native audio generation worker.
    ///
    /// - `model_path` — path to a MusicGen model directory (e.g.
    ///   `data/models/audiogen/musicgen-large/`).
    pub fn new(model_path: PathBuf) -> Self {
        Self {
            model_path,
            vram_mb: 14_000,
            loaded: AtomicBool::new(false),
        }
    }

    /// Return a formatted model identifier derived from the model path.
    fn model_id(&self) -> String {
        self.model_path
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "musicgen-large".to_string())
    }

    /// Build the beta-notice message returned by generation methods.
    fn beta_notice(&self) -> String {
        format!(
            "Native audio generation (model: {}) is in beta. \
             Full MusicGen transformer + EnCodec pipeline is pending \
             candle-transformers integration. For production audio \
             generation, use AUDIOGEN_URL (HTTP backend) or \
             REPLICATE_API_TOKEN (cloud backend).",
            self.model_id(),
        )
    }
}

// ---------------------------------------------------------------------------
// AiWorker
// ---------------------------------------------------------------------------

#[async_trait]
impl AiWorker for NativeAudioGen {
    fn capability(&self) -> Capability {
        Capability::AudioGen
    }

    fn backend_type(&self) -> BackendType {
        BackendType::Native
    }

    fn required_vram_mb(&self) -> u64 {
        self.vram_mb
    }

    fn quality_score(&self) -> f32 {
        0.80
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
            "loading native audio generation model (skeleton — no inference yet)"
        );

        if !self.model_path.exists() {
            anyhow::bail!(
                "native audiogen model path not found: {}",
                self.model_path.display()
            );
        }

        // TODO: When candle-transformers MusicGen support is complete:
        //   1. Load the T5 text encoder
        //   2. Load the transformer decoder
        //   3. Load the EnCodec audio codec
        //   4. Verify sample rate and audio output configuration

        warn!(
            model = %self.model_id(),
            "native audiogen skeleton loaded — real MusicGen inference \
             requires candle-transformers + EnCodec integration (future work)"
        );

        self.loaded.store(true, Ordering::Relaxed);
        Ok(())
    }

    async fn unload(&self) -> Result<()> {
        debug!(model = %self.model_id(), "unloading native audio generation model");
        self.loaded.store(false, Ordering::Relaxed);
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// AudioGenWorker
// ---------------------------------------------------------------------------

#[async_trait]
impl AudioGenWorker for NativeAudioGen {
    async fn generate_music(&self, request: MusicGenRequest) -> Result<AudioGenResult> {
        debug!(
            model = %self.model_id(),
            prompt_len = request.prompt.len(),
            duration_secs = ?request.duration_secs,
            temperature = ?request.temperature,
            "native generate_music (skeleton)"
        );

        // TODO: Full implementation outline:
        //   1. Encode text prompt via T5 text encoder
        //   2. Run transformer decoder auto-regressively to produce
        //      EnCodec audio tokens
        //   3. Decode audio tokens via EnCodec decoder to PCM
        //   4. Encode PCM to WAV/MP3
        //
        // For now, return the beta notice so callers know the backend
        // is not yet producing real audio.

        anyhow::bail!(self.beta_notice())
    }

    async fn generate_sfx(&self, request: SfxGenRequest) -> Result<AudioGenResult> {
        debug!(
            model = %self.model_id(),
            prompt_len = request.prompt.len(),
            duration_secs = ?request.duration_secs,
            "native generate_sfx (skeleton)"
        );

        // TODO: Full implementation outline:
        //   1. Encode SFX prompt via T5 text encoder
        //   2. Run transformer decoder for short-form audio generation
        //   3. Decode via EnCodec and encode to output format

        anyhow::bail!(self.beta_notice())
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>> {
        Ok(vec![ModelInfo {
            id: "musicgen-large".to_string(),
            name: "MusicGen-Large".to_string(),
            description: "MusicGen large 3.3B parameter text-to-music/SFX \
                          generation model (native candle skeleton)"
                .to_string(),
            vram_required_mb: self.vram_mb,
            quality_score: 0.80,
        }])
    }
}
