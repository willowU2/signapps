//! LightRAG API handlers.
//!
//! Provides HTTP endpoints for indexing documents into the LightRAG knowledge
//! graph and querying it with dual-level (local + global) retrieval.
//!
//! These types define the request/response contracts for the LightRAG routes.
//! The actual handler functions are wired in `main.rs` once AppState is fully
//! constructed, following the pattern used by the rest of the AI service.

use serde::{Deserialize, Serialize};

use crate::rag::lightrag::{IndexResult, LightRagConfig, LightRagResult};

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

// Note: Handler functions (lightrag_index, lightrag_query, lightrag_stats)
// will be added here once the route wiring in main.rs is ready.
// They follow the standard Axum pattern:
//
//   #[tracing::instrument(skip(state))]
//   pub async fn lightrag_index(
//       State(state): State<AppState>,
//       Json(req): Json<IndexRequest>,
//   ) -> Result<Json<IndexResponse>, AppError> { ... }
//
// See handlers/index.rs for the equivalent standard-RAG implementation.
