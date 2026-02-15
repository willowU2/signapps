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

/// A knowledge base collection.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Collection {
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Collection with aggregated statistics (for list endpoints).
#[derive(Debug, Clone, Serialize)]
pub struct CollectionWithStats {
    pub name: String,
    pub description: Option<String>,
    pub documents_count: i64,
    pub chunks_count: i64,
    pub size_bytes: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// Detailed collection statistics.
#[derive(Debug, Clone, Serialize)]
pub struct CollectionStatsDetail {
    pub name: String,
    pub documents_count: i64,
    pub chunks_count: i64,
    pub size_bytes: i64,
    pub avg_chunk_size: i64,
    pub last_indexed: Option<String>,
}
