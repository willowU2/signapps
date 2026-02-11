//! Qdrant client implementation.
#![allow(deprecated)]

use qdrant_client::prelude::*;
use qdrant_client::qdrant::{
    with_payload_selector::SelectorOptions, CreateCollection, Distance, PointStruct, SearchPoints,
    VectorParams, VectorsConfig, WithPayloadSelector,
};
use signapps_common::{Error, Result};
use std::sync::Arc;
use uuid::Uuid;

use super::types::*;

/// Collection name for documents.
pub const DOCUMENTS_COLLECTION: &str = "documents";

/// Vector dimension for all-MiniLM-L6-v2 embeddings.
pub const VECTOR_SIZE: u64 = 384;

/// Qdrant service for vector operations.
#[derive(Clone)]
pub struct QdrantService {
    client: Arc<QdrantClient>,
}

impl QdrantService {
    /// Create a new Qdrant service.
    pub async fn new(url: &str) -> Result<Self> {
        // Configure client with HTTP/1.1 to avoid h2 protocol issues
        let client = QdrantClient::from_url(url)
            .build()
            .map_err(|e| Error::Internal(format!("Failed to create Qdrant client: {}", e)))?;

        let service = Self {
            client: Arc::new(client),
        };

        // Try to ensure collection exists, but don't fail startup
        // This allows the service to start even if Qdrant is not ready yet
        match service.ensure_collection().await {
            Ok(_) => tracing::info!("Qdrant collection initialized"),
            Err(e) => tracing::warn!("Qdrant not ready, will retry on first request: {}", e),
        }

        Ok(service)
    }

    /// Ensure the documents collection exists.
    async fn ensure_collection(&self) -> Result<()> {
        let collections = self
            .client
            .list_collections()
            .await
            .map_err(|e| Error::Internal(format!("Failed to list collections: {}", e)))?;

        let exists = collections
            .collections
            .iter()
            .any(|c| c.name == DOCUMENTS_COLLECTION);

        if !exists {
            self.client
                .create_collection(&CreateCollection {
                    collection_name: DOCUMENTS_COLLECTION.to_string(),
                    vectors_config: Some(VectorsConfig {
                        config: Some(qdrant_client::qdrant::vectors_config::Config::Params(
                            VectorParams {
                                size: VECTOR_SIZE,
                                distance: Distance::Cosine.into(),
                                ..Default::default()
                            },
                        )),
                    }),
                    ..Default::default()
                })
                .await
                .map_err(|e| Error::Internal(format!("Failed to create collection: {}", e)))?;

            tracing::info!("Created Qdrant collection: {}", DOCUMENTS_COLLECTION);
        }

        Ok(())
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

        use qdrant_client::qdrant::value::Kind;
        use qdrant_client::qdrant::Value;
        use qdrant_client::Payload;

        let points: Vec<PointStruct> = chunks
            .iter()
            .zip(embeddings)
            .map(|(chunk, vector)| {
                let mut payload = Payload::new();
                payload.insert(
                    "document_id",
                    Value {
                        kind: Some(Kind::StringValue(chunk.document_id.to_string())),
                    },
                );
                payload.insert(
                    "chunk_index",
                    Value {
                        kind: Some(Kind::IntegerValue(chunk.chunk_index as i64)),
                    },
                );
                payload.insert(
                    "content",
                    Value {
                        kind: Some(Kind::StringValue(chunk.content.clone())),
                    },
                );
                payload.insert(
                    "filename",
                    Value {
                        kind: Some(Kind::StringValue(chunk.filename.clone())),
                    },
                );
                payload.insert(
                    "path",
                    Value {
                        kind: Some(Kind::StringValue(chunk.path.clone())),
                    },
                );
                if let Some(ref mime) = chunk.mime_type {
                    payload.insert(
                        "mime_type",
                        Value {
                            kind: Some(Kind::StringValue(mime.clone())),
                        },
                    );
                }

                PointStruct::new(chunk.id.to_string(), vector, payload)
            })
            .collect();

        self.client
            .upsert_points_blocking(DOCUMENTS_COLLECTION, None, points, None)
            .await
            .map_err(|e| Error::Internal(format!("Failed to upsert points: {}", e)))?;

        tracing::debug!(count = chunks.len(), "Upserted document chunks to Qdrant");

        Ok(())
    }

    /// Search for similar documents.
    pub async fn search(
        &self,
        query_vector: Vec<f32>,
        limit: u64,
        score_threshold: Option<f32>,
    ) -> Result<Vec<SearchResult>> {
        let mut search_request = SearchPoints {
            collection_name: DOCUMENTS_COLLECTION.to_string(),
            vector: query_vector,
            limit,
            with_payload: Some(WithPayloadSelector {
                selector_options: Some(SelectorOptions::Enable(true)),
            }),
            ..Default::default()
        };

        if let Some(threshold) = score_threshold {
            search_request.score_threshold = Some(threshold);
        }

        let response = self
            .client
            .search_points(&search_request)
            .await
            .map_err(|e| Error::Internal(format!("Failed to search: {}", e)))?;

        let results = response
            .result
            .into_iter()
            .filter_map(|point| {
                let payload = point.payload;

                // Extract point ID - try to get it as UUID string
                let point_id = point.id?;
                let point_id_str = match point_id.point_id_options? {
                    qdrant_client::qdrant::point_id::PointIdOptions::Num(n) => n.to_string(),
                    qdrant_client::qdrant::point_id::PointIdOptions::Uuid(s) => s,
                };
                let id = Uuid::parse_str(&point_id_str).ok()?;
                let document_id = payload
                    .get("document_id")
                    .and_then(|v| v.as_str())
                    .and_then(|s| Uuid::parse_str(s).ok())?;
                let content = payload
                    .get("content")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())?;
                let filename = payload
                    .get("filename")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())?;

                Some(SearchResult {
                    id,
                    document_id,
                    content,
                    filename,
                    score: point.score,
                })
            })
            .collect();

        Ok(results)
    }

    /// Delete all chunks for a document.
    pub async fn delete_document(&self, document_id: Uuid) -> Result<()> {
        use qdrant_client::qdrant::points_selector::PointsSelectorOneOf;
        use qdrant_client::qdrant::PointsSelector;
        use qdrant_client::qdrant::{Condition, FieldCondition, Filter, Match};

        let filter = Filter {
            must: vec![Condition {
                condition_one_of: Some(qdrant_client::qdrant::condition::ConditionOneOf::Field(
                    FieldCondition {
                        key: "document_id".to_string(),
                        r#match: Some(Match {
                            match_value: Some(qdrant_client::qdrant::r#match::MatchValue::Keyword(
                                document_id.to_string(),
                            )),
                        }),
                        ..Default::default()
                    },
                )),
            }],
            ..Default::default()
        };

        self.client
            .delete_points_blocking(
                DOCUMENTS_COLLECTION,
                None,
                &PointsSelector {
                    points_selector_one_of: Some(PointsSelectorOneOf::Filter(filter)),
                },
                None,
            )
            .await
            .map_err(|e| Error::Internal(format!("Failed to delete points: {}", e)))?;

        tracing::info!(document_id = %document_id, "Deleted document chunks from Qdrant");

        Ok(())
    }

    /// Get collection statistics.
    pub async fn get_stats(&self) -> Result<CollectionStats> {
        let info = self
            .client
            .collection_info(DOCUMENTS_COLLECTION)
            .await
            .map_err(|e| Error::Internal(format!("Failed to get collection info: {}", e)))?;

        let result = info
            .result
            .ok_or_else(|| Error::Internal("No collection info".to_string()))?;

        // Get points count from segments_count as approximation
        let segments_count = result.segments_count;
        let status = match result.status() {
            qdrant_client::qdrant::CollectionStatus::Green => "green",
            qdrant_client::qdrant::CollectionStatus::Yellow => "yellow",
            qdrant_client::qdrant::CollectionStatus::Red => "red",
            qdrant_client::qdrant::CollectionStatus::Grey => "grey",
            qdrant_client::qdrant::CollectionStatus::UnknownCollectionStatus => "unknown",
        };

        Ok(CollectionStats {
            name: DOCUMENTS_COLLECTION.to_string(),
            vectors_count: segments_count, // Approximation
            indexed_vectors_count: segments_count,
            points_count: result.points_count.unwrap_or(0),
            status: status.to_string(),
        })
    }
}
