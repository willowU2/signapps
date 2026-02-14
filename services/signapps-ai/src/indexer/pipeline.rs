//! Document indexing pipeline implementation.

use signapps_common::{Error, Result};
use uuid::Uuid;

use crate::embeddings::EmbeddingsClient;
use crate::rag::chunker::TextChunker;
use crate::vectors::{DocumentChunk, VectorService};

/// Index pipeline for automatic document indexing.
#[derive(Clone)]
pub struct IndexPipeline {
    embeddings: EmbeddingsClient,
    vectors: VectorService,
    chunker: TextChunker,
    ocr_url: Option<String>,
}

/// Result of indexing a document.
#[derive(Debug, Clone, serde::Serialize)]
pub struct IndexResult {
    pub document_id: Uuid,
    pub chunks_indexed: usize,
    pub ocr_applied: bool,
}

impl IndexPipeline {
    /// Create a new index pipeline.
    pub fn new(
        embeddings: EmbeddingsClient,
        vectors: VectorService,
        ocr_url: Option<String>,
    ) -> Self {
        Self {
            embeddings,
            vectors,
            chunker: TextChunker::new(),
            ocr_url,
        }
    }

    /// Index a document with text content.
    pub async fn index_text(
        &self,
        document_id: Uuid,
        content: &str,
        filename: &str,
        path: &str,
        mime_type: Option<&str>,
    ) -> Result<IndexResult> {
        // Chunk the text
        let text_chunks = self.chunker.chunk_by_paragraphs(content);

        if text_chunks.is_empty() {
            return Ok(IndexResult {
                document_id,
                chunks_indexed: 0,
                ocr_applied: false,
            });
        }

        // Create document chunks
        let chunks: Vec<DocumentChunk> = text_chunks
            .iter()
            .enumerate()
            .map(|(i, content)| DocumentChunk {
                id: Uuid::new_v4(),
                document_id,
                chunk_index: i as i32,
                content: content.clone(),
                filename: filename.to_string(),
                path: path.to_string(),
                mime_type: mime_type.map(|s| s.to_string()),
            })
            .collect();

        // Generate embeddings
        let texts: Vec<String> = chunks.iter().map(|c| c.content.clone()).collect();
        let embeddings = self.embeddings.embed_batch(&texts).await?;

        // Store in pgvector
        self.vectors.upsert_chunks(&chunks, embeddings).await?;

        let count = chunks.len();
        tracing::info!(
            document_id = %document_id,
            chunks = count,
            "Document indexed via pipeline"
        );

        Ok(IndexResult {
            document_id,
            chunks_indexed: count,
            ocr_applied: false,
        })
    }

    /// Index a document, applying OCR if it's an image or PDF.
    pub async fn index_document(
        &self,
        document_id: Uuid,
        content: &[u8],
        filename: &str,
        path: &str,
        mime_type: &str,
    ) -> Result<IndexResult> {
        let needs_ocr = matches!(
            mime_type,
            "image/png"
                | "image/jpeg"
                | "image/jpg"
                | "image/tiff"
                | "image/bmp"
                | "application/pdf"
        );

        let text = if needs_ocr {
            self.extract_text_ocr(content, mime_type).await?
        } else if mime_type.starts_with("text/") || mime_type == "application/json" {
            String::from_utf8_lossy(content).to_string()
        } else {
            // Unsupported format for indexing
            tracing::debug!(
                mime_type = %mime_type,
                "Skipping indexation for unsupported mime type"
            );
            return Ok(IndexResult {
                document_id,
                chunks_indexed: 0,
                ocr_applied: false,
            });
        };

        if text.trim().is_empty() {
            return Ok(IndexResult {
                document_id,
                chunks_indexed: 0,
                ocr_applied: needs_ocr,
            });
        }

        let mut result = self
            .index_text(document_id, &text, filename, path, Some(mime_type))
            .await?;
        result.ocr_applied = needs_ocr;

        Ok(result)
    }

    /// Delete a document's index.
    pub async fn delete_document(&self, document_id: Uuid) -> Result<()> {
        self.vectors.delete_document(document_id).await
    }

    /// Extract text from an image/PDF via OCR service.
    async fn extract_text_ocr(&self, _content: &[u8], _mime_type: &str) -> Result<String> {
        let ocr_url = self
            .ocr_url
            .as_ref()
            .ok_or_else(|| Error::Internal("OCR service URL not configured".to_string()))?;

        // Call the PaddleOCR service
        let client = reqwest::Client::new();
        let response = client
            .post(format!("{}/ocr", ocr_url))
            .header("Content-Type", _mime_type)
            .body(_content.to_vec())
            .send()
            .await
            .map_err(|e| Error::Internal(format!("OCR service request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(Error::Internal(format!(
                "OCR service returned {}",
                response.status()
            )));
        }

        #[derive(serde::Deserialize)]
        struct OcrResponse {
            text: String,
        }

        let ocr_result: OcrResponse = response
            .json()
            .await
            .map_err(|e| Error::Internal(format!("Failed to parse OCR response: {}", e)))?;

        Ok(ocr_result.text)
    }
}
