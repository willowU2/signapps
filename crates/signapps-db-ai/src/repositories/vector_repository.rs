//! Vector repository for pgvector document storage.

use crate::models::document_vector::{
    Collection, CollectionStatsDetail, CollectionWithStats, VectorSearchResult, VectorStats,
};
use pgvector::Vector;
use signapps_common::{Error, Result};
use signapps_db_shared::DatabasePool;
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
                    (id, document_id, chunk_index, content, filename,
                     path, mime_type, embedding, collection, security_tags)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (document_id, chunk_index) DO UPDATE SET
                    content = EXCLUDED.content,
                    filename = EXCLUDED.filename,
                    path = EXCLUDED.path,
                    mime_type = EXCLUDED.mime_type,
                    embedding = EXCLUDED.embedding,
                    collection = EXCLUDED.collection,
                    security_tags = EXCLUDED.security_tags
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
            .bind(&chunk.collection)
            .bind(&chunk.security_tags)
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
        collections: Option<&[String]>,
        security_tags_filter: Option<&serde_json::Value>,
    ) -> Result<Vec<VectorSearchResult>> {
        let vec = Vector::from(query_vector.to_vec());
        let threshold = score_threshold.unwrap_or(0.0);

        let mut query = String::from(
            r#"
            SELECT
                id, document_id, chunk_index, content,
                filename, path, mime_type,
                1 - (embedding <=> $1::vector) AS score, security_tags
            FROM ai.document_vectors
            WHERE 1 - (embedding <=> $1::vector) >= $2
            "#,
        );

        if collections.is_some() {
            query.push_str(" AND collection = ANY($4)");
        }

        if security_tags_filter.is_some() {
            if collections.is_some() {
                query.push_str(" AND security_tags @> $5::jsonb");
            } else {
                query.push_str(" AND security_tags @> $4::jsonb");
            }
        }

        query.push_str(" ORDER BY embedding <=> $1::vector LIMIT $3");

        let mut sqlx_query = sqlx::query_as::<_, VectorSearchRow>(&query)
            .bind(&vec)
            .bind(threshold)
            .bind(limit);

        if let Some(colls) = collections {
            sqlx_query = sqlx_query.bind(colls);
        }

        if let Some(tags) = security_tags_filter {
            sqlx_query = sqlx_query.bind(tags);
        }

        let rows = sqlx_query
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
                security_tags: r.security_tags,
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
    pub async fn get_stats(pool: &DatabasePool, collection: Option<&str>) -> Result<VectorStats> {
        let row = if let Some(coll) = collection {
            sqlx::query_as::<_, StatsRow>(
                r#"
                SELECT
                    COUNT(*) as total_chunks,
                    COUNT(DISTINCT document_id) as total_documents
                FROM ai.document_vectors
                WHERE collection = $1
                "#,
            )
            .bind(coll)
            .fetch_one(pool.inner())
            .await
        } else {
            sqlx::query_as::<_, StatsRow>(
                r#"
                SELECT
                    COUNT(*) as total_chunks,
                    COUNT(DISTINCT document_id) as total_documents
                FROM ai.document_vectors
                "#,
            )
            .fetch_one(pool.inner())
            .await
        }
        .map_err(|e| Error::Internal(format!("Failed to get stats: {}", e)))?;

        Ok(VectorStats {
            total_chunks: row.total_chunks.unwrap_or(0),
            total_documents: row.total_documents.unwrap_or(0),
        })
    }

    // ── Collection CRUD ──────────────────────────────────────────

    /// Create a new collection.
    pub async fn create_collection(
        pool: &DatabasePool,
        name: &str,
        description: Option<&str>,
    ) -> Result<Collection> {
        let row = sqlx::query_as::<_, Collection>(
            r#"
            INSERT INTO ai.collections (name, description)
            VALUES ($1, $2)
            RETURNING name, description, created_at, updated_at
            "#,
        )
        .bind(name)
        .bind(description)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| match e {
            sqlx::Error::Database(ref db_err) if db_err.is_unique_violation() => {
                Error::Conflict(format!("Collection '{}' already exists", name))
            },
            _ => Error::Internal(format!("Failed to create collection: {}", e)),
        })?;

        Ok(row)
    }

    /// List all collections with aggregated stats.
    pub async fn list_collections(pool: &DatabasePool) -> Result<Vec<CollectionWithStats>> {
        let rows = sqlx::query_as::<_, CollectionWithStatsRow>(
            r#"
            SELECT
                c.name,
                c.description,
                COUNT(DISTINCT dv.document_id) AS documents_count,
                COUNT(dv.id) AS chunks_count,
                COALESCE(SUM(LENGTH(dv.content)), 0) AS size_bytes,
                c.created_at,
                c.updated_at
            FROM ai.collections c
            LEFT JOIN ai.document_vectors dv ON dv.collection = c.name
            GROUP BY c.name, c.description, c.created_at, c.updated_at
            ORDER BY c.created_at
            "#,
        )
        .fetch_all(pool.inner())
        .await
        .map_err(|e| Error::Internal(format!("Failed to list collections: {}", e)))?;

        Ok(rows
            .into_iter()
            .map(|r| CollectionWithStats {
                name: r.name,
                description: r.description,
                documents_count: r.documents_count.unwrap_or(0),
                chunks_count: r.chunks_count.unwrap_or(0),
                size_bytes: r.size_bytes.unwrap_or(0),
                created_at: r.created_at.to_rfc3339(),
                updated_at: r.updated_at.to_rfc3339(),
            })
            .collect())
    }

    /// Get a single collection with stats.
    pub async fn get_collection(pool: &DatabasePool, name: &str) -> Result<CollectionWithStats> {
        let row = sqlx::query_as::<_, CollectionWithStatsRow>(
            r#"
            SELECT
                c.name,
                c.description,
                COUNT(DISTINCT dv.document_id) AS documents_count,
                COUNT(dv.id) AS chunks_count,
                COALESCE(SUM(LENGTH(dv.content)), 0) AS size_bytes,
                c.created_at,
                c.updated_at
            FROM ai.collections c
            LEFT JOIN ai.document_vectors dv ON dv.collection = c.name
            WHERE c.name = $1
            GROUP BY c.name, c.description, c.created_at, c.updated_at
            "#,
        )
        .bind(name)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| Error::Internal(format!("Failed to get collection: {}", e)))?
        .ok_or_else(|| Error::NotFound(format!("Collection '{}' not found", name)))?;

        Ok(CollectionWithStats {
            name: row.name,
            description: row.description,
            documents_count: row.documents_count.unwrap_or(0),
            chunks_count: row.chunks_count.unwrap_or(0),
            size_bytes: row.size_bytes.unwrap_or(0),
            created_at: row.created_at.to_rfc3339(),
            updated_at: row.updated_at.to_rfc3339(),
        })
    }

    /// Delete a collection (CASCADE removes all its vectors).
    pub async fn delete_collection(pool: &DatabasePool, name: &str) -> Result<()> {
        let result = sqlx::query("DELETE FROM ai.collections WHERE name = $1")
            .bind(name)
            .execute(pool.inner())
            .await
            .map_err(|e| Error::Internal(format!("Failed to delete collection: {}", e)))?;

        if result.rows_affected() == 0 {
            return Err(Error::NotFound(format!("Collection '{}' not found", name)));
        }

        Ok(())
    }

    /// Get detailed stats for a single collection.
    pub async fn get_collection_stats(
        pool: &DatabasePool,
        name: &str,
    ) -> Result<CollectionStatsDetail> {
        // First verify the collection exists
        let exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM ai.collections WHERE name = $1)",
        )
        .bind(name)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| Error::Internal(format!("Failed to check collection: {}", e)))?;

        if !exists {
            return Err(Error::NotFound(format!("Collection '{}' not found", name)));
        }

        let row = sqlx::query_as::<_, CollectionStatsDetailRow>(
            r#"
            SELECT
                COUNT(DISTINCT document_id) AS documents_count,
                COUNT(*) AS chunks_count,
                COALESCE(SUM(LENGTH(content)), 0) AS size_bytes,
                COALESCE(AVG(LENGTH(content)), 0)::BIGINT AS avg_chunk_size,
                MAX(created_at) AS last_indexed
            FROM ai.document_vectors
            WHERE collection = $1
            "#,
        )
        .bind(name)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| Error::Internal(format!("Failed to get collection stats: {}", e)))?;

        Ok(CollectionStatsDetail {
            name: name.to_string(),
            documents_count: row.documents_count.unwrap_or(0),
            chunks_count: row.chunks_count.unwrap_or(0),
            size_bytes: row.size_bytes.unwrap_or(0),
            avg_chunk_size: row.avg_chunk_size.unwrap_or(0),
            last_indexed: row.last_indexed.map(|t| t.to_rfc3339()),
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
    pub collection: String,
    pub security_tags: Option<serde_json::Value>,
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
    security_tags: Option<serde_json::Value>,
}

/// Internal row type for stats.
#[derive(sqlx::FromRow)]
struct StatsRow {
    total_chunks: Option<i64>,
    total_documents: Option<i64>,
}

/// Internal row for collection list with stats.
#[derive(sqlx::FromRow)]
struct CollectionWithStatsRow {
    name: String,
    description: Option<String>,
    documents_count: Option<i64>,
    chunks_count: Option<i64>,
    size_bytes: Option<i64>,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
}

/// Internal row for detailed collection stats.
#[derive(sqlx::FromRow)]
struct CollectionStatsDetailRow {
    documents_count: Option<i64>,
    chunks_count: Option<i64>,
    size_bytes: Option<i64>,
    avg_chunk_size: Option<i64>,
    last_indexed: Option<chrono::DateTime<chrono::Utc>>,
}
