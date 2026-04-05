//! LightRAG API handlers.
//!
//! Provides HTTP endpoints for indexing documents into the LightRAG knowledge
//! graph and querying it with dual-level (local + global) retrieval.
//!
//! These types define the request/response contracts for the LightRAG routes.
//! The actual handler functions are wired in `main.rs` once AppState is fully
//! constructed, following the pattern used by the rest of the AI service.

use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use signapps_common::{Claims, Error, Result};
use uuid::Uuid;

use crate::llm::types::ChatMessage;
use crate::rag::lightrag::{build_communities, IndexResult, LightRagConfig, LightRagResult};
use crate::AppState;

/// Request to index a document into the knowledge graph.
///
/// # Examples
///
/// ```json
/// {
///   "collection": "default",
///   "document_id": "550e8400-e29b-41d4-a716-446655440000",
///   "text": "Alice works at Acme Corp. Acme Corp develops Rust tooling."
/// }
/// ```
#[derive(Debug, Deserialize)]
pub struct IndexRequest {
    /// Knowledge base collection (defaults to `"default"`).
    pub collection: Option<String>,
    /// Optional stable document ID for deduplication. A random UUID is used if absent.
    pub document_id: Option<String>,
    /// The document text to index.
    pub text: String,
}

/// Request to query the knowledge graph.
///
/// # Examples
///
/// ```json
/// {
///   "collection": "default",
///   "question": "Where does Alice work?",
///   "config": { "entity_top_k": 5, "score_threshold": 0.5 }
/// }
/// ```
#[derive(Debug, Deserialize)]
pub struct QueryRequest {
    /// Knowledge base collection (defaults to `"default"`).
    pub collection: Option<String>,
    /// The natural-language question to answer.
    pub question: String,
    /// Optional pipeline configuration overrides.
    pub config: Option<LightRagConfig>,
}

/// Response for a successful document index operation.
#[derive(Debug, Serialize)]
pub struct IndexResponse {
    /// Always `true` on success.
    pub success: bool,
    /// Index operation statistics.
    pub result: IndexResult,
}

/// Response for a successful knowledge graph query.
#[derive(Debug, Serialize)]
pub struct QueryResponse {
    /// Always `true` on success.
    pub success: bool,
    /// Query result including the answer and retrieval context.
    pub result: LightRagResult,
}

/// Response for graph statistics.
#[derive(Debug, Serialize)]
pub struct StatsResponse {
    /// The collection that was queried.
    pub collection: String,
    /// Total number of entities.
    pub entities: i64,
    /// Total number of relations.
    pub relations: i64,
    /// Total number of communities.
    pub communities: i64,
}

/// Response for a seed operation.
#[derive(Debug, Serialize)]
pub struct SeedResponse {
    /// Always `true` on success.
    pub success: bool,
    /// Total entities created across all sources.
    pub entities_created: usize,
    /// Total relations created across all sources.
    pub relations_created: usize,
    /// Number of data sources seeded.
    pub sources: usize,
}

/// POST /api/v1/ai/lightrag/index — Index a document into the knowledge graph.
///
/// Extracts entities and relations from the provided text using an LLM, then
/// stores them in the `ai.kg_entities` and `ai.kg_relations` tables with vector
/// embeddings for similarity search.
///
/// # Errors
///
/// Returns `500 Internal Server Error` if the embedding or LLM call fails, or
/// if the database write fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip_all)]
pub async fn lightrag_index(
    State(state): State<AppState>,
    Json(req): Json<IndexRequest>,
) -> Result<Json<IndexResponse>> {
    let collection = req.collection.unwrap_or_else(|| "default".to_string());
    let document_id = req
        .document_id
        .as_deref()
        .and_then(|s| Uuid::parse_str(s).ok())
        .unwrap_or_else(Uuid::new_v4);

    let config = LightRagConfig::default();

    let embed_client = state.embeddings.clone();
    let embed_fn = move |text: String| {
        let client = embed_client.clone();
        async move { client.embed(&text).await }
    };

    let providers = state.providers.clone();
    let llm_fn = move |prompt: String, temperature: f32| {
        let registry = providers.clone();
        async move {
            let provider = registry
                .get_default()
                .map_err(|e| signapps_common::Error::Internal(format!("No LLM provider: {e}")))?;
            let response = provider
                .chat(
                    vec![ChatMessage::user(prompt)],
                    None,
                    None,
                    Some(temperature),
                )
                .await?;
            response
                .choices
                .into_iter()
                .next()
                .map(|c| c.message.content)
                .ok_or_else(|| {
                    signapps_common::Error::Internal("LLM returned no choices".to_string())
                })
        }
    };

    let result = crate::rag::lightrag::index_document(
        &state.pool,
        &collection,
        document_id,
        &req.text,
        &config,
        embed_fn,
        llm_fn,
    )
    .await?;

    Ok(Json(IndexResponse {
        success: true,
        result,
    }))
}

/// POST /api/v1/ai/lightrag/query — Query the knowledge graph.
///
/// Embeds the question, retrieves relevant entities (local search) and
/// relations (global search), then uses the LLM to synthesise an answer
/// grounded in the knowledge graph context.
///
/// # Errors
///
/// Returns an error if the embedding or LLM call fails, or if the database
/// query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip_all)]
pub async fn lightrag_query(
    State(state): State<AppState>,
    Json(req): Json<QueryRequest>,
) -> Result<Json<QueryResponse>> {
    let collection = req.collection.unwrap_or_else(|| "default".to_string());
    let config = req.config.unwrap_or_default();

    let embed_client = state.embeddings.clone();
    let embed_fn = move |text: String| {
        let client = embed_client.clone();
        async move { client.embed(&text).await }
    };

    let providers = state.providers.clone();
    let llm_fn = move |prompt: String, temperature: f32| {
        let registry = providers.clone();
        async move {
            let provider = registry
                .get_default()
                .map_err(|e| signapps_common::Error::Internal(format!("No LLM provider: {e}")))?;
            let response = provider
                .chat(
                    vec![ChatMessage::user(prompt)],
                    None,
                    None,
                    Some(temperature),
                )
                .await?;
            response
                .choices
                .into_iter()
                .next()
                .map(|c| c.message.content)
                .ok_or_else(|| {
                    signapps_common::Error::Internal("LLM returned no choices".to_string())
                })
        }
    };

    let result = crate::rag::lightrag::query(
        &state.pool,
        &collection,
        &req.question,
        &config,
        embed_fn,
        llm_fn,
    )
    .await?;

    Ok(Json(QueryResponse {
        success: true,
        result,
    }))
}

/// GET /api/v1/ai/lightrag/stats — Get knowledge graph statistics.
///
/// Returns entity, relation, and community counts for the `"default"`
/// collection.
///
/// # Errors
///
/// Returns an error if the database query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip_all)]
pub async fn lightrag_stats(
    State(state): State<AppState>,
) -> Result<Json<StatsResponse>> {
    let stats =
        signapps_db::repositories::KgRepository::get_stats(&state.pool, "default").await?;

    Ok(Json(StatsResponse {
        collection: "default".to_string(),
        entities: stats.entities,
        relations: stats.relations,
        communities: stats.communities,
    }))
}

/// Request to build communities from the knowledge graph.
///
/// # Examples
///
/// ```json
/// { "collection": "default" }
/// ```
#[derive(Debug, Deserialize)]
pub struct CommunityRequest {
    /// Knowledge base collection (defaults to `"default"`).
    pub collection: Option<String>,
}

/// Response for a community detection operation.
#[derive(Debug, Serialize)]
pub struct CommunityResponse {
    /// Always `true` on success.
    pub success: bool,
    /// Number of communities created.
    pub communities_created: usize,
    /// Collection that was processed.
    pub collection: String,
}

/// POST /api/v1/ai/lightrag/communities — Build communities from entity clusters.
///
/// Runs connected component analysis on the knowledge graph for the given
/// collection, then persists each component with `>= 2` entities as a community
/// with a vector embedding. Idempotent: re-running will insert additional
/// community rows; callers may wish to truncate `ai.kg_communities` first.
///
/// # Errors
///
/// Returns `500 Internal Server Error` if entity/relation loading, embedding,
/// or the community insert fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip_all)]
pub async fn lightrag_communities(
    State(state): State<AppState>,
    Json(req): Json<CommunityRequest>,
) -> Result<Json<CommunityResponse>> {
    let collection = req.collection.unwrap_or_else(|| "default".to_string());

    let embed_client = state.embeddings.clone();
    let embed_fn = move |text: String| {
        let client = embed_client.clone();
        async move { client.embed(&text).await }
    };

    let count = build_communities(&state.pool, &collection, embed_fn).await?;

    Ok(Json(CommunityResponse {
        success: true,
        communities_created: count,
        collection,
    }))
}

/// GET /api/v1/ai/lightrag/graph — Get entity and relation data for graph visualization.
///
/// Returns the top 50 entities (ordered by mention count) and the relations
/// between them, with pre-computed circular layout positions suitable for
/// SVG rendering on the frontend.
///
/// # Errors
///
/// Returns `500 Internal Server Error` if the database query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip_all)]
pub async fn lightrag_graph(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>> {
    // Fetch top 50 entities ordered by relevance
    let entities: Vec<(Uuid, String, String, Option<String>)> = sqlx::query_as(
        "SELECT id, name, entity_type, description \
         FROM ai.kg_entities \
         WHERE collection = 'default' \
         ORDER BY mention_count DESC \
         LIMIT 50",
    )
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!(?e, "Failed to fetch kg_entities for graph");
        Error::Internal(format!("DB query failed: {e}"))
    })?;

    let entity_ids: Vec<Uuid> = entities.iter().map(|(id, _, _, _)| *id).collect();

    let relations: Vec<(Uuid, Uuid, String)> = if !entity_ids.is_empty() {
        sqlx::query_as(
            "SELECT source_entity_id, target_entity_id, relation_type \
             FROM ai.kg_relations \
             WHERE collection = 'default' \
               AND source_entity_id = ANY($1) \
               AND target_entity_id = ANY($1) \
             LIMIT 200",
        )
        .bind(&entity_ids)
        .fetch_all(state.pool.inner())
        .await
        .unwrap_or_default()
    } else {
        vec![]
    };

    let total = entities.len().max(1);
    let nodes: Vec<serde_json::Value> = entities
        .iter()
        .enumerate()
        .map(|(i, (id, name, etype, desc))| {
            let angle = 2.0 * std::f64::consts::PI * i as f64 / total as f64;
            serde_json::json!({
                "id": id,
                "name": name,
                "type": etype,
                "description": desc,
                "x": 300.0 + 200.0 * angle.cos(),
                "y": 200.0 + 150.0 * angle.sin(),
            })
        })
        .collect();

    let edges: Vec<serde_json::Value> = relations
        .iter()
        .map(|(src, tgt, rtype)| {
            serde_json::json!({
                "source": src,
                "target": tgt,
                "type": rtype,
            })
        })
        .collect();

    Ok(Json(serde_json::json!({ "nodes": nodes, "edges": edges })))
}

/// POST /api/v1/ai/lightrag/seed — Trigger a manual full seed from signapps data.
///
/// Populates the knowledge graph from all existing structured data (users,
/// org nodes, groups, calendar events, documents, etc.) without consuming LLM
/// tokens — embeddings only.
///
/// # Errors
///
/// Returns an error if any seeder SQL query or embedding call fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip_all)]
pub async fn lightrag_seed(
    State(state): State<AppState>,
) -> Result<Json<SeedResponse>> {
    let embed_client = state.embeddings.clone();
    let embed_fn = move |text: String| {
        let client = embed_client.clone();
        async move { client.embed(&text).await }
    };

    let results =
        crate::rag::lightrag_seeder::seed_all(&state.pool, "default", embed_fn).await?;

    let entities_created: usize = results.iter().map(|r| r.entities_created).sum();
    let relations_created: usize = results.iter().map(|r| r.relations_created).sum();
    let sources = results.len();

    Ok(Json(SeedResponse {
        success: true,
        entities_created,
        relations_created,
        sources,
    }))
}
