//! Native vision worker skeleton using llama-cpp-2 for multimodal GGUF models.
//!
//! This module is only compiled when the `native-vision` feature is enabled.
//! It provides a skeleton for running multimodal GGUF models (LLaVA, BakLLaVA,
//! InternVL2) locally via llama.cpp.
//!
//! # Current status
//!
//! Full native multimodal inference requires the CLIP encoder integration
//! (image preprocessing -> CLIP embeddings -> LLM token injection) which
//! depends on the `llama-cpp-2` crate's multimodal API maturity.  For now,
//! this worker stores the model configuration and returns an informative
//! message directing users to use the HTTP or Cloud backends for production
//! vision workloads.
#![allow(dead_code)]

use std::sync::atomic::{AtomicBool, Ordering};

use anyhow::Result;
use async_trait::async_trait;
use bytes::Bytes;
use tracing::{debug, warn};

use crate::gateway::{BackendType, Capability};
use crate::workers::{AiWorker, VisionResult, VisionWorker};

// ---------------------------------------------------------------------------
// NativeVision
// ---------------------------------------------------------------------------

/// Vision worker that wraps a multimodal GGUF model (LLaVA, BakLLaVA,
/// InternVL2) via llama.cpp for local image understanding.
///
/// **Note:** This is currently a skeleton.  Full multimodal inference
/// (CLIP encoder + LLM token injection) requires deeper integration with
/// the `llama-cpp-2` crate's evolving multimodal API.  The worker validates
/// configuration and returns descriptive status messages; use
/// [`super::HttpVision`] or [`super::CloudVision`] for production vision
/// tasks until the native pipeline is complete.
pub struct NativeVision {
    /// Filesystem path to the multimodal GGUF model file.
    model_path: String,
    /// Context window size in tokens.
    context_size: u32,
    /// Number of layers to offload to GPU (-1 = all).
    gpu_layers: i32,
    /// Whether the model has been "loaded" (configuration validated).
    loaded: AtomicBool,
}

impl NativeVision {
    /// Create a new native vision worker.
    ///
    /// - `model_path` — path to a multimodal GGUF model (e.g.
    ///   `data/models/vision/llava-v1.6.Q4_K_M.gguf`).
    /// - `context_size` — context window in tokens (e.g. 4096).
    /// - `gpu_layers` — number of layers to offload to GPU (-1 for all).
    pub fn new(model_path: &str, context_size: u32, gpu_layers: i32) -> Self {
        Self {
            model_path: model_path.to_string(),
            context_size,
            gpu_layers,
            loaded: AtomicBool::new(false),
        }
    }

    /// Return a formatted model identifier derived from the model path.
    fn model_id(&self) -> String {
        std::path::Path::new(&self.model_path)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "native-vision".to_string())
    }

    /// Build the beta-notice message returned by `describe` and `vqa`.
    fn beta_notice(&self) -> String {
        format!(
            "Native multimodal vision (model: {}) is in beta. \
             Full CLIP+LLM pipeline integration is pending llama-cpp-2 \
             multimodal API stabilization. For production vision, use \
             VISION_URL (HTTP backend) or OPENAI_API_KEY (cloud backend).",
            self.model_id(),
        )
    }
}

// ---------------------------------------------------------------------------
// AiWorker
// ---------------------------------------------------------------------------

#[async_trait]
impl AiWorker for NativeVision {
    fn capability(&self) -> Capability {
        Capability::Vision
    }

    fn backend_type(&self) -> BackendType {
        BackendType::Native
    }

    fn required_vram_mb(&self) -> u64 {
        // InternVL2 / LLaVA 13B-class models typically need ~22 GB VRAM
        // when fully offloaded.
        22_000
    }

    fn quality_score(&self) -> f32 {
        0.85
    }

    fn is_loaded(&self) -> bool {
        self.loaded.load(Ordering::Relaxed)
    }

    async fn health_check(&self) -> bool {
        // Verify the model file exists on disk.
        std::path::Path::new(&self.model_path).exists()
    }

    async fn load(&self) -> Result<()> {
        debug!(
            model_path = %self.model_path,
            context_size = self.context_size,
            gpu_layers = self.gpu_layers,
            "loading native vision model (skeleton — no inference yet)"
        );

        // Validate the model file is reachable.
        if !std::path::Path::new(&self.model_path).exists() {
            anyhow::bail!("native vision model file not found: {}", self.model_path);
        }

        // TODO: When llama-cpp-2 exposes a stable multimodal API, load
        //       the CLIP encoder and LLM model here.
        //
        //   let params = LlamaParams::default()
        //       .with_n_ctx(self.context_size)
        //       .with_n_gpu_layers(self.gpu_layers);
        //   let model = LlamaModel::load_from_file(&self.model_path, params)?;

        warn!(
            model = %self.model_id(),
            "native vision skeleton loaded — real multimodal inference \
             requires CLIP+LLM integration (future work)"
        );

        self.loaded.store(true, Ordering::Relaxed);
        Ok(())
    }

    async fn unload(&self) -> Result<()> {
        debug!(model = %self.model_id(), "unloading native vision model");
        self.loaded.store(false, Ordering::Relaxed);
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// VisionWorker
// ---------------------------------------------------------------------------

#[async_trait]
impl VisionWorker for NativeVision {
    async fn describe(&self, image: Bytes, prompt: Option<&str>) -> Result<VisionResult> {
        let prompt_text = prompt.unwrap_or("Describe this image in detail.");

        debug!(
            model = %self.model_id(),
            image_bytes = image.len(),
            prompt_len = prompt_text.len(),
            "native vision describe (skeleton)"
        );

        // TODO: Full implementation outline:
        //   1. Decode image bytes → raw pixels
        //   2. Run CLIP encoder to produce image embeddings
        //   3. Inject image embeddings as special tokens into the prompt
        //   4. Run LLM inference to generate the description
        //
        // For now, return the beta notice so callers know the backend
        // is not yet producing real descriptions.

        Ok(VisionResult {
            text: self.beta_notice(),
            confidence: 0.0,
            model: self.model_id(),
        })
    }

    async fn vqa(&self, image: Bytes, question: &str) -> Result<VisionResult> {
        debug!(
            model = %self.model_id(),
            image_bytes = image.len(),
            question_len = question.len(),
            "native vision VQA (skeleton)"
        );

        // TODO: Same multimodal pipeline as describe(), but with the
        // user's question as the text prompt.

        Ok(VisionResult {
            text: self.beta_notice(),
            confidence: 0.0,
            model: self.model_id(),
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
