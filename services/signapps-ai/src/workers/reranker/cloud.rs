//! Cloud-based reranker that calls the Cohere Rerank API.
#![allow(dead_code)]

use anyhow::{Context, Result};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::gateway::{BackendType, Capability};
use crate::workers::{AiWorker, RerankResult, RerankerWorker};

// ---------------------------------------------------------------------------
// Cohere API URL
// ---------------------------------------------------------------------------

const COHERE_RERANK_URL: &str = "https://api.cohere.ai/v2/rerank";

// ---------------------------------------------------------------------------
// Internal request / response types for Cohere Rerank API
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct CohereRerankRequest<'a> {
    model: &'a str,
    query: &'a str,
    documents: &'a [String],
    top_n: usize,
    return_documents: bool,
}

#[derive(Deserialize)]
struct CohereRerankResponse {
    results: Vec<CohereRerankResultItem>,
}

#[derive(Deserialize)]
struct CohereRerankResultItem {
    index: usize,
    relevance_score: f32,
    document: Option<CohereDocument>,
}

#[derive(Deserialize)]
struct CohereDocument {
    text: String,
}

// ---------------------------------------------------------------------------
// CloudReranker
// ---------------------------------------------------------------------------

/// Reranker worker that calls the Cohere Rerank API for document reranking.
pub struct CloudReranker {
    client: reqwest::Client,
    api_key: String,
    model: String,
}

impl CloudReranker {
    /// Create a new Cohere cloud reranker. If `model` is `None`, defaults to
    /// `"rerank-v3.5"`.
    pub fn new(api_key: &str, model: Option<&str>) -> Self {
        Self {
            client: reqwest::Client::new(),
            api_key: api_key.to_string(),
            model: model.unwrap_or("rerank-v3.5").to_string(),
        }
    }
}

#[async_trait]
impl AiWorker for CloudReranker {
    fn capability(&self) -> Capability {
        Capability::Rerank
    }

    fn backend_type(&self) -> BackendType {
        BackendType::Cloud {
            provider: "cohere".to_string(),
        }
    }

    fn required_vram_mb(&self) -> u64 {
        0
    }

    fn quality_score(&self) -> f32 {
        0.95
    }

    fn is_loaded(&self) -> bool {
        true
    }

    async fn health_check(&self) -> bool {
        // Cloud service is assumed to be always available; no lightweight
        // health endpoint exists on Cohere that doesn't consume credits.
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
impl RerankerWorker for CloudReranker {
    async fn rerank(
        &self,
        query: &str,
        documents: Vec<String>,
        top_k: Option<usize>,
    ) -> Result<Vec<RerankResult>> {
        let top_n = top_k.unwrap_or(documents.len());

        let body = CohereRerankRequest {
            model: &self.model,
            query,
            documents: &documents,
            top_n,
            return_documents: true,
        };

        debug!(
            model = %self.model,
            num_docs = documents.len(),
            top_n,
            "Cohere rerank request"
        );

        let resp = self
            .client
            .post(COHERE_RERANK_URL)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&body)
            .send()
            .await
            .context("failed to send rerank request to Cohere API")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Cohere rerank API returned {status}: {error_body}");
        }

        let cohere_resp: CohereRerankResponse = resp
            .json()
            .await
            .context("failed to parse Cohere rerank response")?;

        let results = cohere_resp
            .results
            .into_iter()
            .map(|item| RerankResult {
                index: item.index,
                score: item.relevance_score,
                text: item
                    .document
                    .map(|d| d.text)
                    .unwrap_or_else(|| documents.get(item.index).cloned().unwrap_or_default()),
            })
            .collect();

        Ok(results)
    }
}
