//! Embeddings client supporting TEI and Ollama.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};

/// Backend type for embeddings.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum EmbeddingsBackend {
    /// Text Embeddings Inference (HuggingFace)
    Tei,
    /// Ollama
    Ollama,
}

/// Request to TEI embeddings API.
#[derive(Debug, Serialize)]
struct TeiEmbedRequest {
    inputs: Vec<String>,
}

/// Request to Ollama embeddings API.
#[derive(Debug, Serialize)]
struct OllamaEmbedRequest {
    model: String,
    prompt: String,
}

/// Response from TEI embeddings API.
#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum TeiEmbedResponse {
    /// Multiple embeddings (for batch requests).
    Multiple(Vec<Vec<f32>>),
    /// Single embedding wrapped.
    Single(Vec<f32>),
}

/// Response from Ollama embeddings API.
#[derive(Debug, Deserialize)]
struct OllamaEmbedResponse {
    embedding: Vec<f32>,
}

/// Client for generating text embeddings.
#[derive(Clone)]
pub struct EmbeddingsClient {
    client: Client,
    base_url: String,
    backend: EmbeddingsBackend,
    model: String,
}

impl EmbeddingsClient {
    /// Create a new embeddings client (auto-detect backend).
    pub fn new(base_url: &str) -> Self {
        let base_url = base_url.trim_end_matches('/').to_string();
        // Auto-detect Ollama by port or URL pattern
        let backend = if base_url.contains(":11434") || base_url.contains("ollama") {
            EmbeddingsBackend::Ollama
        } else {
            EmbeddingsBackend::Tei
        };
        let model =
            std::env::var("EMBEDDINGS_MODEL").unwrap_or_else(|_| "nomic-embed-text".to_string());

        Self {
            client: Client::new(),
            base_url,
            backend,
            model,
        }
    }

    /// Create a new embeddings client with explicit backend.
    pub fn with_backend(base_url: &str, backend: EmbeddingsBackend, model: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            backend,
            model: model.to_string(),
        }
    }

    /// Generate embeddings for multiple texts.
    pub async fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
        if texts.is_empty() {
            return Ok(vec![]);
        }

        match self.backend {
            EmbeddingsBackend::Tei => self.embed_batch_tei(texts).await,
            EmbeddingsBackend::Ollama => self.embed_batch_ollama(texts).await,
        }
    }

    /// TEI batch embedding.
    async fn embed_batch_tei(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
        let request = TeiEmbedRequest {
            inputs: texts.to_vec(),
        };

        let response = self
            .client
            .post(format!("{}/embed", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| Error::Internal(format!("TEI embeddings request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Internal(format!(
                "TEI API error ({}): {}",
                status, body
            )));
        }

        let embeddings: TeiEmbedResponse = response
            .json()
            .await
            .map_err(|e| Error::Internal(format!("Failed to parse TEI embeddings: {}", e)))?;

        match embeddings {
            TeiEmbedResponse::Multiple(vecs) => Ok(vecs),
            TeiEmbedResponse::Single(vec) => Ok(vec![vec]),
        }
    }

    /// Ollama batch embedding (sequential, Ollama doesn't support batch).
    async fn embed_batch_ollama(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
        let mut results = Vec::with_capacity(texts.len());

        for text in texts {
            let embedding = self.embed_single_ollama(text).await?;
            results.push(embedding);
        }

        Ok(results)
    }

    /// Ollama single embedding.
    async fn embed_single_ollama(&self, text: &str) -> Result<Vec<f32>> {
        let request = OllamaEmbedRequest {
            model: self.model.clone(),
            prompt: text.to_string(),
        };

        let response = self
            .client
            .post(format!("{}/api/embeddings", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| Error::Internal(format!("Ollama embeddings request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Internal(format!(
                "Ollama API error ({}): {}",
                status, body
            )));
        }

        let result: OllamaEmbedResponse = response
            .json()
            .await
            .map_err(|e| Error::Internal(format!("Failed to parse Ollama embeddings: {}", e)))?;

        Ok(result.embedding)
    }

    /// Generate embedding for a single text.
    pub async fn embed(&self, text: &str) -> Result<Vec<f32>> {
        match self.backend {
            EmbeddingsBackend::Tei => {
                let embeddings = self.embed_batch_tei(&[text.to_string()]).await?;
                embeddings
                    .into_iter()
                    .next()
                    .ok_or_else(|| Error::Internal("No embedding returned".to_string()))
            },
            EmbeddingsBackend::Ollama => self.embed_single_ollama(text).await,
        }
    }

    /// Check if the embeddings service is healthy.
    pub async fn health_check(&self) -> Result<bool> {
        let url = match self.backend {
            EmbeddingsBackend::Tei => format!("{}/health", self.base_url),
            EmbeddingsBackend::Ollama => format!("{}/api/tags", self.base_url),
        };

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| Error::Internal(format!("Health check failed: {}", e)))?;

        Ok(response.status().is_success())
    }
}
