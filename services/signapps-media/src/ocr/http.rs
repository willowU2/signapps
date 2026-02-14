//! HTTP-based OCR backend (RapidOCR/PaddleOCR Docker service).

use async_trait::async_trait;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use bytes::Bytes;
use reqwest::Client;
use std::time::Duration;

use super::*;

/// OCR provider type for HTTP backend.
#[derive(Clone, Debug, Default)]
#[allow(dead_code)]
pub enum OcrProvider {
    #[default]
    Surya,
    PaddleOCR,
}

/// HTTP OCR backend connecting to an external OCR service.
pub struct HttpOcrBackend {
    client: Client,
    base_url: String,
    provider: OcrProvider,
}

impl HttpOcrBackend {
    pub fn new(base_url: &str, provider: OcrProvider) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(300))
            .build()
            .expect("Failed to build HTTP client");

        Self {
            client,
            base_url: base_url.trim_end_matches('/').to_string(),
            provider,
        }
    }

    pub fn provider_name(&self) -> &'static str {
        match self.provider {
            OcrProvider::Surya => "surya",
            OcrProvider::PaddleOCR => "paddleocr",
        }
    }
}

#[async_trait]
impl OcrBackend for HttpOcrBackend {
    async fn extract_text(
        &self,
        image_data: Bytes,
        _options: Option<OcrRequest>,
    ) -> Result<OcrResult, OcrError> {
        let start = std::time::Instant::now();

        let image_base64 = BASE64.encode(&image_data);

        let payload = serde_json::json!({
            "image_base64": image_base64
        });

        let response = self
            .client
            .post(format!("{}/api/ocr", self.base_url))
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(OcrError::ServiceError(format!(
                "OCR service error {}: {}",
                status, error_text
            )));
        }

        let json_response: serde_json::Value = response.json().await?;
        let (text, blocks, tables) = parse_rapidocr_response(&json_response);

        let processing_time = start.elapsed().as_millis() as u64;

        Ok(OcrResult {
            text: text.clone(),
            confidence: 0.95,
            pages: vec![OcrPage {
                page_number: 1,
                text,
                width: 0,
                height: 0,
                blocks,
                tables: if tables.is_empty() {
                    None
                } else {
                    Some(tables)
                },
            }],
            metadata: OcrMetadata {
                provider: self.provider_name().to_string(),
                model: "paddleocr-v4".to_string(),
                processing_time_ms: processing_time,
                total_pages: 1,
                detected_languages: vec!["auto".to_string()],
            },
        })
    }

    async fn process_document(
        &self,
        document_data: Bytes,
        filename: &str,
        options: Option<OcrRequest>,
    ) -> Result<OcrResult, OcrError> {
        let mime_type = mime_guess::from_path(filename)
            .first_or_octet_stream()
            .to_string();

        let form = reqwest::multipart::Form::new().part(
            "file",
            reqwest::multipart::Part::bytes(document_data.to_vec())
                .file_name(filename.to_string())
                .mime_str(&mime_type)?,
        );

        let mut request = self
            .client
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
            return Err(OcrError::ServiceError(format!(
                "OCR service error {}: {}",
                status, error_text
            )));
        }

        let result: OcrResult = response.json().await?;
        Ok(result)
    }
}

/// Parse RapidOCR JSON response.
fn parse_rapidocr_response(response: &serde_json::Value) -> (String, Vec<TextBlock>, Vec<Table>) {
    let mut text_parts = Vec::new();
    let mut blocks = Vec::new();
    let tables = Vec::new();

    if let Some(results) = response.get("ocr_result").and_then(|r| r.as_array()) {
        for item in results {
            if let Some(arr) = item.as_array() {
                if arr.len() >= 3 {
                    let text = arr.get(1).and_then(|t| t.as_str()).unwrap_or("");
                    let confidence = arr.get(2).and_then(|c| c.as_f64()).unwrap_or(0.9) as f32;

                    if !text.is_empty() {
                        text_parts.push(text.to_string());

                        let bbox = if let Some(points) = arr.first().and_then(|p| p.as_array()) {
                            if points.len() >= 4 {
                                let get_point = |idx: usize| -> (f32, f32) {
                                    points
                                        .get(idx)
                                        .and_then(|p| p.as_array())
                                        .map(|coords| {
                                            let x = coords
                                                .first()
                                                .and_then(|v| v.as_f64())
                                                .unwrap_or(0.0)
                                                as f32;
                                            let y = coords
                                                .get(1)
                                                .and_then(|v| v.as_f64())
                                                .unwrap_or(0.0)
                                                as f32;
                                            (x, y)
                                        })
                                        .unwrap_or((0.0, 0.0))
                                };
                                let (x1, y1) = get_point(0);
                                let (x2, y2) = get_point(2);
                                BoundingBox { x1, y1, x2, y2 }
                            } else {
                                BoundingBox {
                                    x1: 0.0,
                                    y1: 0.0,
                                    x2: 0.0,
                                    y2: 0.0,
                                }
                            }
                        } else {
                            BoundingBox {
                                x1: 0.0,
                                y1: 0.0,
                                x2: 0.0,
                                y2: 0.0,
                            }
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

    if text_parts.is_empty() {
        if let Some(text) = response.get("text").and_then(|t| t.as_str()) {
            text_parts.push(text.to_string());
        }
    }

    (text_parts.join("\n"), blocks, tables)
}
