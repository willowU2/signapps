//! Knowledge Graph repository for LightRAG.
//!
//! Provides CRUD and vector-similarity search operations for entities,
//! relations, and communities that form the LightRAG knowledge graph.

use crate::models::kg::{
    CreateRelation, EntityWithNeighbors, KgCommunity, KgEntity, KgRelation, KgStats, UpsertEntity,
};
use signapps_db_shared::DatabasePool;
use pgvector::Vector;
use signapps_common::{Error, Result};
use uuid::Uuid;

type EntityRow = (
    Uuid,
    String,
    String,
    String,
    Option<String>,
    Vec<Uuid>,
    serde_json::Value,
    i32,
    chrono::DateTime<chrono::Utc>,
    chrono::DateTime<chrono::Utc>,
    f32,
);

type RelationRow = (
    Uuid,
    String,
    Uuid,
    Uuid,
    String,
    Option<String>,
    f32,
    Vec<Uuid>,
    serde_json::Value,
    chrono::DateTime<chrono::Utc>,
    f32,
);

/// Repository for LightRAG knowledge graph operations.
pub struct KgRepository;

impl KgRepository {
    /// Upsert an entity (insert or update on conflict).
    ///
    /// If an entity with the same (collection, name, entity_type) already exists,
    /// `mention_count` is incremented and `source_document_ids` is extended.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the SQL query fails.
    ///
    /// # Panics
    ///
    /// No panics possible — all errors are propagated via `Result`.
    pub async fn upsert_entity(
        pool: &DatabasePool,
        collection: &str,
        input: UpsertEntity,
        embedding: &[f32],
    ) -> Result<KgEntity> {
        let vec = Vector::from(embedding.to_vec());
        let entity = sqlx::query_as::<_, KgEntity>(
            r#"
            INSERT INTO ai.kg_entities
                (collection, name, entity_type, description, source_document_ids, attributes, embedding)
            VALUES (
                $1, $2, $3, $4,
                CASE WHEN $5::uuid IS NOT NULL THEN ARRAY[$5::uuid] ELSE '{}'::uuid[] END,
                COALESCE($6, '{}'::jsonb),
                $7
            )
            ON CONFLICT (collection, name, entity_type) DO UPDATE SET
                description        = COALESCE(EXCLUDED.description, ai.kg_entities.description),
                mention_count      = ai.kg_entities.mention_count + 1,
                source_document_ids = array_cat(
                    ai.kg_entities.source_document_ids,
                    EXCLUDED.source_document_ids
                ),
                embedding  = EXCLUDED.embedding,
                updated_at = now()
            RETURNING
                id, collection, name, entity_type, description,
                source_document_ids, attributes, mention_count,
                created_at, updated_at
            "#,
        )
        .bind(collection)
        .bind(&input.name)
        .bind(&input.entity_type)
        .bind(&input.description)
        .bind(input.source_document_id)
        .bind(&input.attributes)
        .bind(vec)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(entity)
    }

    /// Create a relation between two entities.
    ///
    /// On conflict (same collection + source + target + type), the weight is
    /// updated to `GREATEST(existing, new)` and source document IDs are merged.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the SQL query fails.
    ///
    /// # Panics
    ///
    /// No panics possible — all errors are propagated via `Result`.
    pub async fn create_relation(
        pool: &DatabasePool,
        collection: &str,
        input: CreateRelation,
        embedding: &[f32],
    ) -> Result<KgRelation> {
        let vec = Vector::from(embedding.to_vec());
        let relation = sqlx::query_as::<_, KgRelation>(
            r#"
            INSERT INTO ai.kg_relations
                (collection, source_entity_id, target_entity_id, relation_type,
                 description, weight, source_document_ids, embedding)
            VALUES (
                $1, $2, $3, $4, $5,
                COALESCE($6, 1.0),
                CASE WHEN $7::uuid IS NOT NULL THEN ARRAY[$7::uuid] ELSE '{}'::uuid[] END,
                $8
            )
            ON CONFLICT (collection, source_entity_id, target_entity_id, relation_type)
            DO UPDATE SET
                description         = COALESCE(EXCLUDED.description, ai.kg_relations.description),
                weight              = GREATEST(ai.kg_relations.weight, EXCLUDED.weight),
                source_document_ids = array_cat(
                    ai.kg_relations.source_document_ids,
                    EXCLUDED.source_document_ids
                )
            RETURNING
                id, collection, source_entity_id, target_entity_id,
                relation_type, description, weight, source_document_ids,
                attributes, created_at
            "#,
        )
        .bind(collection)
        .bind(input.source_entity_id)
        .bind(input.target_entity_id)
        .bind(&input.relation_type)
        .bind(&input.description)
        .bind(input.weight)
        .bind(input.source_document_id)
        .bind(vec)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(relation)
    }

    /// Search entities by embedding similarity (local retrieval path).
    ///
    /// Returns entities with cosine similarity above `score_threshold`,
    /// ordered by descending similarity, limited to `top_k` results.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the SQL query fails.
    ///
    /// # Panics
    ///
    /// No panics possible — all errors are propagated via `Result`.
    pub async fn search_entities(
        pool: &DatabasePool,
        collection: &str,
        query_embedding: &[f32],
        top_k: i64,
        score_threshold: f32,
    ) -> Result<Vec<(KgEntity, f32)>> {
        let vec = Vector::from(query_embedding.to_vec());

        let rows: Vec<EntityRow> = sqlx::query_as(
            r#"
            SELECT
                id, collection, name, entity_type, description,
                source_document_ids, attributes, mention_count,
                created_at, updated_at,
                (1.0 - (embedding <=> $1))::real AS score
            FROM ai.kg_entities
            WHERE collection = $2
              AND embedding IS NOT NULL
              AND (1.0 - (embedding <=> $1))::real > $4
            ORDER BY embedding <=> $1
            LIMIT $3
            "#,
        )
        .bind(vec)
        .bind(collection)
        .bind(top_k)
        .bind(score_threshold)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(|r| {
                let entity = KgEntity {
                    id: r.0,
                    collection: r.1,
                    name: r.2,
                    entity_type: r.3,
                    description: r.4,
                    source_document_ids: r.5,
                    attributes: r.6,
                    mention_count: r.7,
                    created_at: r.8,
                    updated_at: r.9,
                };
                (entity, r.10)
            })
            .collect())
    }

    /// Search relations by embedding similarity.
    ///
    /// Returns relations with cosine similarity above `score_threshold`,
    /// ordered by descending similarity, limited to `top_k` results.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the SQL query fails.
    ///
    /// # Panics
    ///
    /// No panics possible — all errors are propagated via `Result`.
    pub async fn search_relations(
        pool: &DatabasePool,
        collection: &str,
        query_embedding: &[f32],
        top_k: i64,
        score_threshold: f32,
    ) -> Result<Vec<(KgRelation, f32)>> {
        let vec = Vector::from(query_embedding.to_vec());

        let rows: Vec<RelationRow> = sqlx::query_as(
            r#"
            SELECT
                id, collection, source_entity_id, target_entity_id,
                relation_type, description, weight,
                source_document_ids, attributes, created_at,
                (1.0 - (embedding <=> $1))::real AS score
            FROM ai.kg_relations
            WHERE collection = $2
              AND embedding IS NOT NULL
              AND (1.0 - (embedding <=> $1))::real > $4
            ORDER BY embedding <=> $1
            LIMIT $3
            "#,
        )
        .bind(vec)
        .bind(collection)
        .bind(top_k)
        .bind(score_threshold)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(|r| {
                let rel = KgRelation {
                    id: r.0,
                    collection: r.1,
                    source_entity_id: r.2,
                    target_entity_id: r.3,
                    relation_type: r.4,
                    description: r.5,
                    weight: r.6,
                    source_document_ids: r.7,
                    attributes: r.8,
                    created_at: r.9,
                };
                (rel, r.10)
            })
            .collect())
    }

    /// Get an entity with all its direct neighbors (for local context building).
    ///
    /// Retrieves the entity, all its relations (as source or target), and
    /// the neighboring entities reachable through those relations.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if any SQL query fails, including
    /// `sqlx::Error::RowNotFound` when the entity does not exist.
    ///
    /// # Panics
    ///
    /// No panics possible — all errors are propagated via `Result`.
    pub async fn get_entity_with_neighbors(
        pool: &DatabasePool,
        entity_id: Uuid,
    ) -> Result<EntityWithNeighbors> {
        let entity = sqlx::query_as::<_, KgEntity>(
            r#"
            SELECT id, collection, name, entity_type, description,
                   source_document_ids, attributes, mention_count,
                   created_at, updated_at
            FROM ai.kg_entities
            WHERE id = $1
            "#,
        )
        .bind(entity_id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        let relations = sqlx::query_as::<_, KgRelation>(
            r#"
            SELECT id, collection, source_entity_id, target_entity_id,
                   relation_type, description, weight,
                   source_document_ids, attributes, created_at
            FROM ai.kg_relations
            WHERE source_entity_id = $1 OR target_entity_id = $1
            ORDER BY weight DESC
            LIMIT 50
            "#,
        )
        .bind(entity_id)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        let neighbor_ids: Vec<Uuid> = relations
            .iter()
            .map(|r| {
                if r.source_entity_id == entity_id {
                    r.target_entity_id
                } else {
                    r.source_entity_id
                }
            })
            .collect();

        let neighbors = if neighbor_ids.is_empty() {
            vec![]
        } else {
            sqlx::query_as::<_, KgEntity>(
                r#"
                SELECT id, collection, name, entity_type, description,
                       source_document_ids, attributes, mention_count,
                       created_at, updated_at
                FROM ai.kg_entities
                WHERE id = ANY($1)
                "#,
            )
            .bind(&neighbor_ids)
            .fetch_all(pool.inner())
            .await
            .map_err(|e| Error::Database(e.to_string()))?
        };

        Ok(EntityWithNeighbors {
            entity,
            relations,
            neighbors,
        })
    }

    /// Save a community (cluster of related entities).
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the SQL query fails.
    ///
    /// # Panics
    ///
    /// No panics possible — all errors are propagated via `Result`.
    pub async fn create_community(
        pool: &DatabasePool,
        collection: &str,
        level: i32,
        title: &str,
        summary: &str,
        entity_ids: &[Uuid],
        embedding: &[f32],
    ) -> Result<KgCommunity> {
        let vec = Vector::from(embedding.to_vec());
        let community = sqlx::query_as::<_, KgCommunity>(
            r#"
            INSERT INTO ai.kg_communities
                (collection, level, title, summary, entity_ids, embedding)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, collection, level, title, summary, entity_ids, created_at
            "#,
        )
        .bind(collection)
        .bind(level)
        .bind(title)
        .bind(summary)
        .bind(entity_ids)
        .bind(vec)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(community)
    }

    /// Search communities by embedding similarity (global retrieval path).
    ///
    /// Returns communities ordered by cosine similarity to the query embedding,
    /// limited to `top_k` results.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the SQL query fails.
    ///
    /// # Panics
    ///
    /// No panics possible — all errors are propagated via `Result`.
    pub async fn search_communities(
        pool: &DatabasePool,
        collection: &str,
        query_embedding: &[f32],
        top_k: i64,
    ) -> Result<Vec<KgCommunity>> {
        let vec = Vector::from(query_embedding.to_vec());
        let communities = sqlx::query_as::<_, KgCommunity>(
            r#"
            SELECT id, collection, level, title, summary, entity_ids, created_at
            FROM ai.kg_communities
            WHERE collection = $2
              AND embedding IS NOT NULL
            ORDER BY embedding <=> $1
            LIMIT $3
            "#,
        )
        .bind(vec)
        .bind(collection)
        .bind(top_k)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(communities)
    }

    /// Get graph statistics for a collection.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if any SQL query fails.
    ///
    /// # Panics
    ///
    /// No panics possible — all errors are propagated via `Result`.
    pub async fn get_stats(pool: &DatabasePool, collection: &str) -> Result<KgStats> {
        let (entities,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM ai.kg_entities WHERE collection = $1")
                .bind(collection)
                .fetch_one(pool.inner())
                .await
                .map_err(|e| Error::Database(e.to_string()))?;

        let (relations,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM ai.kg_relations WHERE collection = $1")
                .bind(collection)
                .fetch_one(pool.inner())
                .await
                .map_err(|e| Error::Database(e.to_string()))?;

        let (communities,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM ai.kg_communities WHERE collection = $1")
                .bind(collection)
                .fetch_one(pool.inner())
                .await
                .map_err(|e| Error::Database(e.to_string()))?;

        Ok(KgStats {
            entities,
            relations,
            communities,
        })
    }

    /// Delete all knowledge graph data for a collection.
    ///
    /// Deletes communities, relations, and entities in dependency order.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if any SQL query fails.
    ///
    /// # Panics
    ///
    /// No panics possible — all errors are propagated via `Result`.
    pub async fn delete_collection(pool: &DatabasePool, collection: &str) -> Result<()> {
        sqlx::query("DELETE FROM ai.kg_communities WHERE collection = $1")
            .bind(collection)
            .execute(pool.inner())
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        sqlx::query("DELETE FROM ai.kg_relations WHERE collection = $1")
            .bind(collection)
            .execute(pool.inner())
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        sqlx::query("DELETE FROM ai.kg_entities WHERE collection = $1")
            .bind(collection)
            .execute(pool.inner())
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(())
    }
}
