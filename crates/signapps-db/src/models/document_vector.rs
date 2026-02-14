//! Document vector models for pgvector storage.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Document vector chunk stored in PostgreSQL with pgvector.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentVector {
    pub id: Uuid,
    pub document_id: Uuid,
    pub chunk_index: i32,
    pub content: String,
    pub filename: String,
    pub path: String,
    pub mime_type: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

/// Search result from pgvector similarity search.
#[derive(Debug, Clone, Serialize)]
pub struct VectorSearchResult {
    pub id: Uuid,
    pub document_id: Uuid,
    pub chunk_index: i32,
    pub content: String,
    pub filename: String,
    pub path: String,
    pub mime_type: Option<String>,
    pub score: f32,
}

/// Collection statistics.
#[derive(Debug, Clone, Serialize)]
pub struct VectorStats {
    pub total_chunks: i64,
    pub total_documents: i64,
}
