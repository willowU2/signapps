//! Document indexing handlers.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
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
    pub collection: String,
    pub vectors_count: u64,
    pub points_count: u64,
    pub status: String,
}

/// Index a document.
#[tracing::instrument(skip(state, payload))]
pub async fn index_document(
    State(state): State<AppState>,
    Json(payload): Json<IndexRequest>,
) -> Result<Json<IndexResponse>> {
    let document_id = Uuid::new_v4();

    let chunks_indexed = state.rag
        .index_document(
            document_id,
            &payload.content,
            &payload.filename,
            &payload.path,
            payload.mime_type.as_deref(),
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
    let stats = state.qdrant.get_stats().await?;

    Ok(Json(StatsResponse {
        collection: stats.name,
        vectors_count: stats.vectors_count,
        points_count: stats.points_count,
        status: stats.status,
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
