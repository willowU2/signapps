//! Vector repository for pgvector document storage.

use crate::models::{VectorSearchResult, VectorStats};
use crate::DatabasePool;
use pgvector::Vector;
use signapps_common::{Error, Result};
use uuid::Uuid;

/// Repository for vector operations using pgvector.
pub struct VectorRepository;

impl VectorRepository {
    /// Upsert document chunks with their embeddings.
    pub async fn upsert_chunks(
        pool: &DatabasePool,
        document_id: Uuid,
        chunks: &[ChunkInput],
        embeddings: &[Vec<f32>],
    ) -> Result<()> {
        if chunks.len() != embeddings.len() {
            return Err(Error::Internal(
                "Chunks and embeddings count mismatch".to_string(),
            ));
        }

        for (chunk, embedding) in chunks.iter().zip(embeddings) {
            let vec = Vector::from(embedding.clone());
            sqlx::query(
                r#"
                INSERT INTO ai.document_vectors
                    (id, document_id, chunk_index, content, filename, path, mime_type, embedding)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (document_id, chunk_index) DO UPDATE SET
                    content = EXCLUDED.content,
                    filename = EXCLUDED.filename,
                    path = EXCLUDED.path,
                    mime_type = EXCLUDED.mime_type,
                    embedding = EXCLUDED.embedding
                "#,
            )
            .bind(chunk.id)
            .bind(document_id)
            .bind(chunk.chunk_index)
            .bind(&chunk.content)
            .bind(&chunk.filename)
            .bind(&chunk.path)
            .bind(&chunk.mime_type)
            .bind(vec)
            .execute(pool.inner())
            .await
            .map_err(|e| Error::Internal(format!("Failed to upsert chunk: {}", e)))?;
        }

        Ok(())
    }

    /// Search for similar document chunks by cosine similarity.
    pub async fn search(
        pool: &DatabasePool,
        query_vector: &[f32],
        limit: i64,
        score_threshold: Option<f32>,
    ) -> Result<Vec<VectorSearchResult>> {
        let vec = Vector::from(query_vector.to_vec());
        let threshold = score_threshold.unwrap_or(0.0);

        let rows = sqlx::query_as::<_, VectorSearchRow>(
            r#"
            SELECT
                id,
                document_id,
                chunk_index,
                content,
                filename,
                path,
                mime_type,
                1 - (embedding <=> $1::vector) AS score
            FROM ai.document_vectors
            WHERE 1 - (embedding <=> $1::vector) >= $2
            ORDER BY embedding <=> $1::vector
            LIMIT $3
            "#,
        )
        .bind(vec)
        .bind(threshold)
        .bind(limit)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| Error::Internal(format!("Vector search failed: {}", e)))?;

        Ok(rows
            .into_iter()
            .map(|r| VectorSearchResult {
                id: r.id,
                document_id: r.document_id,
                chunk_index: r.chunk_index,
                content: r.content,
                filename: r.filename,
                path: r.path,
                mime_type: r.mime_type,
                score: r.score,
            })
            .collect())
    }

    /// Delete all chunks for a document.
    pub async fn delete_by_document(pool: &DatabasePool, document_id: Uuid) -> Result<u64> {
        let result = sqlx::query("DELETE FROM ai.document_vectors WHERE document_id = $1")
            .bind(document_id)
            .execute(pool.inner())
            .await
            .map_err(|e| Error::Internal(format!("Failed to delete vectors: {}", e)))?;

        Ok(result.rows_affected())
    }

    /// Get vector collection statistics.
    pub async fn get_stats(pool: &DatabasePool) -> Result<VectorStats> {
        let row = sqlx::query_as::<_, StatsRow>(
            r#"
            SELECT
                COUNT(*) as total_chunks,
                COUNT(DISTINCT document_id) as total_documents
            FROM ai.document_vectors
            "#,
        )
        .fetch_one(pool.inner())
        .await
        .map_err(|e| Error::Internal(format!("Failed to get stats: {}", e)))?;

        Ok(VectorStats {
            total_chunks: row.total_chunks.unwrap_or(0),
            total_documents: row.total_documents.unwrap_or(0),
        })
    }
}

/// Input for a chunk to upsert.
pub struct ChunkInput {
    pub id: Uuid,
    pub chunk_index: i32,
    pub content: String,
    pub filename: String,
    pub path: String,
    pub mime_type: Option<String>,
}

/// Internal row type for search results.
#[derive(sqlx::FromRow)]
struct VectorSearchRow {
    id: Uuid,
    document_id: Uuid,
    chunk_index: i32,
    content: String,
    filename: String,
    path: String,
    mime_type: Option<String>,
    score: f32,
}

/// Internal row type for stats.
#[derive(sqlx::FromRow)]
struct StatsRow {
    total_chunks: Option<i64>,
    total_documents: Option<i64>,
}
