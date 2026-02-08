//! Embeddings client for TEI (Text Embeddings Inference).

use reqwest::Client;
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use std::sync::Arc;

/// Request to the embeddings API.
#[derive(Debug, Serialize)]
struct EmbedRequest {
    inputs: Vec<String>,
}

/// Response from the embeddings API.
#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum EmbedResponse {
    /// Multiple embeddings (for batch requests).
    Multiple(Vec<Vec<f32>>),
    /// Single embedding wrapped.
    Single(Vec<f32>),
}

/// Client for generating text embeddings.
#[derive(Clone)]
pub struct EmbeddingsClient {
    client: Client,
    base_url: String,
}

impl EmbeddingsClient {
    /// Create a new embeddings client.
    pub fn new(base_url: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
        }
    }

    /// Generate embeddings for multiple texts.
    pub async fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
        if texts.is_empty() {
            return Ok(vec![]);
        }

        let request = EmbedRequest {
            inputs: texts.to_vec(),
        };

        let response = self.client
            .post(format!("{}/embed", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| Error::Internal(format!("Embeddings request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Internal(format!(
                "Embeddings API error ({}): {}",
                status, body
            )));
        }

        let embeddings: EmbedResponse = response
            .json()
            .await
            .map_err(|e| Error::Internal(format!("Failed to parse embeddings: {}", e)))?;

        match embeddings {
            EmbedResponse::Multiple(vecs) => Ok(vecs),
            EmbedResponse::Single(vec) => Ok(vec![vec]),
        }
    }

    /// Generate embedding for a single text.
    pub async fn embed(&self, text: &str) -> Result<Vec<f32>> {
        let embeddings = self.embed_batch(&[text.to_string()]).await?;
        embeddings
            .into_iter()
            .next()
            .ok_or_else(|| Error::Internal("No embedding returned".to_string()))
    }

    /// Check if the embeddings service is healthy.
    pub async fn health_check(&self) -> Result<bool> {
        let response = self.client
            .get(format!("{}/health", self.base_url))
            .send()
            .await
            .map_err(|e| Error::Internal(format!("Health check failed: {}", e)))?;

        Ok(response.status().is_success())
    }
}
