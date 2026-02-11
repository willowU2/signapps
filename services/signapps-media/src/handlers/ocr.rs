use axum::{
    extract::{Multipart, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::{ocr::OcrRequest, AppState};

#[derive(Debug, Deserialize)]
pub struct OcrQueryParams {
    languages: Option<String>,
    detect_layout: Option<bool>,
    detect_tables: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct OcrResponse {
    pub success: bool,
    pub text: String,
    pub confidence: f32,
    pub pages: Vec<PageResponse>,
    pub metadata: MetadataResponse,
}

#[derive(Debug, Serialize)]
pub struct PageResponse {
    pub page_number: u32,
    pub text: String,
    pub blocks_count: usize,
    pub tables_count: usize,
}

#[derive(Debug, Serialize)]
pub struct MetadataResponse {
    pub provider: String,
    pub processing_time_ms: u64,
    pub total_pages: u32,
    pub detected_languages: Vec<String>,
}

/// Extract text from an image
pub async fn extract_text(
    State(state): State<Arc<AppState>>,
    Query(params): Query<OcrQueryParams>,
    mut multipart: Multipart,
) -> Result<Json<OcrResponse>, (StatusCode, String)> {
    tracing::info!("OCR request received");

    // Get the file from multipart
    let field = multipart
        .next_field()
        .await
        .map_err(|e| {
            tracing::error!("Failed to read multipart: {}", e);
            (
                StatusCode::BAD_REQUEST,
                format!("Failed to read multipart: {}", e),
            )
        })?
        .ok_or_else(|| {
            tracing::error!("No file provided in request");
            (StatusCode::BAD_REQUEST, "No file provided".to_string())
        })?;

    let filename = field.file_name().unwrap_or("image").to_string();
    tracing::info!("Processing file: {}", filename);

    let data = field.bytes().await.map_err(|e| {
        tracing::error!("Failed to read file bytes: {}", e);
        (
            StatusCode::BAD_REQUEST,
            format!("Failed to read file: {}", e),
        )
    })?;

    tracing::info!("File size: {} bytes", data.len());

    let options = OcrRequest {
        languages: params
            .languages
            .map(|s| s.split(',').map(|s| s.trim().to_string()).collect()),
        detect_layout: params.detect_layout,
        detect_tables: params.detect_tables,
    };

    let result = state
        .ocr_client
        .extract_text(data, Some(options))
        .await
        .map_err(|e| {
            tracing::error!("OCR processing failed: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("OCR failed: {}", e),
            )
        })?;

    tracing::info!("OCR completed: {} characters extracted", result.text.len());

    Ok(Json(OcrResponse {
        success: true,
        text: result.text.clone(),
        confidence: result.confidence,
        pages: result
            .pages
            .iter()
            .map(|p| PageResponse {
                page_number: p.page_number,
                text: p.text.clone(),
                blocks_count: p.blocks.len(),
                tables_count: p.tables.as_ref().map(|t| t.len()).unwrap_or(0),
            })
            .collect(),
        metadata: MetadataResponse {
            provider: result.metadata.provider,
            processing_time_ms: result.metadata.processing_time_ms,
            total_pages: result.metadata.total_pages,
            detected_languages: result.metadata.detected_languages,
        },
    }))
}

/// Process a multi-page document (PDF, DOCX, etc.)
pub async fn process_document(
    State(state): State<Arc<AppState>>,
    Query(params): Query<OcrQueryParams>,
    mut multipart: Multipart,
) -> Result<Json<OcrResponse>, (StatusCode, String)> {
    let field = multipart
        .next_field()
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                format!("Failed to read multipart: {}", e),
            )
        })?
        .ok_or((StatusCode::BAD_REQUEST, "No file provided".to_string()))?;

    let filename = field.file_name().unwrap_or("document").to_string();
    let data = field.bytes().await.map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            format!("Failed to read file: {}", e),
        )
    })?;

    let options = OcrRequest {
        languages: params
            .languages
            .map(|s| s.split(',').map(|s| s.trim().to_string()).collect()),
        detect_layout: params.detect_layout,
        detect_tables: params.detect_tables,
    };

    let result = state
        .ocr_client
        .process_document(data, &filename, Some(options))
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Document OCR failed: {}", e),
            )
        })?;

    Ok(Json(OcrResponse {
        success: true,
        text: result.text.clone(),
        confidence: result.confidence,
        pages: result
            .pages
            .iter()
            .map(|p| PageResponse {
                page_number: p.page_number,
                text: p.text.clone(),
                blocks_count: p.blocks.len(),
                tables_count: p.tables.as_ref().map(|t| t.len()).unwrap_or(0),
            })
            .collect(),
        metadata: MetadataResponse {
            provider: result.metadata.provider,
            processing_time_ms: result.metadata.processing_time_ms,
            total_pages: result.metadata.total_pages,
            detected_languages: result.metadata.detected_languages,
        },
    }))
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct BatchOcrRequest {
    pub files: Vec<String>, // File paths from storage
    pub languages: Option<Vec<String>>,
    pub detect_layout: Option<bool>,
    pub detect_tables: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct BatchOcrResponse {
    pub job_id: String,
    pub status: String,
    pub total_files: usize,
}

/// Batch process multiple files (async job)
pub async fn batch_process(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<BatchOcrRequest>,
) -> Result<Json<BatchOcrResponse>, (StatusCode, String)> {
    let job_id = uuid::Uuid::new_v4().to_string();

    // TODO: Create async job for batch processing
    // This would queue the files for processing and return immediately

    Ok(Json(BatchOcrResponse {
        job_id,
        status: "queued".to_string(),
        total_files: request.files.len(),
    }))
}
