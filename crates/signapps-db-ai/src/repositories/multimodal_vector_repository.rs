//! Repository for multimodal vector operations using pgvector (1024-dim SigLIP).

use crate::models::multimodal_vector::{MultimodalChunkInput, MultimodalSearchResult};
use pgvector::Vector;
use signapps_common::{Error, Result};
use signapps_db_shared::DatabasePool;
use uuid::Uuid;

/// Repository for multimodal vector operations.
pub struct MultimodalVectorRepository;

impl MultimodalVectorRepository {
    /// Upsert multimodal chunks with their embeddings.
    pub async fn upsert_chunks(
        pool: &DatabasePool,
        chunks: &[MultimodalChunkInput],
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
                INSERT INTO ai.multimodal_vectors
                    (id, document_id, chunk_index, media_type, content,
                     filename, path, mime_type, embedding, collection,
                     metadata, security_tags)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (document_id, chunk_index, media_type) DO UPDATE SET
                    content = EXCLUDED.content,
                    filename = EXCLUDED.filename,
                    path = EXCLUDED.path,
                    mime_type = EXCLUDED.mime_type,
                    embedding = EXCLUDED.embedding,
                    collection = EXCLUDED.collection,
                    metadata = EXCLUDED.metadata,
                    security_tags = EXCLUDED.security_tags
                "#,
            )
            .bind(chunk.id)
            .bind(chunk.document_id)
            .bind(chunk.chunk_index)
            .bind(&chunk.media_type)
            .bind(&chunk.content)
            .bind(&chunk.filename)
            .bind(&chunk.path)
            .bind(&chunk.mime_type)
            .bind(vec)
            .bind(&chunk.collection)
            .bind(&chunk.metadata)
            .bind(&chunk.security_tags)
            .execute(pool.inner())
            .await
            .map_err(|e| Error::Internal(format!("Failed to upsert multimodal chunk: {}", e)))?;
        }

        Ok(())
    }

    /// Search for similar multimodal chunks by cosine similarity.
    pub async fn search(
        pool: &DatabasePool,
        query_vector: &[f32],
        limit: i64,
        score_threshold: Option<f32>,
        collections: Option<&[String]>,
        media_types: Option<&[String]>,
    ) -> Result<Vec<MultimodalSearchResult>> {
        let vec = Vector::from(query_vector.to_vec());
        let threshold = score_threshold.unwrap_or(0.0);

        let mut query = String::from(
            r#"
            SELECT
                id, document_id, chunk_index, media_type, content,
                filename, path, mime_type,
                1 - (embedding <=> $1::vector) AS score,
                metadata, security_tags
            FROM ai.multimodal_vectors
            WHERE 1 - (embedding <=> $1::vector) >= $2
            "#,
        );

        let mut param_idx = 4u32;

        if collections.is_some() {
            query.push_str(&format!(" AND collection = ANY(${})", param_idx));
            param_idx += 1;
        }

        if media_types.is_some() {
            query.push_str(&format!(" AND media_type = ANY(${})", param_idx));
        }

        query.push_str(" ORDER BY embedding <=> $1::vector LIMIT $3");

        let mut sqlx_query = sqlx::query_as::<_, MultimodalSearchRow>(&query)
            .bind(&vec)
            .bind(threshold)
            .bind(limit);

        if let Some(colls) = collections {
            sqlx_query = sqlx_query.bind(colls);
        }

        if let Some(types) = media_types {
            sqlx_query = sqlx_query.bind(types);
        }

        let rows = sqlx_query
            .fetch_all(pool.inner())
            .await
            .map_err(|e| Error::Internal(format!("Multimodal vector search failed: {}", e)))?;

        Ok(rows
            .into_iter()
            .map(|r| MultimodalSearchResult {
                id: r.id,
                document_id: r.document_id,
                chunk_index: r.chunk_index,
                media_type: r.media_type,
                content: r.content,
                filename: r.filename,
                path: r.path,
                mime_type: r.mime_type,
                score: r.score,
                metadata: r.metadata,
                security_tags: r.security_tags,
            })
            .collect())
    }

    /// Delete all multimodal chunks for a document.
    pub async fn delete_by_document(pool: &DatabasePool, document_id: Uuid) -> Result<u64> {
        let result = sqlx::query("DELETE FROM ai.multimodal_vectors WHERE document_id = $1")
            .bind(document_id)
            .execute(pool.inner())
            .await
            .map_err(|e| Error::Internal(format!("Failed to delete multimodal vectors: {}", e)))?;

        Ok(result.rows_affected())
    }
}

/// Internal row type for multimodal search results.
#[derive(sqlx::FromRow)]
struct MultimodalSearchRow {
    id: uuid::Uuid,
    document_id: uuid::Uuid,
    chunk_index: i32,
    media_type: String,
    content: Option<String>,
    filename: String,
    path: String,
    mime_type: Option<String>,
    score: f32,
    metadata: Option<serde_json::Value>,
    security_tags: Option<serde_json::Value>,
}
