//! Multimodal vector models for pgvector storage (images, audio, video).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Multimodal vector chunk stored in PostgreSQL with pgvector (1024-dim SigLIP).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultimodalVector {
    pub id: Uuid,
    pub document_id: Uuid,
    pub chunk_index: i32,
    pub media_type: String,
    pub content: Option<String>,
    pub filename: String,
    pub path: String,
    pub mime_type: Option<String>,
    pub collection: String,
    pub metadata: Option<serde_json::Value>,
    pub security_tags: Option<serde_json::Value>,
    pub created_at: Option<DateTime<Utc>>,
}

/// Search result from multimodal pgvector similarity search.
#[derive(Debug, Clone, Serialize)]
pub struct MultimodalSearchResult {
    pub id: Uuid,
    pub document_id: Uuid,
    pub chunk_index: i32,
    pub media_type: String,
    pub content: Option<String>,
    pub filename: String,
    pub path: String,
    pub mime_type: Option<String>,
    pub score: f32,
    pub metadata: Option<serde_json::Value>,
    pub security_tags: Option<serde_json::Value>,
}

/// Input for a multimodal chunk to upsert.
pub struct MultimodalChunkInput {
    pub id: Uuid,
    pub document_id: Uuid,
    pub chunk_index: i32,
    pub media_type: String,
    pub content: Option<String>,
    pub filename: String,
    pub path: String,
    pub mime_type: Option<String>,
    pub collection: String,
    pub metadata: Option<serde_json::Value>,
    pub security_tags: Option<serde_json::Value>,
}
