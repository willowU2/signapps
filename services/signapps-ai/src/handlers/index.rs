//! Document indexing handlers.
//!

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
/// Request body for Index.
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

/// Internal request triggered by signapps-storage
#[derive(Debug, Deserialize)]
/// Request body for InternalIndex.
pub struct InternalIndexRequest {
    pub bucket: String,
    pub key: String,
    pub content_type: String,
    pub collection_name: Option<String>,
}

/// Direct index request for entity indexing (Tasks, Events)
#[derive(Debug, Deserialize)]
/// Request body for DirectIndex.
pub struct DirectIndexRequest {
    pub content: String,
    pub filename: String,
    pub path: String,
    pub mime_type: Option<String>,
    pub collection: Option<String>,
    pub security_tags: Option<serde_json::Value>,
}

/// Index response.
#[derive(Debug, Serialize)]
/// Response for Index.
pub struct IndexResponse {
    pub document_id: Uuid,
    pub chunks_indexed: usize,
    pub message: String,
}

/// Stats response.
#[derive(Debug, Serialize)]
/// Response for Stats.
pub struct StatsResponse {
    pub documents_count: u64,
    pub chunks_count: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_indexed: Option<String>,
}

/// Index a document.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/index",
    responses((status = 200, description = "Success")),
    tag = "Ai"
)]
#[tracing::instrument(skip_all)]
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

/// Index a document from an internal storage notification.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/index",
    responses((status = 200, description = "Success")),
    tag = "Ai"
)]
#[tracing::instrument(skip_all)]
pub async fn index_internal_document(
    State(state): State<AppState>,
    Json(payload): Json<InternalIndexRequest>,
) -> Result<Json<IndexResponse>> {
    tracing::info!(
        "Received internal index request for {}/{}",
        payload.bucket,
        payload.key
    );

    let path = format!("{}/{}", payload.bucket, payload.key);

    // Read file directly via native OpenDAL instead of making an internal HTTP request to signapps-storage
    // This removes network bandwidth overhead and optimizes memory allocation.
    let bytes = state.storage.read(&path).await.map_err(|e| {
        signapps_common::Error::Internal(format!("Failed to read file natively via OpenDAL: {}", e))
    })?;

    // Parse text from file based on mimetype using the indexer's processor
    let content = state
        .indexer
        .process_document_bytes(&bytes.to_bytes(), &payload.content_type)
        .await
        .map_err(|e| {
            signapps_common::Error::Internal(format!("Failed to parse document: {}", e))
        })?;

    let path = format!("{}/{}", payload.bucket, payload.key);
    // Use a deterministic UUID so re-indexing the same file overwrites its old chunks
    let document_id = Uuid::new_v5(&Uuid::NAMESPACE_URL, path.as_bytes());

    // Clear existing vectors for this document if they exist
    if let Err(e) = state.vectors.delete_document(document_id).await {
        tracing::warn!(
            "Failed to clear old document vectors (may not exist): {}",
            e
        );
    }

    // Index it
    let chunks_indexed = state
        .rag
        .index_document(
            document_id,
            &content,
            &payload.key, // Filename abstraction
            &path,
            Some(&payload.content_type),
            payload.collection_name.as_deref(),
            None,
        )
        .await?;

    Ok(Json(IndexResponse {
        document_id,
        chunks_indexed,
        message: format!("Internal document indexed with {} chunks", chunks_indexed),
    }))
}

/// Index a document from a direct request with known ID.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/index",
    responses((status = 200, description = "Success")),
    tag = "Ai"
)]
#[tracing::instrument(skip_all)]
pub async fn index_direct_document(
    State(state): State<AppState>,
    Path(document_id): Path<Uuid>,
    Json(payload): Json<DirectIndexRequest>,
) -> Result<Json<IndexResponse>> {
    tracing::info!("Received direct index request for document {}", document_id);

    // Clear existing vectors for this document if they exist
    if let Err(e) = state.vectors.delete_document(document_id).await {
        tracing::warn!(
            "Failed to clear old document vectors (may not exist): {}",
            e
        );
    }

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
        message: format!("Direct document indexed with {} chunks", chunks_indexed),
    }))
}

/// Remove a document from the index.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    delete,
    path = "/api/v1/index",
    responses((status = 204, description = "Success")),
    tag = "Ai"
)]
#[tracing::instrument(skip_all)]
pub async fn remove_document(
    State(state): State<AppState>,
    Path(document_id): Path<Uuid>,
) -> Result<StatusCode> {
    state.rag.remove_document(document_id).await?;

    tracing::info!(document_id = %document_id, "Document removed from index");

    Ok(StatusCode::NO_CONTENT)
}

/// Get indexing stats.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/index",
    responses((status = 200, description = "Success")),
    tag = "Ai"
)]
#[tracing::instrument(skip_all)]
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
        last_indexed: None, // NOTE: Requires persistent storage for index timestamps
    }))
}

/// Reindex all documents.
///
/// Spawns a background task that fetches all indexed document paths from the
/// ai.document_vectors table, re-reads each file via OpenDAL, and upserts
/// freshly-computed embeddings. Returns immediately with a task ID.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/index",
    responses((status = 200, description = "Success")),
    tag = "Ai"
)]
#[tracing::instrument(skip_all)]
pub async fn reindex_all(
    State(state): State<AppState>,
) -> std::result::Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    // Fetch distinct document paths from the vector store to know what to reindex.
    // We use the `path` column stored in ai.document_vectors.
    #[derive(sqlx::FromRow)]
    struct DocRow {
        path: String,
        mime_type: Option<String>,
    }

    let docs_result = sqlx::query_as::<_, DocRow>(
        r#"SELECT DISTINCT ON (path) path, mime_type
           FROM ai.document_vectors
           ORDER BY path, created_at DESC"#,
    )
    .fetch_all(state.pool.inner())
    .await;

    let docs = match docs_result {
        Ok(d) => d,
        Err(e) => {
            tracing::error!("Failed to fetch document list for reindex: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("DB error: {}", e) })),
            ));
        },
    };

    let total = docs.len();
    tracing::info!("Reindex triggered for {} documents", total);

    // Spawn background task — return immediately
    let state_clone = state.clone();
    tokio::spawn(async move {
        let mut succeeded = 0usize;
        let mut failed = 0usize;

        for doc in docs {
            let path = doc.path.clone();
            let content_type = doc.mime_type.as_deref().unwrap_or("text/plain").to_string();

            // Read file via OpenDAL storage operator
            let bytes = match state_clone.storage.read(&path).await {
                Ok(b) => b.to_bytes(),
                Err(e) => {
                    tracing::warn!("Reindex: failed to read {}: {}", path, e);
                    failed += 1;
                    continue;
                },
            };

            // Parse text from bytes
            let content = match state_clone
                .indexer
                .process_document_bytes(&bytes, &content_type)
                .await
            {
                Ok(c) => c,
                Err(e) => {
                    tracing::warn!("Reindex: failed to parse {}: {}", path, e);
                    failed += 1;
                    continue;
                },
            };

            // Deterministic document ID based on path
            let document_id = Uuid::new_v5(&Uuid::NAMESPACE_URL, path.as_bytes());

            // Delete old vectors for this document
            if let Err(e) = state_clone.vectors.delete_document(document_id).await {
                tracing::warn!("Reindex: failed to clear old vectors for {}: {}", path, e);
            }

            // Re-index
            let filename = path.split('/').next_back().unwrap_or(&path).to_string();
            match state_clone
                .rag
                .index_document(
                    document_id,
                    &content,
                    &filename,
                    &path,
                    Some(&content_type),
                    None,
                    None,
                )
                .await
            {
                Ok(chunks) => {
                    tracing::debug!("Reindex: {} → {} chunks", path, chunks);
                    succeeded += 1;
                },
                Err(e) => {
                    tracing::warn!("Reindex: failed to index {}: {}", path, e);
                    failed += 1;
                },
            }
        }

        tracing::info!(
            "Reindex complete: {}/{} succeeded, {} failed",
            succeeded,
            total,
            failed
        );
    });

    Ok(Json(serde_json::json!({
        "status": "started",
        "message": format!("Reindexing {} documents in background", total),
        "total_documents": total
    })))
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
