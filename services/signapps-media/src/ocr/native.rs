//! Native OCR backend using ocrs (ONNX-based OCR engine).

use async_trait::async_trait;
use bytes::Bytes;
use ocrs::{OcrEngine, OcrEngineParams};
use rten::Model;
use signapps_runtime::ModelManager;
use std::sync::Arc;

use super::*;

/// Native OCR backend using ocrs with rten ONNX runtime.
pub struct NativeOcrBackend {
    engine: Arc<OcrEngine>,
    #[allow(dead_code)]
    model_manager: Arc<ModelManager>,
}

// SAFETY: OcrEngine uses rten::Model internally which runs ONNX operators that are thread-safe.
// Verified: rten Model uses Arc<ModelData> internally. OcrEngine holds no mutable state after
// initialization — all inference methods take &self. The engine is also wrapped in Arc above,
// ensuring the backing data lives long enough across threads.
unsafe impl Send for NativeOcrBackend {}
unsafe impl Sync for NativeOcrBackend {}

impl NativeOcrBackend {
    /// Create a new native OCR backend.
    pub async fn new(model_manager: Arc<ModelManager>) -> Result<Self, OcrError> {
        let detection_path = model_manager
            .ensure_model("ocrs-text-detection")
            .await
            .map_err(|e| OcrError::ModelError(format!("Detection model: {}", e)))?;

        let recognition_path = model_manager
            .ensure_model("ocrs-text-recognition")
            .await
            .map_err(|e| OcrError::ModelError(format!("Recognition model: {}", e)))?;

        tracing::info!(
            "Loading OCR models: detection={}, recognition={}",
            detection_path.display(),
            recognition_path.display()
        );

        let det_path = detection_path.to_string_lossy().to_string();
        let rec_path = recognition_path.to_string_lossy().to_string();

        let engine = tokio::task::spawn_blocking(move || {
            let detection_model = Model::load_file(&det_path)
                .map_err(|e| OcrError::ModelError(format!("Detection model load: {}", e)))?;

            let recognition_model = Model::load_file(&rec_path)
                .map_err(|e| OcrError::ModelError(format!("Recognition model load: {}", e)))?;

            let engine = OcrEngine::new(OcrEngineParams {
                detection_model: Some(detection_model),
                recognition_model: Some(recognition_model),
                ..Default::default()
            })
            .map_err(|e| OcrError::ModelError(format!("Engine creation: {}", e)))?;

            Ok::<_, OcrError>(engine)
        })
        .await
        .map_err(|e| OcrError::ServiceError(format!("Task join error: {}", e)))??;

        tracing::info!("OCR engine initialized successfully");

        Ok(Self {
            engine: Arc::new(engine),
            model_manager,
        })
    }
}

#[async_trait]
impl OcrBackend for NativeOcrBackend {
    async fn extract_text(
        &self,
        image_data: Bytes,
        _options: Option<OcrRequest>,
    ) -> Result<OcrResult, OcrError> {
        let start = std::time::Instant::now();
        let engine = self.engine.clone();
        let data = image_data.to_vec();

        let (text, blocks, width, height) = tokio::task::spawn_blocking(move || {
            // Decode image
            let img = image::load_from_memory(&data)
                .map_err(|e| OcrError::ServiceError(format!("Image decode failed: {}", e)))?;

            let rgb = img.to_rgb8();
            let (width, height) = rgb.dimensions();

            // Create ocrs image input
            let img_source = ocrs::ImageSource::from_bytes(rgb.as_raw(), rgb.dimensions())
                .map_err(|e| OcrError::ServiceError(format!("Image source: {}", e)))?;

            let ocr_input = engine
                .prepare_input(img_source)
                .map_err(|e| OcrError::ServiceError(format!("Prepare input: {}", e)))?;

            // Run OCR
            let word_rects = engine
                .detect_words(&ocr_input)
                .map_err(|e| OcrError::ServiceError(format!("Word detection: {}", e)))?;

            let line_rects = engine.find_text_lines(&ocr_input, &word_rects);

            let line_texts = engine
                .recognize_text(&ocr_input, &line_rects)
                .map_err(|e| OcrError::ServiceError(format!("Text recognition: {}", e)))?;

            let mut text_parts = Vec::new();
            let mut blocks = Vec::new();

            for line in &line_texts {
                if let Some(text_line) = line {
                    let text = text_line.to_string();
                    if !text.trim().is_empty() {
                        text_parts.push(text.clone());
                        blocks.push(TextBlock {
                            text,
                            confidence: 0.9,
                            bbox: BoundingBox {
                                x1: 0.0,
                                y1: 0.0,
                                x2: width as f32,
                                y2: height as f32,
                            },
                            block_type: BlockType::Text,
                        });
                    }
                }
            }

            Ok::<_, OcrError>((text_parts.join("\n"), blocks, width, height))
        })
        .await
        .map_err(|e| OcrError::ServiceError(format!("Task join error: {}", e)))??;

        let processing_time = start.elapsed().as_millis() as u64;

        Ok(OcrResult {
            text: text.clone(),
            confidence: 0.9,
            pages: vec![OcrPage {
                page_number: 1,
                text,
                width,
                height,
                blocks,
                tables: None,
            }],
            metadata: OcrMetadata {
                provider: "ocrs".to_string(),
                model: "ocrs-default".to_string(),
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
        // For native OCR, process as a single image for now
        // PDF support would need a PDF renderer (future enhancement)
        let ext = std::path::Path::new(filename)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");

        if ext.eq_ignore_ascii_case("pdf") {
            return Err(OcrError::ServiceError(
                "Native OCR does not support PDF yet. Set OCR_URL for PDF support.".to_string(),
            ));
        }

        // For images, delegate to extract_text
        self.extract_text(document_data, options).await
    }
}
