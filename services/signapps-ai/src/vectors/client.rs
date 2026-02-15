//! Vector service implementation using pgvector (PostgreSQL).

use signapps_common::{Error, Result};
use signapps_db::models::{CollectionStatsDetail, CollectionWithStats};
use signapps_db::repositories::vector_repository::{ChunkInput, VectorRepository};
use signapps_db::DatabasePool;
use uuid::Uuid;

use super::types::*;

/// Vector service for document storage and search using pgvector.
#[derive(Clone)]
pub struct VectorService {
    pool: DatabasePool,
}

impl VectorService {
    /// Create a new vector service backed by pgvector.
    pub fn new(pool: DatabasePool) -> Self {
        Self { pool }
    }

    /// Insert document chunks with their embeddings.
    pub async fn upsert_chunks(
        &self,
        chunks: &[DocumentChunk],
        embeddings: Vec<Vec<f32>>,
    ) -> Result<()> {
        if chunks.len() != embeddings.len() {
            return Err(Error::Internal(
                "Chunks and embeddings count mismatch".to_string(),
            ));
        }

        let document_id = chunks
            .first()
            .map(|c| c.document_id)
            .ok_or_else(|| Error::Internal("No chunks provided".to_string()))?;

        let inputs: Vec<ChunkInput> = chunks
            .iter()
            .map(|c| ChunkInput {
                id: c.id,
                chunk_index: c.chunk_index,
                content: c.content.clone(),
                filename: c.filename.clone(),
                path: c.path.clone(),
                mime_type: c.mime_type.clone(),
                collection: c
                    .collection
                    .clone()
                    .unwrap_or_else(|| "default".to_string()),
            })
            .collect();

        VectorRepository::upsert_chunks(&self.pool, document_id, &inputs, &embeddings).await?;

        tracing::debug!(count = chunks.len(), "Upserted document chunks to pgvector");

        Ok(())
    }

    /// Search for similar documents.
    pub async fn search(
        &self,
        query_vector: Vec<f32>,
        limit: u64,
        score_threshold: Option<f32>,
        collection: Option<&str>,
    ) -> Result<Vec<SearchResult>> {
        let results = VectorRepository::search(
            &self.pool,
            &query_vector,
            limit as i64,
            score_threshold,
            collection,
        )
        .await?;

        Ok(results
            .into_iter()
            .map(|r| SearchResult {
                id: r.id,
                document_id: r.document_id,
                content: r.content,
                filename: r.filename,
                score: r.score,
            })
            .collect())
    }

    /// Delete all chunks for a document.
    pub async fn delete_document(&self, document_id: Uuid) -> Result<()> {
        let deleted = VectorRepository::delete_by_document(&self.pool, document_id).await?;

        tracing::info!(
            document_id = %document_id,
            deleted = deleted,
            "Deleted document chunks from pgvector"
        );

        Ok(())
    }

    /// Get collection statistics.
    pub async fn get_stats(&self, collection: Option<&str>) -> Result<CollectionStats> {
        let stats = VectorRepository::get_stats(&self.pool, collection).await?;

        Ok(CollectionStats {
            name: collection.unwrap_or("document_vectors").to_string(),
            vectors_count: stats.total_chunks as u64,
            indexed_vectors_count: stats.total_chunks as u64,
            points_count: stats.total_chunks as u64,
            status: "green".to_string(),
        })
    }

    // ── Collection CRUD delegation ───────────────────────────────

    /// List all collections with stats.
    pub async fn list_collections(&self) -> Result<Vec<CollectionWithStats>> {
        VectorRepository::list_collections(&self.pool).await
    }

    /// Get a single collection with stats.
    pub async fn get_collection(&self, name: &str) -> Result<CollectionWithStats> {
        VectorRepository::get_collection(&self.pool, name).await
    }

    /// Create a new collection.
    pub async fn create_collection(
        &self,
        name: &str,
        description: Option<&str>,
    ) -> Result<signapps_db::models::Collection> {
        VectorRepository::create_collection(&self.pool, name, description).await
    }

    /// Delete a collection.
    pub async fn delete_collection(&self, name: &str) -> Result<()> {
        VectorRepository::delete_collection(&self.pool, name).await
    }

    /// Get detailed stats for a collection.
    pub async fn get_collection_stats(&self, name: &str) -> Result<CollectionStatsDetail> {
        VectorRepository::get_collection_stats(&self.pool, name).await
    }
}
