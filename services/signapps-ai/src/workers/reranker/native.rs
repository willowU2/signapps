//! Native reranker using ONNX Runtime with a bge-reranker cross-encoder model.
//!
//! This module is only compiled when the `native-reranker` feature is enabled.
//! It loads a bge-reranker ONNX model and tokenizer, then runs cross-encoder
//! inference to score query-document pairs.
#![allow(dead_code)]

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use anyhow::{Context, Result};
use async_trait::async_trait;
use ort::session::Session;
use ort::value::Tensor;
use tokenizers::Tokenizer;
use tracing::debug;

use crate::gateway::{BackendType, Capability};
use crate::workers::{AiWorker, RerankResult, RerankerWorker};

// ---------------------------------------------------------------------------
// NativeReranker
// ---------------------------------------------------------------------------

/// Reranker worker that runs a bge-reranker ONNX model locally via ONNX
/// Runtime for cross-encoder document scoring.
///
/// The ONNX session is wrapped in `Arc<Mutex<Session>>` so inference can be
/// offloaded to a `tokio::task::spawn_blocking` closure without blocking the
/// async runtime thread.
pub struct NativeReranker {
    session: Arc<Mutex<Session>>,
    tokenizer: Tokenizer,
    model_id: String,
    loaded: AtomicBool,
}

impl NativeReranker {
    /// Create a new native ONNX reranker.
    ///
    /// - `model_path` — path to the `.onnx` model file (e.g.
    ///   `data/models/reranker/model.onnx`).
    /// - `tokenizer_path` — path to the `tokenizer.json` file for the same
    ///   model.
    ///
    /// Both files are expected to be pre-downloaded by `ModelManager`.
    pub fn new(model_path: &str, tokenizer_path: &str) -> Result<Self> {
        let session = Session::builder()
            .context("failed to create ONNX session builder")?
            .commit_from_file(model_path)
            .with_context(|| format!("failed to load ONNX model from {model_path}"))?;

        let tokenizer = Tokenizer::from_file(tokenizer_path)
            .map_err(|e| anyhow::anyhow!("failed to load tokenizer from {tokenizer_path}: {e}"))?;

        let model_id = model_path
            .rsplit(['/', '\\'])
            .nth(1)
            .unwrap_or("bge-reranker")
            .to_string();

        Ok(Self {
            session: Arc::new(Mutex::new(session)),
            tokenizer,
            model_id,
            loaded: AtomicBool::new(true),
        })
    }
}

#[async_trait]
impl AiWorker for NativeReranker {
    fn capability(&self) -> Capability {
        Capability::Rerank
    }

    fn backend_type(&self) -> BackendType {
        BackendType::Native
    }

    fn required_vram_mb(&self) -> u64 {
        400
    }

    fn quality_score(&self) -> f32 {
        0.90
    }

    fn is_loaded(&self) -> bool {
        self.loaded.load(Ordering::Relaxed)
    }

    async fn health_check(&self) -> bool {
        self.loaded.load(Ordering::Relaxed)
    }

    async fn load(&self) -> Result<()> {
        // Model is loaded at construction time for ONNX sessions.
        self.loaded.store(true, Ordering::Relaxed);
        Ok(())
    }

    async fn unload(&self) -> Result<()> {
        self.loaded.store(false, Ordering::Relaxed);
        Ok(())
    }
}

#[async_trait]
impl RerankerWorker for NativeReranker {
    async fn rerank(
        &self,
        query: &str,
        documents: Vec<String>,
        top_k: Option<usize>,
    ) -> Result<Vec<RerankResult>> {
        debug!(
            model = %self.model_id,
            num_docs = documents.len(),
            top_k = ?top_k,
            "native ONNX rerank request"
        );

        // Pre-tokenize all pairs on the async thread (fast, no I/O).
        let mut pairs: Vec<(usize, String, Vec<i64>, Vec<i64>, Vec<i64>)> =
            Vec::with_capacity(documents.len());

        for (idx, doc) in documents.iter().enumerate() {
            let encoding = self
                .tokenizer
                .encode((query, doc.as_str()), true)
                .map_err(|e| anyhow::anyhow!("tokenizer error: {e}"))?;

            let input_ids: Vec<i64> = encoding.get_ids().iter().map(|&id| id as i64).collect();
            let attention_mask: Vec<i64> = encoding
                .get_attention_mask()
                .iter()
                .map(|&m| m as i64)
                .collect();
            let token_type_ids: Vec<i64> =
                encoding.get_type_ids().iter().map(|&t| t as i64).collect();

            pairs.push((idx, doc.clone(), input_ids, attention_mask, token_type_ids));
        }

        // Run ONNX inference in a blocking thread pool so the tokio runtime is
        // not stalled during the 50–500 ms inference window.
        let session = Arc::clone(&self.session);
        let scored = tokio::task::spawn_blocking(move || -> Result<Vec<(usize, f32, String)>> {
            let mut scored: Vec<(usize, f32, String)> = Vec::with_capacity(pairs.len());

            for (idx, doc, input_ids, attention_mask, token_type_ids) in pairs {
                let seq_len = input_ids.len();

                // Build ONNX input tensors — shape [1, seq_len] for a single pair.
                let input_ids_tensor = Tensor::from_array((vec![1i64, seq_len as i64], input_ids))
                    .context("failed to create input_ids tensor")?;
                let attention_mask_tensor =
                    Tensor::from_array((vec![1i64, seq_len as i64], attention_mask))
                        .context("failed to create attention_mask tensor")?;
                let token_type_ids_tensor =
                    Tensor::from_array((vec![1i64, seq_len as i64], token_type_ids))
                        .context("failed to create token_type_ids tensor")?;

                // Acquire the mutex inside the blocking thread — blocking here is fine.
                let mut s = session
                    .lock()
                    .map_err(|e| anyhow::anyhow!("session lock poisoned: {e}"))?;
                let outputs = s.run(ort::inputs![
                    "input_ids" => input_ids_tensor,
                    "attention_mask" => attention_mask_tensor,
                    "token_type_ids" => token_type_ids_tensor,
                ])?;

                // Extract the relevance score from the model output.
                let (_shape, score_data) = outputs[0]
                    .try_extract_tensor::<f32>()
                    .context("failed to extract score tensor from ONNX output")?;
                let relevance_score = score_data[0];

                scored.push((idx, relevance_score, doc));
            }

            Ok(scored)
        })
        .await
        .map_err(|e| anyhow::anyhow!("spawn_blocking join error: {e}"))??;

        // Sort by score descending.
        let mut scored = scored;
        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        // Apply top_k limit.
        let limit = top_k.unwrap_or(scored.len());
        scored.truncate(limit);

        Ok(scored
            .into_iter()
            .map(|(idx, score, text)| RerankResult {
                index: idx,
                score,
                text,
            })
            .collect())
    }
}
