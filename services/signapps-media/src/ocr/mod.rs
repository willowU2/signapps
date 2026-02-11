//! OCR Module - RapidOCR/PaddleOCR integration
//!
//! Uses RapidOCR which is based on PaddleOCR with high accuracy
//! and table detection support.

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use bytes::Bytes;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::OcrProvider;

#[derive(Clone)]
pub struct OcrClient {
    client: Client,
    base_url: String,
    provider: OcrProvider,
}

#[derive(Debug, Serialize)]
pub struct OcrRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub languages: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detect_layout: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detect_tables: Option<bool>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct OcrResult {
    pub text: String,
    pub confidence: f32,
    pub pages: Vec<OcrPage>,
    pub metadata: OcrMetadata,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
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
pub struct TextBlock {
    pub text: String,
    pub confidence: f32,
    pub bbox: BoundingBox,
    pub block_type: BlockType,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct BoundingBox {
    pub x1: f32,
    pub y1: f32,
    pub x2: f32,
    pub y2: f32,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "lowercase")]
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
pub struct Table {
    pub rows: Vec<Vec<String>>,
    pub bbox: BoundingBox,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct OcrMetadata {
    pub provider: String,
    pub model: String,
    pub processing_time_ms: u64,
    pub total_pages: u32,
    pub detected_languages: Vec<String>,
}

impl OcrClient {
    pub fn new(base_url: &str, provider: OcrProvider) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(300)) // 5 min timeout for large documents
            .build()
            .expect("Failed to build HTTP client");

        Self {
            client,
            base_url: base_url.trim_end_matches('/').to_string(),
            provider,
        }
    }

    /// Extract text from an image using RapidOCR (PaddleOCR-based) API
    pub async fn extract_text(&self, image_data: Bytes, _options: Option<OcrRequest>) -> Result<OcrResult, OcrError> {
        let start = std::time::Instant::now();

        // RapidOCR API expects image as base64 in JSON body
        let image_base64 = BASE64.encode(&image_data);

        let payload = serde_json::json!({
            "image_base64": image_base64
        });

        let response = self.client
            .post(format!("{}/api/ocr", self.base_url))
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(OcrError::ServiceError(format!("OCR service error {}: {}", status, error_text)));
        }

        // RapidOCR returns JSON with ocr_result array
        let json_response: serde_json::Value = response.json().await?;

        // Extract text and blocks from RapidOCR response
        let (text, blocks, tables) = parse_rapidocr_response(&json_response);

        let processing_time = start.elapsed().as_millis() as u64;

        Ok(OcrResult {
            text: text.clone(),
            confidence: 0.95, // PaddleOCR typically has high confidence
            pages: vec![OcrPage {
                page_number: 1,
                text,
                width: 0,
                height: 0,
                blocks,
                tables: if tables.is_empty() { None } else { Some(tables) },
            }],
            metadata: OcrMetadata {
                provider: "rapidocr".to_string(),
                model: "paddleocr-v4".to_string(),
                processing_time_ms: processing_time,
                total_pages: 1,
                detected_languages: vec!["auto".to_string()],
            },
        })
    }

    /// Process a multi-page document (PDF)
    pub async fn process_document(&self, document_data: Bytes, filename: &str, options: Option<OcrRequest>) -> Result<OcrResult, OcrError> {
        let mime_type = mime_guess::from_path(filename)
            .first_or_octet_stream()
            .to_string();

        let form = reqwest::multipart::Form::new()
            .part("file", reqwest::multipart::Part::bytes(document_data.to_vec())
                .file_name(filename.to_string())
                .mime_str(&mime_type)?);

        let mut request = self.client
            .post(format!("{}/ocr/document", self.base_url))
            .multipart(form);

        if let Some(opts) = options {
            if let Some(langs) = opts.languages {
                request = request.query(&[("languages", langs.join(","))]);
            }
            if let Some(detect_layout) = opts.detect_layout {
                request = request.query(&[("detect_layout", detect_layout.to_string())]);
            }
            if let Some(detect_tables) = opts.detect_tables {
                request = request.query(&[("detect_tables", detect_tables.to_string())]);
            }
        }

        let response = request.send().await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(OcrError::ServiceError(format!("OCR service error {}: {}", status, error_text)));
        }

        let result: OcrResult = response.json().await?;
        Ok(result)
    }

    /// Get supported languages
    pub async fn get_supported_languages(&self) -> Result<Vec<String>, OcrError> {
        let response = self.client
            .get(format!("{}/languages", self.base_url))
            .send()
            .await?;

        if !response.status().is_success() {
            return Ok(vec!["en".to_string(), "fr".to_string(), "de".to_string(), "es".to_string()]);
        }

        let languages: Vec<String> = response.json().await?;
        Ok(languages)
    }

    pub fn provider_name(&self) -> &'static str {
        match self.provider {
            OcrProvider::Surya => "surya",
            OcrProvider::PaddleOCR => "paddleocr",
        }
    }
}

/// Parse RapidOCR JSON response
/// Format: {"ocr_result": [[[x1,y1],[x2,y2],[x3,y3],[x4,y4]], "text", confidence], ...}
fn parse_rapidocr_response(response: &serde_json::Value) -> (String, Vec<TextBlock>, Vec<Table>) {
    let mut text_parts = Vec::new();
    let mut blocks = Vec::new();
    let tables = Vec::new(); // RapidOCR table detection would need separate parsing

    // Try to get ocr_result array
    if let Some(results) = response.get("ocr_result").and_then(|r| r.as_array()) {
        for item in results {
            if let Some(arr) = item.as_array() {
                // Format: [bbox_points, text, confidence]
                if arr.len() >= 3 {
                    let text = arr.get(1).and_then(|t| t.as_str()).unwrap_or("");
                    let confidence = arr.get(2).and_then(|c| c.as_f64()).unwrap_or(0.9) as f32;

                    if !text.is_empty() {
                        text_parts.push(text.to_string());

                        // Extract bounding box from first element [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
                        let bbox = if let Some(points) = arr.get(0).and_then(|p| p.as_array()) {
                            if points.len() >= 4 {
                                let get_point = |idx: usize| -> (f32, f32) {
                                    points.get(idx)
                                        .and_then(|p| p.as_array())
                                        .map(|coords| {
                                            let x = coords.get(0).and_then(|v| v.as_f64()).unwrap_or(0.0) as f32;
                                            let y = coords.get(1).and_then(|v| v.as_f64()).unwrap_or(0.0) as f32;
                                            (x, y)
                                        })
                                        .unwrap_or((0.0, 0.0))
                                };
                                let (x1, y1) = get_point(0);
                                let (x2, y2) = get_point(2);
                                BoundingBox { x1, y1, x2, y2 }
                            } else {
                                BoundingBox { x1: 0.0, y1: 0.0, x2: 0.0, y2: 0.0 }
                            }
                        } else {
                            BoundingBox { x1: 0.0, y1: 0.0, x2: 0.0, y2: 0.0 }
                        };

                        blocks.push(TextBlock {
                            text: text.to_string(),
                            confidence,
                            bbox,
                            block_type: BlockType::Text,
                        });
                    }
                }
            }
        }
    }

    // If no ocr_result, try alternative formats
    if text_parts.is_empty() {
        if let Some(text) = response.get("text").and_then(|t| t.as_str()) {
            text_parts.push(text.to_string());
        }
    }

    (text_parts.join("\n"), blocks, tables)
}

#[derive(Debug, thiserror::Error)]
pub enum OcrError {
    #[error("HTTP error: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("Service error: {0}")]
    ServiceError(String),

    #[error("Invalid response: {0}")]
    InvalidResponse(String),
}

