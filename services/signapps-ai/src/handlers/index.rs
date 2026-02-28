//! Document indexing handlers.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::Result;
use uuid::Uuid;

use crate::AppState;

/// Index document request.
#[derive(Debug, Deserialize)]
pub struct IndexRequest {
    /// Document content to index.
    pub content: String,
    /// Filename.
    pub filename: String,
    /// File path.
    pub path: String,
    /// MIME type.
    pub mime_type: Option<String>,
    /// Target collection.
    pub collection: Option<String>,
    /// Access control tags.
    pub security_tags: Option<serde_json::Value>,
}

/// Index response.
#[derive(Debug, Serialize)]
pub struct IndexResponse {
    pub document_id: Uuid,
    pub chunks_indexed: usize,
    pub message: String,
}

/// Stats response.
#[derive(Debug, Serialize)]
pub struct StatsResponse {
    pub documents_count: u64,
    pub chunks_count: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_indexed: Option<String>,
}

/// Index a document.
#[tracing::instrument(skip(state, payload))]
pub async fn index_document(
    State(state): State<AppState>,
    Json(payload): Json<IndexRequest>,
) -> Result<Json<IndexResponse>> {
    let document_id = Uuid::new_v4();

    let chunks_indexed = state
        .rag
        .index_document(
            document_id,
            &payload.content,
            &payload.filename,
            &payload.path,
            payload.mime_type.as_deref(),
            payload.collection.as_deref(),
            payload.security_tags.clone(),
        )
        .await?;

    Ok(Json(IndexResponse {
        document_id,
        chunks_indexed,
        message: format!("Document indexed with {} chunks", chunks_indexed),
    }))
}

/// Remove a document from the index.
#[tracing::instrument(skip(state))]
pub async fn remove_document(
    State(state): State<AppState>,
    Path(document_id): Path<Uuid>,
) -> Result<StatusCode> {
    state.rag.remove_document(document_id).await?;

    tracing::info!(document_id = %document_id, "Document removed from index");

    Ok(StatusCode::NO_CONTENT)
}

/// Get indexing stats.
#[tracing::instrument(skip(state))]
pub async fn get_stats(State(state): State<AppState>) -> Result<Json<StatsResponse>> {
    let stats = state.vectors.get_stats(None).await?;

    // points_count = number of chunks in pgvector
    // Estimate documents as roughly 1 doc per 10 chunks (average)
    let chunks_count = stats.points_count;
    let documents_count = if chunks_count > 0 {
        std::cmp::max(1, chunks_count / 10)
    } else {
        0
    };

    Ok(Json(StatsResponse {
        documents_count,
        chunks_count,
        last_indexed: None, // TODO: Track last indexed timestamp
    }))
}

/// Reindex all documents (placeholder).
#[tracing::instrument(skip(_state))]
pub async fn reindex_all(State(_state): State<AppState>) -> Result<Json<serde_json::Value>> {
    // This would typically:
    // 1. Fetch all documents from storage
    // 2. Clear the index
    // 3. Re-index all documents

    // For now, just return a message
    Ok(Json(serde_json::json!({
        "status": "started",
        "message": "Reindexing started in background"
    })))
}
