//! Vector types for document storage.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// Document chunk for indexing.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentChunk {
    /// Unique ID of this chunk.
    pub id: Uuid,
    /// Parent document ID.
    pub document_id: Uuid,
    /// Chunk index within the document.
    pub chunk_index: i32,
    /// Text content of this chunk.
    pub content: String,
    /// Original filename.
    pub filename: String,
    /// File path in storage.
    pub path: String,
    /// MIME type.
    pub mime_type: Option<String>,
    /// Collection name.
    pub collection: Option<String>,
    pub security_tags: Option<Value>,
}

/// Search result from vector similarity search.
#[derive(Debug, Clone, Serialize)]
pub struct SearchResult {
    /// Chunk ID.
    pub id: Uuid,
    /// Document ID.
    pub document_id: Uuid,
    /// Text content.
    pub content: String,
    /// Filename.
    pub filename: String,
    /// Similarity score (0-1).
    pub score: f32,
}

/// Collection statistics.
#[derive(Debug, Clone, Serialize)]
pub struct CollectionStats {
    /// Collection name.
    pub name: String,
    /// Number of vectors.
    pub vectors_count: u64,
    /// Number of indexed vectors.
    pub indexed_vectors_count: u64,
    /// Number of points.
    pub points_count: u64,
    /// Collection status.
    pub status: String,
}
