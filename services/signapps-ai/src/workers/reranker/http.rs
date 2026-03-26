//! HTTP-based reranker that calls a TEI-compatible `/rerank` endpoint.
#![allow(dead_code)]

use anyhow::{Context, Result};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::gateway::{BackendType, Capability};
use crate::workers::{AiWorker, RerankResult, RerankerWorker};

// ---------------------------------------------------------------------------
// Internal request / response types for TEI rerank API
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct TeiRerankRequest<'a> {
    query: &'a str,
    texts: &'a [String],
    return_text: bool,
}

#[derive(Deserialize)]
struct TeiRerankResponseItem {
    index: usize,
    score: f32,
    text: Option<String>,
}

// ---------------------------------------------------------------------------
// HttpReranker
// ---------------------------------------------------------------------------

/// Reranker worker that calls a TEI (Text Embeddings Inference) compatible
/// HTTP endpoint for document reranking.
pub struct HttpReranker {
    client: reqwest::Client,
    base_url: String,
    model: String,
}

impl HttpReranker {
    /// Create a new HTTP reranker pointing at `base_url` (e.g.
    /// `http://localhost:8080`). The `model` string is informational only —
    /// the remote server decides which model to use.
    pub fn new(base_url: &str, model: &str) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            model: model.to_string(),
        }
    }
}

#[async_trait]
impl AiWorker for HttpReranker {
    fn capability(&self) -> Capability {
        Capability::Rerank
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
impl RerankerWorker for HttpReranker {
    async fn rerank(
        &self,
        query: &str,
        documents: Vec<String>,
        top_k: Option<usize>,
    ) -> Result<Vec<RerankResult>> {
        let body = TeiRerankRequest {
            query,
            texts: &documents,
            return_text: true,
        };

        debug!(
            base_url = %self.base_url,
            model = %self.model,
            num_docs = documents.len(),
            "HTTP rerank request"
        );

        let resp = self
            .client
            .post(format!("{}/rerank", self.base_url))
            .json(&body)
            .send()
            .await
            .context("failed to send rerank request to TEI endpoint")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("TEI rerank endpoint returned {status}: {error_body}");
        }

        let mut items: Vec<TeiRerankResponseItem> = resp
            .json()
            .await
            .context("failed to parse TEI rerank response")?;

        // Sort by score descending.
        items.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        // Apply top_k limit.
        let limit = top_k.unwrap_or(items.len());
        let results = items
            .into_iter()
            .take(limit)
            .map(|item| RerankResult {
                index: item.index,
                score: item.score,
                text: item
                    .text
                    .unwrap_or_else(|| documents.get(item.index).cloned().unwrap_or_default()),
            })
            .collect();

        Ok(results)
    }
}
