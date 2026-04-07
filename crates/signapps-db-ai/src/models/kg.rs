//! Knowledge Graph models for LightRAG.
//!
//! Entities, relations, and communities forming a graph-based
//! retrieval structure for enhanced RAG.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

/// A knowledge graph entity (person, concept, organization, etc.).
///
/// Entities are extracted from documents by LLM and stored with their
/// embeddings for vector similarity search.
///
/// # Examples
///
/// ```
/// // Entities are created via KgRepository::upsert_entity
/// // and retrieved with search_entities or get_entity_with_neighbors.
/// ```
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct KgEntity {
    /// Unique entity identifier (UUID v4).
    pub id: Uuid,
    /// Knowledge base collection this entity belongs to.
    pub collection: String,
    /// Entity name as extracted by the LLM.
    pub name: String,
    /// Entity type (person, organization, concept, technology, location, event, etc.).
    pub entity_type: String,
    /// LLM-generated description of the entity.
    pub description: Option<String>,
    /// Document IDs that mention this entity.
    pub source_document_ids: Vec<Uuid>,
    /// Additional structured attributes as JSON.
    pub attributes: serde_json::Value,
    /// How many times this entity has been referenced across documents.
    pub mention_count: i32,
    /// Timestamp when the entity was first created.
    pub created_at: DateTime<Utc>,
    /// Timestamp of the last update (incremented on each mention).
    pub updated_at: DateTime<Utc>,
}

/// A relation between two knowledge graph entities.
///
/// Relations are directional edges in the knowledge graph, connecting
/// a source entity to a target entity via a typed relation.
///
/// # Examples
///
/// ```
/// // Relations are created via KgRepository::create_relation.
/// ```
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct KgRelation {
    /// Unique relation identifier (UUID v4).
    pub id: Uuid,
    /// Knowledge base collection this relation belongs to.
    pub collection: String,
    /// ID of the source entity.
    pub source_entity_id: Uuid,
    /// ID of the target entity.
    pub target_entity_id: Uuid,
    /// Relation type (works_at, depends_on, implements, etc.).
    pub relation_type: String,
    /// LLM-generated description of the relation.
    pub description: Option<String>,
    /// Relation strength weight (higher = stronger association).
    pub weight: f32,
    /// Document IDs where this relation was extracted.
    pub source_document_ids: Vec<Uuid>,
    /// Additional structured attributes as JSON.
    pub attributes: serde_json::Value,
    /// Timestamp when the relation was created.
    pub created_at: DateTime<Utc>,
}

/// A community (cluster) of related entities.
///
/// Communities are detected via graph algorithms and represent
/// thematic clusters for global-level RAG retrieval.
///
/// # Examples
///
/// ```
/// // Communities are created via KgRepository::create_community.
/// ```
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct KgCommunity {
    /// Unique community identifier (UUID v4).
    pub id: Uuid,
    /// Knowledge base collection this community belongs to.
    pub collection: String,
    /// Hierarchy level: 0 = finest granularity, higher = coarser clusters.
    pub level: i32,
    /// LLM-generated community title.
    pub title: Option<String>,
    /// LLM-generated community summary used for global retrieval.
    pub summary: Option<String>,
    /// IDs of entities belonging to this community.
    pub entity_ids: Vec<Uuid>,
    /// Timestamp when the community was created.
    pub created_at: DateTime<Utc>,
}

/// Request to create or upsert a knowledge graph entity.
///
/// If an entity with the same (collection, name, entity_type) already exists,
/// `mention_count` is incremented and `source_document_id` is appended.
///
/// # Examples
///
/// ```
/// let input = UpsertEntity {
///     name: "Rust".to_string(),
///     entity_type: "technology".to_string(),
///     description: Some("Systems programming language".to_string()),
///     source_document_id: None,
///     attributes: None,
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpsertEntity {
    /// Entity name as extracted by the LLM.
    pub name: String,
    /// Entity type (person, organization, concept, technology, location, event, etc.).
    pub entity_type: String,
    /// LLM-generated description of the entity.
    pub description: Option<String>,
    /// ID of the source document where this entity was found.
    pub source_document_id: Option<Uuid>,
    /// Additional structured attributes as JSON.
    pub attributes: Option<serde_json::Value>,
}

/// Request to create a relation between two entities.
///
/// On conflict (same collection + source + target + type), the weight is
/// maximised and source document IDs are merged.
///
/// # Examples
///
/// ```
/// let input = CreateRelation {
///     source_entity_id: source_id,
///     target_entity_id: target_id,
///     relation_type: "depends_on".to_string(),
///     description: None,
///     weight: Some(0.9),
///     source_document_id: None,
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRelation {
    /// ID of the source entity.
    pub source_entity_id: Uuid,
    /// ID of the target entity.
    pub target_entity_id: Uuid,
    /// Relation type (works_at, depends_on, implements, etc.).
    pub relation_type: String,
    /// LLM-generated description of the relation.
    pub description: Option<String>,
    /// Relation weight/strength (defaults to 1.0).
    pub weight: Option<f32>,
    /// ID of the source document where this relation was found.
    pub source_document_id: Option<Uuid>,
}

/// An entity together with all its direct neighbors (for local context building).
///
/// Used by the local retrieval path of LightRAG to provide rich context
/// around a matched entity.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityWithNeighbors {
    /// The central entity.
    pub entity: KgEntity,
    /// All relations where this entity is source or target.
    pub relations: Vec<KgRelation>,
    /// All entities connected via those relations.
    pub neighbors: Vec<KgEntity>,
}

/// Knowledge graph statistics for a collection.
///
/// # Examples
///
/// ```
/// // Retrieved via KgRepository::get_stats
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KgStats {
    /// Total number of entities in the collection.
    pub entities: i64,
    /// Total number of relations in the collection.
    pub relations: i64,
    /// Total number of communities in the collection.
    pub communities: i64,
}
