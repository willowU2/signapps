//! Multimodal search with Reciprocal Rank Fusion (RRF).
//!
//! Searches both the text vector space (384d) and the multimodal vector space
//! (1024d SigLIP), then fuses results using RRF for a unified ranking.
//! Optionally reranks the fused results with a `RerankerWorker`.

use std::collections::HashMap;
use std::sync::Arc;

use bytes::Bytes;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use signapps_common::Result;
use signapps_db::repositories::{MultimodalVectorRepository, VectorRepository};
use signapps_db::DatabasePool;
use uuid::Uuid;

use crate::embeddings::EmbeddingsClient;
use crate::vectors::VectorService;
use crate::workers::traits::{MultimodalEmbedWorker, RerankerWorker};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Query for unified multimodal search.
#[derive(Debug, Clone, Deserialize)]
pub struct SearchQuery {
    /// The text query to search for.
    pub text: String,
    /// Maximum number of results to return.
    pub limit: usize,
    /// Minimum similarity score threshold (0.0 - 1.0).
    pub score_threshold: Option<f32>,
    /// Optional collections to restrict the search to.
    pub collections: Option<Vec<String>>,
    /// Optional media types to filter multimodal results (e.g. "image", "audio").
    pub media_types: Option<Vec<String>>,
    /// Whether to include multimodal vector space in the search.
    pub include_multimodal: bool,
}

/// Unified search result combining text and multimodal vector spaces.
#[derive(Debug, Clone, Serialize)]
pub struct UnifiedSearchResult {
    /// Chunk ID.
    pub id: Uuid,
    /// Parent document ID.
    pub document_id: Uuid,
    /// Chunk index within the document.
    pub chunk_index: i32,
    /// Text content of the result.
    pub content: String,
    /// Original filename.
    pub filename: String,
    /// File path in storage.
    pub path: String,
    /// MIME type of the original file.
    pub mime_type: Option<String>,
    /// Media type (e.g. "text", "image", "audio", "video").
    pub media_type: Option<String>,
    /// Final fused score (RRF or reranked).
    pub score: f32,
    /// Raw score from the text vector space search.
    pub text_score: Option<f32>,
    /// Raw score from the multimodal vector space search.
    pub multimodal_score: Option<f32>,
    /// Additional metadata.
    pub metadata: Option<Value>,
}

// ---------------------------------------------------------------------------
// Internal merge key
// ---------------------------------------------------------------------------

/// Key used to deduplicate results across search spaces.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct MergeKey {
    document_id: Uuid,
    chunk_index: i32,
}

/// Intermediate result accumulated during RRF fusion.
struct FusionEntry {
    /// Best representative result data.
    id: Uuid,
    document_id: Uuid,
    chunk_index: i32,
    content: String,
    filename: String,
    path: String,
    mime_type: Option<String>,
    media_type: Option<String>,
    metadata: Option<Value>,
    /// Accumulated RRF score.
    rrf_score: f64,
    /// Raw text space score (if present).
    text_score: Option<f32>,
    /// Raw multimodal space score (if present).
    multimodal_score: Option<f32>,
}

// ---------------------------------------------------------------------------
// RRF fusion (free function, testable without async resources)
// ---------------------------------------------------------------------------

/// Fuse text and multimodal search results using Reciprocal Rank Fusion.
///
/// For each result: `rrf_score = sum(1 / (k + rank))` across all lists
/// the result appears in. Results are merged by `(document_id, chunk_index)`,
/// then sorted by fused score descending.
fn rrf_fuse(
    text_results: &[signapps_db::models::VectorSearchResult],
    mm_results: &[signapps_db::models::MultimodalSearchResult],
) -> Vec<UnifiedSearchResult> {
    let mut entries: HashMap<MergeKey, FusionEntry> = HashMap::new();

    // Process text results (already sorted by score descending)
    for (rank, r) in text_results.iter().enumerate() {
        let key = MergeKey {
            document_id: r.document_id,
            chunk_index: r.chunk_index,
        };
        let rrf_contribution = 1.0 / (RRF_K + (rank + 1) as f64);

        entries
            .entry(key)
            .and_modify(|e| {
                e.rrf_score += rrf_contribution;
                e.text_score = Some(r.score);
            })
            .or_insert_with(|| FusionEntry {
                id: r.id,
                document_id: r.document_id,
                chunk_index: r.chunk_index,
                content: r.content.clone(),
                filename: r.filename.clone(),
                path: r.path.clone(),
                mime_type: r.mime_type.clone(),
                media_type: Some("text".to_string()),
                metadata: None,
                rrf_score: rrf_contribution,
                text_score: Some(r.score),
                multimodal_score: None,
            });
    }

    // Process multimodal results (already sorted by score descending)
    for (rank, r) in mm_results.iter().enumerate() {
        let key = MergeKey {
            document_id: r.document_id,
            chunk_index: r.chunk_index,
        };
        let rrf_contribution = 1.0 / (RRF_K + (rank + 1) as f64);

        entries
            .entry(key)
            .and_modify(|e| {
                e.rrf_score += rrf_contribution;
                e.multimodal_score = Some(r.score);
                // Prefer multimodal media_type if present
                e.media_type = Some(r.media_type.clone());
                if e.metadata.is_none() {
                    e.metadata.clone_from(&r.metadata);
                }
            })
            .or_insert_with(|| FusionEntry {
                id: r.id,
                document_id: r.document_id,
                chunk_index: r.chunk_index,
                content: r.content.clone().unwrap_or_default(),
                filename: r.filename.clone(),
                path: r.path.clone(),
                mime_type: r.mime_type.clone(),
                media_type: Some(r.media_type.clone()),
                metadata: r.metadata.clone(),
                rrf_score: rrf_contribution,
                text_score: None,
                multimodal_score: Some(r.score),
            });
    }

    // Sort by RRF score descending
    let mut results: Vec<UnifiedSearchResult> = entries
        .into_values()
        .map(|e| UnifiedSearchResult {
            id: e.id,
            document_id: e.document_id,
            chunk_index: e.chunk_index,
            content: e.content,
            filename: e.filename,
            path: e.path,
            mime_type: e.mime_type,
            media_type: e.media_type,
            score: e.rrf_score as f32,
            text_score: e.text_score,
            multimodal_score: e.multimodal_score,
            metadata: e.metadata,
        })
        .collect();

    results.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    results
}

// ---------------------------------------------------------------------------
// MultimodalSearch
// ---------------------------------------------------------------------------

/// Dual-space search engine that fuses text and multimodal results via RRF.
pub struct MultimodalSearch {
    /// Text embedder for the 384d text vector space.
    text_embedder: EmbeddingsClient,
    /// Text vector service wrapping `ai.document_vectors`.
    vectors: VectorService,
    /// Optional multimodal embedder for the 1024d space.
    mm_embed: Option<Arc<dyn MultimodalEmbedWorker>>,
    /// Optional reranker for post-fusion relevance reranking.
    reranker: Option<Arc<dyn RerankerWorker>>,
    /// Database pool for direct repository access.
    pool: DatabasePool,
}

/// Standard RRF constant (from the original Cormack et al. paper).
const RRF_K: f64 = 60.0;

impl MultimodalSearch {
    /// Create a new multimodal search engine with required dependencies.
    pub fn new(
        text_embedder: EmbeddingsClient,
        vectors: VectorService,
        pool: DatabasePool,
    ) -> Self {
        Self {
            text_embedder,
            vectors,
            mm_embed: None,
            reranker: None,
            pool,
        }
    }

    /// Attach a multimodal embedding worker (SigLIP, 1024d).
    pub fn with_multimodal_embed(mut self, worker: Arc<dyn MultimodalEmbedWorker>) -> Self {
        self.mm_embed = Some(worker);
        self
    }

    /// Attach a reranker worker for post-fusion relevance reranking.
    pub fn with_reranker(mut self, worker: Arc<dyn RerankerWorker>) -> Self {
        self.reranker = Some(worker);
        self
    }

    // ── Dual-space search ──────────────────────────────────────────

    /// Search across text and (optionally) multimodal vector spaces,
    /// fuse results with RRF, and optionally rerank.
    pub async fn search(&self, query: &SearchQuery) -> Result<Vec<UnifiedSearchResult>> {
        // 1. Text space search: embed query -> search document_vectors
        let text_embedding = self.text_embedder.embed(&query.text).await?;

        let text_results = VectorRepository::search(
            &self.pool,
            &text_embedding,
            query.limit as i64,
            query.score_threshold,
            query.collections.as_deref(),
            None, // no security_tags filter in unified search for now
        )
        .await?;

        tracing::debug!(
            text_results = text_results.len(),
            "Text vector space search complete"
        );

        // 2. Multimodal space search (if requested and embedder available)
        let mm_results = if query.include_multimodal {
            if let Some(ref mm) = self.mm_embed {
                let mm_embedding = mm.embed_text(vec![query.text.clone()]).await?;
                if let Some(embedding) = mm_embedding.into_iter().next() {
                    let results = MultimodalVectorRepository::search(
                        &self.pool,
                        &embedding,
                        query.limit as i64,
                        query.score_threshold,
                        query.collections.as_deref(),
                        query.media_types.as_deref(),
                    )
                    .await?;

                    tracing::debug!(
                        mm_results = results.len(),
                        "Multimodal vector space search complete"
                    );

                    results
                } else {
                    tracing::warn!("Multimodal embedder returned no embeddings for query");
                    vec![]
                }
            } else {
                tracing::debug!("Multimodal search requested but no embedder available");
                vec![]
            }
        } else {
            vec![]
        };

        // 3. Fuse with RRF
        let mut fused = self.rrf_fuse(&text_results, &mm_results);

        // 4. Optional reranking
        if let Some(ref reranker) = self.reranker {
            fused = self.rerank(reranker, &query.text, fused).await?;
        }

        // 5. Truncate to requested limit
        fused.truncate(query.limit);

        Ok(fused)
    }

    // ── Image-based search ─────────────────────────────────────────

    /// Search by image in the multimodal vector space only.
    ///
    /// Requires a multimodal embedding worker to be configured.
    pub async fn search_by_image(
        &self,
        image: Bytes,
        limit: usize,
    ) -> Result<Vec<UnifiedSearchResult>> {
        let mm = self.mm_embed.as_ref().ok_or_else(|| {
            signapps_common::Error::Internal(
                "Multimodal embedding worker required for image search".to_string(),
            )
        })?;

        let embeddings = mm.embed_image(vec![image]).await?;
        let embedding = embeddings.into_iter().next().ok_or_else(|| {
            signapps_common::Error::Internal(
                "Multimodal embedder returned no embeddings for image".to_string(),
            )
        })?;

        let results = MultimodalVectorRepository::search(
            &self.pool,
            &embedding,
            limit as i64,
            None,
            None,
            None,
        )
        .await?;

        tracing::debug!(
            results = results.len(),
            "Image-based multimodal search complete"
        );

        Ok(results
            .into_iter()
            .map(|r| UnifiedSearchResult {
                id: r.id,
                document_id: r.document_id,
                chunk_index: r.chunk_index,
                content: r.content.unwrap_or_default(),
                filename: r.filename,
                path: r.path,
                mime_type: r.mime_type,
                media_type: Some(r.media_type),
                score: r.score,
                text_score: None,
                multimodal_score: Some(r.score),
                metadata: r.metadata,
            })
            .collect())
    }

    // ── RRF fusion (delegates to free function) ──────────────────

    /// Fuse text and multimodal search results using Reciprocal Rank Fusion.
    fn rrf_fuse(
        &self,
        text_results: &[signapps_db::models::VectorSearchResult],
        mm_results: &[signapps_db::models::MultimodalSearchResult],
    ) -> Vec<UnifiedSearchResult> {
        rrf_fuse(text_results, mm_results)
    }

    // ── Reranking ──────────────────────────────────────────────────

    /// Rerank fused results using a `RerankerWorker`.
    ///
    /// Sends the content of each result to the reranker alongside the query,
    /// then replaces the RRF score with the reranker's relevance score.
    async fn rerank(
        &self,
        reranker: &Arc<dyn RerankerWorker>,
        query: &str,
        results: Vec<UnifiedSearchResult>,
    ) -> Result<Vec<UnifiedSearchResult>> {
        if results.is_empty() {
            return Ok(results);
        }

        let documents: Vec<String> = results.iter().map(|r| r.content.clone()).collect();
        let reranked = reranker
            .rerank(query, documents, Some(results.len()))
            .await
            .map_err(|e| signapps_common::Error::Internal(format!("Reranking failed: {}", e)))?;

        tracing::debug!(reranked_count = reranked.len(), "Reranking complete");

        // Map reranked scores back to unified results
        let mut reranked_results: Vec<UnifiedSearchResult> = reranked
            .into_iter()
            .filter_map(|rr| {
                results.get(rr.index).map(|original| {
                    let mut result = original.clone();
                    result.score = rr.score;
                    result
                })
            })
            .collect();

        // Sort by reranked score descending
        reranked_results.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        Ok(reranked_results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rrf_single_list() {
        // With a single list of 2 results, RRF scores should be 1/(k+rank)
        // rank 1: 1/(60+1) = 0.01639...
        // rank 2: 1/(60+2) = 0.01613...
        let text_results = vec![
            signapps_db::models::VectorSearchResult {
                id: Uuid::new_v4(),
                document_id: Uuid::new_v4(),
                chunk_index: 0,
                content: "first".to_string(),
                filename: "a.txt".to_string(),
                path: "/a.txt".to_string(),
                mime_type: None,
                score: 0.9,
                security_tags: None,
            },
            signapps_db::models::VectorSearchResult {
                id: Uuid::new_v4(),
                document_id: Uuid::new_v4(),
                chunk_index: 0,
                content: "second".to_string(),
                filename: "b.txt".to_string(),
                path: "/b.txt".to_string(),
                mime_type: None,
                score: 0.8,
                security_tags: None,
            },
        ];

        let fused = rrf_fuse(&text_results, &[]);

        assert_eq!(fused.len(), 2);
        // First result should have the highest RRF score
        assert!(fused[0].score > fused[1].score);
        // Both should have text scores
        assert!(fused[0].text_score.is_some());
        assert!(fused[1].text_score.is_some());
        // Neither should have multimodal scores
        assert!(fused[0].multimodal_score.is_none());
        assert!(fused[1].multimodal_score.is_none());
    }

    #[test]
    fn test_rrf_merged_result_gets_higher_score() {
        let doc_id = Uuid::new_v4();
        let chunk_id = Uuid::new_v4();

        // Same document appears in both text and multimodal results
        let text_results = vec![signapps_db::models::VectorSearchResult {
            id: chunk_id,
            document_id: doc_id,
            chunk_index: 0,
            content: "shared content".to_string(),
            filename: "shared.txt".to_string(),
            path: "/shared.txt".to_string(),
            mime_type: None,
            score: 0.85,
            security_tags: None,
        }];

        let mm_results = vec![signapps_db::models::MultimodalSearchResult {
            id: chunk_id,
            document_id: doc_id,
            chunk_index: 0,
            media_type: "image".to_string(),
            content: Some("shared content".to_string()),
            filename: "shared.txt".to_string(),
            path: "/shared.txt".to_string(),
            mime_type: Some("image/png".to_string()),
            score: 0.75,
            metadata: None,
            security_tags: None,
        }];

        let fused = rrf_fuse(&text_results, &mm_results);

        assert_eq!(fused.len(), 1);
        // Merged result should have both scores
        assert!(fused[0].text_score.is_some());
        assert!(fused[0].multimodal_score.is_some());
        // RRF score should be sum of two contributions: 1/(60+1) + 1/(60+1)
        let expected_score = 2.0 / (RRF_K + 1.0);
        let tolerance = 0.0001;
        assert!((fused[0].score as f64 - expected_score).abs() < tolerance);
    }

    #[test]
    fn test_rrf_empty_inputs() {
        let fused = rrf_fuse(&[], &[]);
        assert!(fused.is_empty());
    }

    #[test]
    fn test_search_query_defaults() {
        let query: SearchQuery =
            serde_json::from_str(r#"{"text": "hello", "limit": 10, "include_multimodal": false}"#)
                .unwrap();

        assert_eq!(query.text, "hello");
        assert_eq!(query.limit, 10);
        assert!(query.score_threshold.is_none());
        assert!(query.collections.is_none());
        assert!(query.media_types.is_none());
        assert!(!query.include_multimodal);
    }
}
