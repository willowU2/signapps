//! Native multimodal embeddings worker using SigLIP via ONNX Runtime.
//!
//! Runs the SigLIP SO400M model locally for both text and image embedding in a
//! shared 1024-dimensional vector space. All code is gated behind the
//! `native-embedmm` feature.

#![allow(dead_code)]

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use anyhow::{Context, Result};
use async_trait::async_trait;
use bytes::Bytes;
use ort::session::Session;
use ort::value::Tensor;
use tracing::debug;

use crate::gateway::{BackendType, Capability};
use crate::workers::{AiWorker, MultimodalEmbedWorker};

// ---------------------------------------------------------------------------
// Image preprocessing constants
// ---------------------------------------------------------------------------

/// SigLIP input image size (384x384).
const SIGLIP_IMAGE_SIZE: u32 = 384;

/// SigLIP normalisation: mean = 0.5 for all channels.
const SIGLIP_MEAN: f32 = 0.5;

/// SigLIP normalisation: std = 0.5 for all channels.
const SIGLIP_STD: f32 = 0.5;

/// Default max token length for SigLIP text encoder.
const SIGLIP_MAX_TEXT_LEN: usize = 64;

// ---------------------------------------------------------------------------
// NativeSigLIP
// ---------------------------------------------------------------------------

/// Native multimodal embeddings worker that runs SigLIP locally via ONNX
/// Runtime for both text and image embedding in a shared vector space.
///
/// Sessions are wrapped in `Arc<Mutex<Session>>` so inference can be
/// offloaded to `tokio::task::spawn_blocking` without blocking the async
/// runtime thread during the 50–500 ms ONNX inference window.
pub struct NativeSigLIP {
    text_session: Arc<Mutex<Session>>,
    vision_session: Arc<Mutex<Session>>,
    tokenizer: tokenizers::Tokenizer,
    dimension: usize,
    loaded: AtomicBool,
}

impl NativeSigLIP {
    /// Create a new native SigLIP multimodal embeddings worker.
    ///
    /// - `text_model_path`   -- path to the ONNX text encoder model.
    /// - `vision_model_path` -- path to the ONNX vision encoder model.
    /// - `tokenizer_path`    -- path to the HuggingFace `tokenizer.json` file.
    /// - `dimension`         -- embedding dimension (1024 for SigLIP SO400M).
    pub fn new(
        text_model_path: impl AsRef<Path>,
        vision_model_path: impl AsRef<Path>,
        tokenizer_path: impl AsRef<Path>,
        dimension: usize,
    ) -> Result<Self> {
        let text_session = Session::builder()
            .context("failed to create ONNX session builder for text encoder")?
            .with_intra_threads(4)
            .context("failed to set intra threads for text encoder")?
            .commit_from_file(text_model_path.as_ref())
            .context("failed to load SigLIP text ONNX model")?;

        let vision_session = Session::builder()
            .context("failed to create ONNX session builder for vision encoder")?
            .with_intra_threads(4)
            .context("failed to set intra threads for vision encoder")?
            .commit_from_file(vision_model_path.as_ref())
            .context("failed to load SigLIP vision ONNX model")?;

        let tokenizer = tokenizers::Tokenizer::from_file(tokenizer_path.as_ref())
            .map_err(|e| anyhow::anyhow!("failed to load SigLIP tokenizer: {e}"))?;

        Ok(Self {
            text_session: Arc::new(Mutex::new(text_session)),
            vision_session: Arc::new(Mutex::new(vision_session)),
            tokenizer,
            dimension,
            loaded: AtomicBool::new(true),
        })
    }

    /// The embedding dimension this worker produces.
    pub fn dimension(&self) -> usize {
        self.dimension
    }
}

// ---------------------------------------------------------------------------
// AiWorker impl
// ---------------------------------------------------------------------------

#[async_trait]
impl AiWorker for NativeSigLIP {
    fn capability(&self) -> Capability {
        Capability::MultimodalEmbed
    }

    fn backend_type(&self) -> BackendType {
        BackendType::Native
    }

    fn required_vram_mb(&self) -> u64 {
        1500
    }

    fn quality_score(&self) -> f32 {
        0.95
    }

    fn is_loaded(&self) -> bool {
        self.loaded.load(Ordering::Relaxed)
    }

    async fn health_check(&self) -> bool {
        self.loaded.load(Ordering::Relaxed)
    }

    async fn load(&self) -> Result<()> {
        self.loaded.store(true, Ordering::Relaxed);
        Ok(())
    }

    async fn unload(&self) -> Result<()> {
        self.loaded.store(false, Ordering::Relaxed);
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// MultimodalEmbedWorker impl
// ---------------------------------------------------------------------------

#[async_trait]
impl MultimodalEmbedWorker for NativeSigLIP {
    async fn embed_text(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>> {
        debug!(num_texts = texts.len(), "native SigLIP embed_text");

        // Pre-tokenize on the async thread (fast, no I/O).
        let mut token_pairs: Vec<(Vec<i64>, Vec<i64>)> = Vec::with_capacity(texts.len());

        for text in &texts {
            let encoding = self
                .tokenizer
                .encode(text.as_str(), true)
                .map_err(|e| anyhow::anyhow!("tokenizer encode failed: {e}"))?;

            let mut input_ids: Vec<i64> = encoding
                .get_ids()
                .iter()
                .take(SIGLIP_MAX_TEXT_LEN)
                .map(|&id| id as i64)
                .collect();

            let mut attention_mask: Vec<i64> = encoding
                .get_attention_mask()
                .iter()
                .take(SIGLIP_MAX_TEXT_LEN)
                .map(|&m| m as i64)
                .collect();

            // Pad to max length.
            while input_ids.len() < SIGLIP_MAX_TEXT_LEN {
                input_ids.push(0);
                attention_mask.push(0);
            }

            token_pairs.push((input_ids, attention_mask));
        }

        // Offload blocking ONNX inference off the tokio runtime thread.
        let session = Arc::clone(&self.text_session);
        let dimension = self.dimension;
        let all_embeddings = tokio::task::spawn_blocking(move || -> Result<Vec<Vec<f32>>> {
            let mut embeddings = Vec::with_capacity(token_pairs.len());

            for (input_ids, attention_mask) in token_pairs {
                let input_ids_tensor =
                    Tensor::from_array((vec![1i64, SIGLIP_MAX_TEXT_LEN as i64], input_ids))
                        .context("failed to create input_ids tensor")?;

                let attention_mask_tensor =
                    Tensor::from_array((vec![1i64, SIGLIP_MAX_TEXT_LEN as i64], attention_mask))
                        .context("failed to create attention_mask tensor")?;

                let mut s = session
                    .lock()
                    .map_err(|e| anyhow::anyhow!("text session lock poisoned: {e}"))?;
                let outputs = s
                    .run(ort::inputs![input_ids_tensor, attention_mask_tensor])
                    .context("SigLIP text encoder inference failed")?;

                let (_shape, data) = outputs[0]
                    .try_extract_tensor::<f32>()
                    .context("failed to extract text embedding tensor")?;

                let mut embedding: Vec<f32> = data.iter().take(dimension).copied().collect();
                l2_normalize(&mut embedding);
                embeddings.push(embedding);
            }

            Ok(embeddings)
        })
        .await
        .map_err(|e| anyhow::anyhow!("spawn_blocking join error: {e}"))??;

        Ok(all_embeddings)
    }

    async fn embed_image(&self, images: Vec<Bytes>) -> Result<Vec<Vec<f32>>> {
        debug!(num_images = images.len(), "native SigLIP embed_image");

        // Preprocess images on the async thread (CPU-bound but short).
        let mut pixel_bufs: Vec<Vec<f32>> = Vec::with_capacity(images.len());
        for image_bytes in &images {
            let pixels =
                preprocess_image(image_bytes).context("failed to preprocess image for SigLIP")?;
            pixel_bufs.push(pixels);
        }

        // Offload blocking ONNX inference off the tokio runtime thread.
        let session = Arc::clone(&self.vision_session);
        let dimension = self.dimension;
        let all_embeddings = tokio::task::spawn_blocking(move || -> Result<Vec<Vec<f32>>> {
            let mut embeddings = Vec::with_capacity(pixel_bufs.len());

            for pixels in pixel_bufs {
                let pixel_values = Tensor::from_array((
                    vec![1i64, 3, SIGLIP_IMAGE_SIZE as i64, SIGLIP_IMAGE_SIZE as i64],
                    pixels,
                ))
                .context("failed to create pixel_values tensor")?;

                let mut s = session
                    .lock()
                    .map_err(|e| anyhow::anyhow!("vision session lock poisoned: {e}"))?;
                let outputs = s
                    .run(ort::inputs![pixel_values])
                    .context("SigLIP vision encoder inference failed")?;

                let (_shape, data) = outputs[0]
                    .try_extract_tensor::<f32>()
                    .context("failed to extract image embedding tensor")?;

                let mut embedding: Vec<f32> = data.iter().take(dimension).copied().collect();
                l2_normalize(&mut embedding);
                embeddings.push(embedding);
            }

            Ok(embeddings)
        })
        .await
        .map_err(|e| anyhow::anyhow!("spawn_blocking join error: {e}"))??;

        Ok(all_embeddings)
    }

    async fn embed_audio(&self, _audio: Vec<Bytes>) -> Result<Vec<Vec<f32>>> {
        anyhow::bail!(
            "SigLIP does not support audio embeddings. \
             Use a dedicated audio model."
        )
    }
}

// ---------------------------------------------------------------------------
// Image preprocessing helpers
// ---------------------------------------------------------------------------

/// Preprocess raw image bytes into a CHW float tensor normalised for SigLIP.
///
/// The output is a flat `Vec<f32>` of shape `[3, 384, 384]` (channels-first)
/// with pixel values normalised to `(val / 255 - 0.5) / 0.5`.
fn preprocess_image(image_bytes: &[u8]) -> Result<Vec<f32>> {
    let img = image::load_from_memory(image_bytes).context("failed to decode image from bytes")?;
    let img = img.resize_exact(
        SIGLIP_IMAGE_SIZE,
        SIGLIP_IMAGE_SIZE,
        image::imageops::FilterType::Triangle,
    );
    let img = img.to_rgb8();

    let mut pixels =
        Vec::with_capacity(3 * SIGLIP_IMAGE_SIZE as usize * SIGLIP_IMAGE_SIZE as usize);

    // CHW layout: iterate channels first, then height, then width.
    for c in 0..3u8 {
        for y in 0..SIGLIP_IMAGE_SIZE {
            for x in 0..SIGLIP_IMAGE_SIZE {
                let pixel = img.get_pixel(x, y);
                let val = pixel[c as usize] as f32 / 255.0;
                let normalized = (val - SIGLIP_MEAN) / SIGLIP_STD;
                pixels.push(normalized);
            }
        }
    }

    Ok(pixels)
}

/// L2-normalise a vector in place.
fn l2_normalize(v: &mut Vec<f32>) {
    let norm: f32 = v.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for x in v.iter_mut() {
            *x /= norm;
        }
    }
}
