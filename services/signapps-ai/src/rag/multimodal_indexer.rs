//! Multimodal indexer that auto-detects media type and indexes content
//! into the appropriate vector space (text 384d and/or multimodal 1024d).

use std::sync::Arc;

use bytes::Bytes;
use signapps_common::{Error, Result};
use signapps_db::models::MultimodalChunkInput;
use signapps_db::repositories::MultimodalVectorRepository;
use signapps_db::DatabasePool;
use uuid::Uuid;

use crate::embeddings::EmbeddingsClient;
use crate::vectors::{DocumentChunk, VectorService};
use crate::workers::traits::{MultimodalEmbedWorker, VisionWorker};

use super::chunker::TextChunker;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Detected media type from MIME type analysis.
#[derive(Debug, Clone, PartialEq)]
pub enum MediaType {
    Text,
    Document,
    Image,
    Audio,
    Video,
}

impl std::fmt::Display for MediaType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MediaType::Text => write!(f, "text"),
            MediaType::Document => write!(f, "document"),
            MediaType::Image => write!(f, "image"),
            MediaType::Audio => write!(f, "audio"),
            MediaType::Video => write!(f, "video"),
        }
    }
}

/// Input for indexing a document or media file.
pub struct IndexInput {
    pub document_id: Uuid,
    pub data: Bytes,
    pub filename: String,
    pub path: String,
    pub mime_type: String,
    pub collection: Option<String>,
    pub security_tags: Option<serde_json::Value>,
    pub metadata: Option<serde_json::Value>,
}

/// Result of an indexing operation.
#[derive(Debug, Clone)]
pub struct IndexResult {
    pub document_id: Uuid,
    pub text_chunks_indexed: usize,
    pub multimodal_chunks_indexed: usize,
    pub media_type: String,
}

/// Output from a generative AI pipeline to be re-indexed.
pub struct GeneratedOutput {
    pub id: Uuid,
    pub media_type: String,
    pub data: Bytes,
    pub prompt: String,
    pub generator: String,
    pub source_collection: Option<String>,
}

// ---------------------------------------------------------------------------
// MultimodalIndexer
// ---------------------------------------------------------------------------

/// Indexes content into text (384d) and/or multimodal (1024d) vector spaces.
///
/// The indexer auto-detects media type from MIME type and routes content
/// to the appropriate embedding pipeline:
/// - Text/documents: chunked, embedded with text embedder, stored in
///   `ai.document_vectors` via `VectorService`.
/// - Images: optionally described by a vision worker, then embedded into
///   both text and multimodal spaces.
/// - Audio/Video: stored as text (pre-processed content) with optional
///   multimodal embeddings.
pub struct MultimodalIndexer {
    /// Existing text embedder (nomic-embed, 384d).
    text_embedder: EmbeddingsClient,
    /// Existing text vector service for `ai.document_vectors`.
    vectors: VectorService,
    /// Optional SigLIP-based multimodal embedder (1024d).
    mm_embed: Option<Arc<dyn MultimodalEmbedWorker>>,
    /// Optional vision worker for generating image descriptions.
    vision: Option<Arc<dyn VisionWorker>>,
    /// Database pool for direct multimodal vector repository access.
    pool: DatabasePool,
    /// Text chunker for splitting documents into chunks.
    chunker: TextChunker,
}

impl MultimodalIndexer {
    /// Create a new multimodal indexer with required dependencies.
    ///
    /// The `mm_embed` and `vision` workers are optional and can be set
    /// via builder-style setters after construction.
    pub fn new(
        text_embedder: EmbeddingsClient,
        vectors: VectorService,
        pool: DatabasePool,
        chunker: TextChunker,
    ) -> Self {
        Self {
            text_embedder,
            vectors,
            mm_embed: None,
            vision: None,
            pool,
            chunker,
        }
    }

    /// Attach a multimodal embedding worker (SigLIP, 1024d).
    pub fn with_multimodal_embed(mut self, worker: Arc<dyn MultimodalEmbedWorker>) -> Self {
        self.mm_embed = Some(worker);
        self
    }

    /// Attach a vision worker for image description generation.
    pub fn with_vision(mut self, worker: Arc<dyn VisionWorker>) -> Self {
        self.vision = Some(worker);
        self
    }

    // ── Media type detection ────────────────────────────────────────

    /// Detect media type from a MIME type string.
    fn detect_media_type(mime_type: &str) -> MediaType {
        let mime = mime_type.to_lowercase();

        if mime.starts_with("text/") || mime == "application/json" || mime == "application/xml" {
            return MediaType::Text;
        }

        if mime == "application/pdf" || mime.starts_with("application/vnd.openxmlformats") {
            return MediaType::Document;
        }

        if mime.starts_with("image/") {
            return MediaType::Image;
        }

        if mime.starts_with("audio/") {
            return MediaType::Audio;
        }

        if mime.starts_with("video/") {
            return MediaType::Video;
        }

        // Fallback: treat unknown as text
        MediaType::Text
    }

    // ── Main indexing entry point ───────────────────────────────────

    /// Index content into the appropriate vector space(s).
    ///
    /// Auto-detects media type from `input.mime_type` and routes to the
    /// correct indexing logic.
    pub async fn index(&self, input: IndexInput) -> Result<IndexResult> {
        let media_type = Self::detect_media_type(&input.mime_type);

        tracing::info!(
            document_id = %input.document_id,
            filename = %input.filename,
            mime_type = %input.mime_type,
            media_type = %media_type,
            "Indexing content"
        );

        match media_type {
            MediaType::Text => self.index_text(&input).await,
            MediaType::Document => self.index_document(&input).await,
            MediaType::Image => self.index_image(&input).await,
            MediaType::Audio => self.index_audio(&input).await,
            MediaType::Video => self.index_video(&input).await,
        }
    }

    // ── Text indexing ───────────────────────────────────────────────

    /// Index text content: chunk -> embed (384d) -> upsert to document_vectors.
    async fn index_text(&self, input: &IndexInput) -> Result<IndexResult> {
        let content = String::from_utf8(input.data.to_vec()).map_err(|e| {
            Error::Internal(format!("Failed to decode text content as UTF-8: {}", e))
        })?;

        let text_count = self
            .index_text_content(
                input.document_id,
                &content,
                &input.filename,
                &input.path,
                Some(&input.mime_type),
                input.collection.as_deref(),
                input.security_tags.clone(),
            )
            .await?;

        Ok(IndexResult {
            document_id: input.document_id,
            text_chunks_indexed: text_count,
            multimodal_chunks_indexed: 0,
            media_type: "text".to_string(),
        })
    }

    // ── Document indexing (PDF, DOCX — treated as text for now) ────

    /// Index a document: treat as text for now (OCR integration later).
    async fn index_document(&self, input: &IndexInput) -> Result<IndexResult> {
        // For now, attempt to extract raw text from the bytes.
        // Full OCR/parsing will be integrated via DocParseWorker later.
        let content = String::from_utf8(input.data.to_vec()).unwrap_or_else(|_| {
            tracing::warn!(
                document_id = %input.document_id,
                "Document is not valid UTF-8, indexing with lossy conversion"
            );
            String::from_utf8_lossy(&input.data).to_string()
        });

        let text_count = self
            .index_text_content(
                input.document_id,
                &content,
                &input.filename,
                &input.path,
                Some(&input.mime_type),
                input.collection.as_deref(),
                input.security_tags.clone(),
            )
            .await?;

        Ok(IndexResult {
            document_id: input.document_id,
            text_chunks_indexed: text_count,
            multimodal_chunks_indexed: 0,
            media_type: "document".to_string(),
        })
    }

    // ── Image indexing ──────────────────────────────────────────────

    /// Index an image into text space (via vision description) and/or
    /// multimodal space (via SigLIP embedding).
    async fn index_image(&self, input: &IndexInput) -> Result<IndexResult> {
        let mut text_count = 0usize;
        let mut mm_count = 0usize;

        // 1. If vision worker is available, describe the image and index
        //    the description into the text vector space.
        if let Some(ref vision) = self.vision {
            match vision.describe(input.data.clone(), None).await {
                Ok(result) => {
                    let description = result.text;
                    tracing::debug!(
                        document_id = %input.document_id,
                        description_len = description.len(),
                        "Generated image description via vision worker"
                    );

                    text_count = self
                        .index_text_content(
                            input.document_id,
                            &description,
                            &input.filename,
                            &input.path,
                            Some(&input.mime_type),
                            input.collection.as_deref(),
                            input.security_tags.clone(),
                        )
                        .await?;
                },
                Err(e) => {
                    tracing::warn!(
                        document_id = %input.document_id,
                        error = %e,
                        "Vision description failed, skipping text space indexing"
                    );
                },
            }
        }

        // 2. If multimodal embed worker is available, embed the raw image
        //    into the multimodal vector space (1024d).
        if let Some(ref mm) = self.mm_embed {
            match mm.embed_image(vec![input.data.clone()]).await {
                Ok(embeddings) if !embeddings.is_empty() => {
                    let chunks = vec![MultimodalChunkInput {
                        id: Uuid::new_v4(),
                        document_id: input.document_id,
                        chunk_index: 0,
                        media_type: "image".to_string(),
                        content: None,
                        filename: input.filename.clone(),
                        path: input.path.clone(),
                        mime_type: Some(input.mime_type.clone()),
                        collection: input
                            .collection
                            .clone()
                            .unwrap_or_else(|| "default".to_string()),
                        metadata: input.metadata.clone(),
                        security_tags: input.security_tags.clone(),
                    }];

                    MultimodalVectorRepository::upsert_chunks(&self.pool, &chunks, &embeddings)
                        .await?;

                    mm_count = 1;
                    tracing::debug!(
                        document_id = %input.document_id,
                        "Image embedded into multimodal vector space"
                    );
                },
                Ok(_) => {
                    tracing::warn!(
                        document_id = %input.document_id,
                        "Multimodal embed returned no embeddings for image"
                    );
                },
                Err(e) => {
                    tracing::warn!(
                        document_id = %input.document_id,
                        error = %e,
                        "Multimodal image embedding failed"
                    );
                },
            }
        }

        Ok(IndexResult {
            document_id: input.document_id,
            text_chunks_indexed: text_count,
            multimodal_chunks_indexed: mm_count,
            media_type: "image".to_string(),
        })
    }

    // ── Audio indexing ──────────────────────────────────────────────

    /// Index audio content. Assumes pre-transcribed text in data for now.
    /// Full STT integration comes later.
    async fn index_audio(&self, input: &IndexInput) -> Result<IndexResult> {
        let mut text_count = 0usize;
        let mut mm_count = 0usize;

        // Store raw text content (assume pre-transcribed)
        let content = String::from_utf8(input.data.to_vec()).unwrap_or_default();
        if !content.trim().is_empty() {
            text_count = self
                .index_text_content(
                    input.document_id,
                    &content,
                    &input.filename,
                    &input.path,
                    Some(&input.mime_type),
                    input.collection.as_deref(),
                    input.security_tags.clone(),
                )
                .await?;
        }

        // If multimodal embed worker is available, embed the audio
        if let Some(ref mm) = self.mm_embed {
            match mm.embed_audio(vec![input.data.clone()]).await {
                Ok(embeddings) if !embeddings.is_empty() => {
                    let chunks = vec![MultimodalChunkInput {
                        id: Uuid::new_v4(),
                        document_id: input.document_id,
                        chunk_index: 0,
                        media_type: "audio".to_string(),
                        content: if content.trim().is_empty() {
                            None
                        } else {
                            Some(content.clone())
                        },
                        filename: input.filename.clone(),
                        path: input.path.clone(),
                        mime_type: Some(input.mime_type.clone()),
                        collection: input
                            .collection
                            .clone()
                            .unwrap_or_else(|| "default".to_string()),
                        metadata: input.metadata.clone(),
                        security_tags: input.security_tags.clone(),
                    }];

                    MultimodalVectorRepository::upsert_chunks(&self.pool, &chunks, &embeddings)
                        .await?;

                    mm_count = 1;
                    tracing::debug!(
                        document_id = %input.document_id,
                        "Audio embedded into multimodal vector space"
                    );
                },
                Ok(_) => {
                    tracing::warn!(
                        document_id = %input.document_id,
                        "Multimodal embed returned no embeddings for audio"
                    );
                },
                Err(e) => {
                    tracing::warn!(
                        document_id = %input.document_id,
                        error = %e,
                        "Multimodal audio embedding failed"
                    );
                },
            }
        }

        Ok(IndexResult {
            document_id: input.document_id,
            text_chunks_indexed: text_count,
            multimodal_chunks_indexed: mm_count,
            media_type: "audio".to_string(),
        })
    }

    // ── Video indexing ──────────────────────────────────────────────

    /// Index video content. Assumes pre-processed text in data for now.
    /// Full frame extraction and STT comes later.
    async fn index_video(&self, input: &IndexInput) -> Result<IndexResult> {
        let mut text_count = 0usize;
        let mut mm_count = 0usize;

        // Store content as text (assume pre-processed)
        let content = String::from_utf8(input.data.to_vec()).unwrap_or_default();
        if !content.trim().is_empty() {
            text_count = self
                .index_text_content(
                    input.document_id,
                    &content,
                    &input.filename,
                    &input.path,
                    Some(&input.mime_type),
                    input.collection.as_deref(),
                    input.security_tags.clone(),
                )
                .await?;
        }

        // If multimodal embed worker is available, embed as multimodal.
        // For video we use embed_text on any extracted text since SigLIP
        // does not directly support video bytes; full frame-level embedding
        // will be added when VideoUnderstandWorker is integrated.
        if let Some(ref mm) = self.mm_embed {
            let embed_text = if content.trim().is_empty() {
                input.filename.clone()
            } else {
                content.clone()
            };

            match mm.embed_text(vec![embed_text]).await {
                Ok(embeddings) if !embeddings.is_empty() => {
                    let chunks = vec![MultimodalChunkInput {
                        id: Uuid::new_v4(),
                        document_id: input.document_id,
                        chunk_index: 0,
                        media_type: "video".to_string(),
                        content: if content.trim().is_empty() {
                            None
                        } else {
                            Some(content.clone())
                        },
                        filename: input.filename.clone(),
                        path: input.path.clone(),
                        mime_type: Some(input.mime_type.clone()),
                        collection: input
                            .collection
                            .clone()
                            .unwrap_or_else(|| "default".to_string()),
                        metadata: input.metadata.clone(),
                        security_tags: input.security_tags.clone(),
                    }];

                    MultimodalVectorRepository::upsert_chunks(&self.pool, &chunks, &embeddings)
                        .await?;

                    mm_count = 1;
                    tracing::debug!(
                        document_id = %input.document_id,
                        "Video embedded into multimodal vector space"
                    );
                },
                Ok(_) => {
                    tracing::warn!(
                        document_id = %input.document_id,
                        "Multimodal embed returned no embeddings for video"
                    );
                },
                Err(e) => {
                    tracing::warn!(
                        document_id = %input.document_id,
                        error = %e,
                        "Multimodal video embedding failed"
                    );
                },
            }
        }

        Ok(IndexResult {
            document_id: input.document_id,
            text_chunks_indexed: text_count,
            multimodal_chunks_indexed: mm_count,
            media_type: "video".to_string(),
        })
    }

    // ── Re-indexing generated outputs ───────────────────────────────

    /// Re-index output from a generative AI pipeline (image gen, TTS, etc.).
    ///
    /// Converts the generated output into an `IndexInput` with metadata
    /// indicating it was generated, then delegates to `self.index()`.
    pub async fn index_generated_output(&self, output: GeneratedOutput) -> Result<IndexResult> {
        let mut metadata = serde_json::json!({
            "generated": true,
            "generator": output.generator,
            "prompt": output.prompt,
        });

        // Merge any existing metadata if the media_type maps to an
        // existing collection.
        if let Some(collection) = &output.source_collection {
            metadata["source_collection"] = serde_json::Value::String(collection.clone());
        }

        let input = IndexInput {
            document_id: output.id,
            data: output.data,
            filename: format!("generated_{}", output.id),
            path: format!("/generated/{}", output.id),
            mime_type: output.media_type,
            collection: output.source_collection,
            security_tags: None,
            metadata: Some(metadata),
        };

        self.index(input).await
    }

    // ── Shared helpers ──────────────────────────────────────────────

    /// Chunk text content, embed with the text embedder (384d), and upsert
    /// into `ai.document_vectors` via `VectorService`.
    ///
    /// This mirrors the existing flow in `RagPipeline::index_document` but
    /// through the multimodal indexer interface.
    async fn index_text_content(
        &self,
        document_id: Uuid,
        content: &str,
        filename: &str,
        path: &str,
        mime_type: Option<&str>,
        collection: Option<&str>,
        security_tags: Option<serde_json::Value>,
    ) -> Result<usize> {
        let text_chunks = self.chunker.chunk_by_paragraphs(content);

        if text_chunks.is_empty() {
            return Ok(0);
        }

        // Build DocumentChunk objects matching VectorService expectations
        let chunks: Vec<DocumentChunk> = text_chunks
            .iter()
            .enumerate()
            .map(|(i, chunk_content)| DocumentChunk {
                id: Uuid::new_v4(),
                document_id,
                chunk_index: i as i32,
                content: chunk_content.clone(),
                filename: filename.to_string(),
                path: path.to_string(),
                mime_type: mime_type.map(|s| s.to_string()),
                collection: collection.map(|s| s.to_string()),
                security_tags: security_tags.clone(),
            })
            .collect();

        // Generate embeddings for all text chunks
        let texts: Vec<String> = chunks.iter().map(|c| c.content.clone()).collect();
        let embeddings = self.text_embedder.embed_batch(&texts).await?;

        // Upsert into ai.document_vectors
        self.vectors.upsert_chunks(&chunks, embeddings).await?;

        let count = chunks.len();
        tracing::info!(
            document_id = %document_id,
            chunks = count,
            "Text content indexed into document_vectors"
        );

        Ok(count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_media_type_text() {
        assert_eq!(
            MultimodalIndexer::detect_media_type("text/plain"),
            MediaType::Text
        );
        assert_eq!(
            MultimodalIndexer::detect_media_type("text/html"),
            MediaType::Text
        );
        assert_eq!(
            MultimodalIndexer::detect_media_type("text/csv"),
            MediaType::Text
        );
        assert_eq!(
            MultimodalIndexer::detect_media_type("application/json"),
            MediaType::Text
        );
        assert_eq!(
            MultimodalIndexer::detect_media_type("application/xml"),
            MediaType::Text
        );
    }

    #[test]
    fn test_detect_media_type_document() {
        assert_eq!(
            MultimodalIndexer::detect_media_type("application/pdf"),
            MediaType::Document
        );
        assert_eq!(
            MultimodalIndexer::detect_media_type(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ),
            MediaType::Document
        );
        assert_eq!(
            MultimodalIndexer::detect_media_type(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ),
            MediaType::Document
        );
    }

    #[test]
    fn test_detect_media_type_image() {
        assert_eq!(
            MultimodalIndexer::detect_media_type("image/png"),
            MediaType::Image
        );
        assert_eq!(
            MultimodalIndexer::detect_media_type("image/jpeg"),
            MediaType::Image
        );
        assert_eq!(
            MultimodalIndexer::detect_media_type("image/webp"),
            MediaType::Image
        );
    }

    #[test]
    fn test_detect_media_type_audio() {
        assert_eq!(
            MultimodalIndexer::detect_media_type("audio/mpeg"),
            MediaType::Audio
        );
        assert_eq!(
            MultimodalIndexer::detect_media_type("audio/wav"),
            MediaType::Audio
        );
    }

    #[test]
    fn test_detect_media_type_video() {
        assert_eq!(
            MultimodalIndexer::detect_media_type("video/mp4"),
            MediaType::Video
        );
        assert_eq!(
            MultimodalIndexer::detect_media_type("video/webm"),
            MediaType::Video
        );
    }

    #[test]
    fn test_detect_media_type_unknown_fallback() {
        assert_eq!(
            MultimodalIndexer::detect_media_type("application/octet-stream"),
            MediaType::Text
        );
    }

    #[test]
    fn test_detect_media_type_case_insensitive() {
        assert_eq!(
            MultimodalIndexer::detect_media_type("IMAGE/PNG"),
            MediaType::Image
        );
        assert_eq!(
            MultimodalIndexer::detect_media_type("Text/Plain"),
            MediaType::Text
        );
    }

    #[test]
    fn test_media_type_display() {
        assert_eq!(MediaType::Text.to_string(), "text");
        assert_eq!(MediaType::Document.to_string(), "document");
        assert_eq!(MediaType::Image.to_string(), "image");
        assert_eq!(MediaType::Audio.to_string(), "audio");
        assert_eq!(MediaType::Video.to_string(), "video");
    }
}
