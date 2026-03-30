//! OCR Module - Optical Character Recognition with pluggable backends.
//!
//! Supports:
//! - HTTP backend (RapidOCR/PaddleOCR via Docker) when OCR_URL is set
//! - Native backend (ocrs) when OCR_URL is empty

use async_trait::async_trait;
use bytes::Bytes;
use serde::{Deserialize, Serialize};

pub mod http;
#[cfg(feature = "native-ocr")]
pub mod native;

pub use self::http::HttpOcrBackend;
#[cfg(feature = "native-ocr")]
pub use self::native::NativeOcrBackend;

/// Stub backend that returns errors when no OCR backend is configured.
pub struct StubOcrBackend;

#[async_trait]
impl OcrBackend for StubOcrBackend {
    async fn extract_text(
        &self,
        _image_data: Bytes,
        _options: Option<OcrRequest>,
    ) -> Result<OcrResult, OcrError> {
        Err(OcrError::ServiceError(
            "OCR not configured. Set OCR_URL or enable native-ocr feature.".to_string(),
        ))
    }

    async fn process_document(
        &self,
        _document_data: Bytes,
        _filename: &str,
        _options: Option<OcrRequest>,
    ) -> Result<OcrResult, OcrError> {
        Err(OcrError::ServiceError(
            "OCR not configured. Set OCR_URL or enable native-ocr feature.".to_string(),
        ))
    }
}

/// Backend trait for OCR implementations.
#[async_trait]
pub trait OcrBackend: Send + Sync {
    /// Extract text from an image.
    async fn extract_text(
        &self,
        image_data: Bytes,
        options: Option<OcrRequest>,
    ) -> Result<OcrResult, OcrError>;

    /// Process a multi-page document (PDF, etc).
    async fn process_document(
        &self,
        document_data: Bytes,
        filename: &str,
        options: Option<OcrRequest>,
    ) -> Result<OcrResult, OcrError>;
}

#[derive(Debug, Serialize)]
/// Request payload for Ocr operation.
pub struct OcrRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub languages: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detect_layout: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detect_tables: Option<bool>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
/// Represents a ocr result.
pub struct OcrResult {
    pub text: String,
    pub confidence: f32,
    pub pages: Vec<OcrPage>,
    pub metadata: OcrMetadata,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
/// Represents a ocr page.
pub struct OcrPage {
    pub page_number: u32,
    pub text: String,
    pub width: u32,
    pub height: u32,
    pub blocks: Vec<TextBlock>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tables: Option<Vec<Table>>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
/// Represents a text block.
pub struct TextBlock {
    pub text: String,
    pub confidence: f32,
    pub bbox: BoundingBox,
    pub block_type: BlockType,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
/// Represents a bounding box.
pub struct BoundingBox {
    pub x1: f32,
    pub y1: f32,
    pub x2: f32,
    pub y2: f32,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "lowercase")]
/// Enum representing BlockType variants.
pub enum BlockType {
    Text,
    Title,
    Header,
    Footer,
    Caption,
    Table,
    Figure,
    List,
    Code,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
/// Represents a table.
pub struct Table {
    pub rows: Vec<Vec<String>>,
    pub bbox: BoundingBox,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
/// Represents a ocr metadata.
pub struct OcrMetadata {
    pub provider: String,
    pub model: String,
    pub processing_time_ms: u64,
    pub total_pages: u32,
    pub detected_languages: Vec<String>,
}

#[derive(Debug, thiserror::Error)]
/// Error type for Ocr operations.
pub enum OcrError {
    #[error("HTTP error: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("Service error: {0}")]
    ServiceError(String),

    #[error("Invalid response: {0}")]
    InvalidResponse(String),

    #[error("Model error: {0}")]
    ModelError(String),
}
