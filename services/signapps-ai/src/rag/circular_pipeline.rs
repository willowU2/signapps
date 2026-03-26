//! Circular pipeline: background task that auto-indexes generated media.
//!
//! Periodically checks for unindexed generated media records and indexes
//! them via the [`MultimodalIndexer`], closing the loop between generation
//! and retrieval.

use std::sync::Arc;
use std::time::Duration;

use bytes::Bytes;
use opendal::Operator;
use signapps_common::Result;
use signapps_db::repositories::GeneratedMediaRepository;
use signapps_db::DatabasePool;

use super::multimodal_indexer::{GeneratedOutput, MultimodalIndexer};

/// Background pipeline that auto-indexes generated media into the vector store.
pub struct CircularPipeline {
    indexer: Arc<MultimodalIndexer>,
    pool: DatabasePool,
    storage: Operator,
}

impl CircularPipeline {
    /// Create a new circular pipeline.
    pub fn new(indexer: Arc<MultimodalIndexer>, pool: DatabasePool, storage: Operator) -> Self {
        Self {
            indexer,
            pool,
            storage,
        }
    }

    /// Spawn a background loop that checks for unindexed generated media
    /// every 30 seconds and indexes them.
    pub fn start(self: Arc<Self>) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(30));
            loop {
                interval.tick().await;
                match self.process_unindexed().await {
                    Ok(0) => {}, // nothing to process, silent
                    Ok(n) => {
                        tracing::info!("Circular pipeline: indexed {} generated media items", n);
                    },
                    Err(e) => tracing::warn!("Circular pipeline error: {}", e),
                }
            }
        })
    }

    /// Process unindexed generated media items, returning the count of
    /// successfully indexed items.
    ///
    /// This can be called manually to trigger immediate processing outside
    /// the background loop.
    pub async fn process_unindexed(&self) -> Result<usize> {
        let items = GeneratedMediaRepository::list_unindexed(&self.pool, 10).await?;

        if items.is_empty() {
            return Ok(0);
        }

        let mut indexed_count = 0usize;

        for item in &items {
            // 1. Read the file from storage
            let data = match self.storage.read(&item.storage_path).await {
                Ok(buf) => Bytes::from(buf.to_vec()),
                Err(e) => {
                    tracing::warn!(
                        id = %item.id,
                        path = %item.storage_path,
                        error = %e,
                        "Circular pipeline: failed to read file from storage, skipping"
                    );
                    continue;
                },
            };

            // 2. Build a GeneratedOutput from the GeneratedMedia record
            let output = GeneratedOutput {
                id: item.id,
                media_type: item.media_type.clone(),
                data,
                prompt: item.prompt.clone(),
                generator: item.model_used.clone(),
                source_collection: None,
            };

            // 3. Index via the multimodal indexer
            if let Err(e) = self.indexer.index_generated_output(output).await {
                tracing::warn!(
                    id = %item.id,
                    error = %e,
                    "Circular pipeline: failed to index generated media, skipping"
                );
                continue;
            }

            // 4. Mark as indexed in the database
            if let Err(e) = GeneratedMediaRepository::mark_indexed(&self.pool, item.id).await {
                tracing::warn!(
                    id = %item.id,
                    error = %e,
                    "Circular pipeline: indexed but failed to mark in DB"
                );
                // Still count it as processed since the vectors are stored
            }

            indexed_count += 1;
        }

        Ok(indexed_count)
    }
}
