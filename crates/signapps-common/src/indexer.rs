//! Universal AI Indexer Client
//!
//! Lightweight HTTP client for services to notify the AI service
//! when data changes, triggering automatic RAG indexation.
//!
//! # Usage
//!
//! ```rust,ignore
//! let indexer = AiIndexerClient::from_env();
//!
//! // When a mail is received
//! indexer.index("mail", &serde_json::json!({
//!     "subject": "Meeting tomorrow",
//!     "from": "alice@example.com",
//!     "body": "Let's meet at 10am",
//!     "user_id": "usr_123"
//! })).await?;
//!
//! // When a document is saved
//! indexer.index_text("docs", doc_id, "filename.md", "/docs/file.md",
//!     "Document content here...").await?;
//! ```

use reqwest::Client;
use serde_json::Value;
use uuid::Uuid;

/// Client for sending data to the AI indexation service.
#[derive(Clone)]
pub struct AiIndexerClient {
    client: Client,
    ai_base_url: String,
    enabled: bool,
}

impl AiIndexerClient {
    /// Create a new indexer client.
    pub fn new(ai_base_url: &str) -> Self {
        Self {
            client: Client::new(),
            ai_base_url: ai_base_url.trim_end_matches('/').to_string(),
            enabled: true,
        }
    }

    /// Create from environment variables.
    /// Uses AI_URL env var, defaults to http://localhost:3005/api/v1.
    /// Set AI_INDEXER_ENABLED=false to disable.
    pub fn from_env() -> Self {
        let ai_url = std::env::var("AI_URL")
            .unwrap_or_else(|_| "http://localhost:3005/api/v1".to_string());
        let enabled = std::env::var("AI_INDEXER_ENABLED")
            .map(|v| v != "false" && v != "0")
            .unwrap_or(true);

        Self {
            client: Client::new(),
            ai_base_url: ai_url.trim_end_matches('/').to_string(),
            enabled,
        }
    }

    /// Index arbitrary JSON data via the webhook endpoint.
    /// The AI service will convert it to a narrative and store in pgvector.
    ///
    /// `source_type` examples: "mail", "docs", "chat", "calendar", "storage", "it-assets"
    pub async fn index(&self, source_type: &str, payload: &Value) -> Result<(), String> {
        if !self.enabled {
            return Ok(());
        }

        // Use the webhook endpoint for JSON payloads
        let webhook_url = format!(
            "{}/ai/webhook/{}",
            self.ai_base_url, source_type
        );

        match self
            .client
            .post(&webhook_url)
            .json(payload)
            .timeout(std::time::Duration::from_secs(30))
            .send()
            .await
        {
            Ok(resp) => {
                if resp.status().is_success() {
                    tracing::debug!(source = source_type, "Data indexed in AI memory");
                    Ok(())
                } else {
                    let status = resp.status();
                    let body = resp.text().await.unwrap_or_default();
                    tracing::warn!(
                        source = source_type,
                        status = %status,
                        "AI indexation failed: {}",
                        body
                    );
                    // Non-fatal: don't break the calling service
                    Ok(())
                }
            }
            Err(e) => {
                tracing::warn!(
                    source = source_type,
                    "AI service unreachable for indexation: {}",
                    e
                );
                // Non-fatal: the AI service might be down
                Ok(())
            }
        }
    }

    /// Index raw text content directly (bypasses webhook narrative generation).
    /// Use this when you already have clean text (document content, email body).
    pub async fn index_text(
        &self,
        collection: &str,
        document_id: Uuid,
        filename: &str,
        path: &str,
        content: &str,
    ) -> Result<(), String> {
        if !self.enabled {
            return Ok(());
        }

        let url = format!(
            "{}/internal/index/{}",
            self.ai_base_url, document_id
        );

        let payload = serde_json::json!({
            "content": content,
            "filename": filename,
            "path": path,
            "collection": collection,
            "mime_type": "text/plain"
        });

        match self
            .client
            .post(&url)
            .json(&payload)
            .timeout(std::time::Duration::from_secs(30))
            .send()
            .await
        {
            Ok(resp) => {
                if resp.status().is_success() {
                    tracing::debug!(
                        collection = collection,
                        document_id = %document_id,
                        "Text indexed in AI memory"
                    );
                } else {
                    tracing::warn!(
                        collection = collection,
                        "AI text indexation failed: {}",
                        resp.status()
                    );
                }
                Ok(())
            }
            Err(e) => {
                tracing::warn!(
                    collection = collection,
                    "AI service unreachable: {}",
                    e
                );
                Ok(())
            }
        }
    }

    /// Remove a document from the AI index.
    pub async fn remove(&self, document_id: Uuid) -> Result<(), String> {
        if !self.enabled {
            return Ok(());
        }

        let url = format!(
            "{}/internal/index/{}",
            self.ai_base_url, document_id
        );

        match self
            .client
            .delete(&url)
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await
        {
            Ok(_) => {
                tracing::debug!(document_id = %document_id, "Removed from AI index");
                Ok(())
            }
            Err(e) => {
                tracing::warn!("Failed to remove from AI index: {}", e);
                Ok(())
            }
        }
    }
}
