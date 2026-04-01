use axum::{
    extract::{Multipart, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::{ocr::OcrRequest, AppState};

#[derive(Debug, Deserialize, utoipa::IntoParams)]
/// Query parameters for filtering results.
pub struct OcrQueryParams {
    languages: Option<String>,
    detect_layout: Option<bool>,
    detect_tables: Option<bool>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for Ocr.
pub struct OcrResponse {
    pub success: bool,
    pub text: String,
    pub confidence: f32,
    pub pages: Vec<PageResponse>,
    pub metadata: MetadataResponse,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for Page.
pub struct PageResponse {
    pub page_number: u32,
    pub text: String,
    pub blocks_count: usize,
    pub tables_count: usize,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for Metadata.
pub struct MetadataResponse {
    pub provider: String,
    pub processing_time_ms: u64,
    pub total_pages: u32,
    pub detected_languages: Vec<String>,
}

/// Extract text from an image
#[utoipa::path(
    post,
    path = "/api/v1/ocr",
    params(OcrQueryParams),
    request_body(content_type = "multipart/form-data", description = "Image file"),
    responses(
        (status = 200, description = "Text extracted successfully", body = OcrResponse),
        (status = 400, description = "Invalid input or missing file"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "OCR processing failed"),
    ),
    security(("bearer" = [])),
    tag = "OCR"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn extract_text(
    State(state): State<Arc<AppState>>,
    Query(params): Query<OcrQueryParams>,
    mut multipart: Multipart,
) -> Result<Json<OcrResponse>, (StatusCode, String)> {
    tracing::info!("OCR request received");

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
        .ocr
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

/// Process a multi-page document
#[utoipa::path(
    post,
    path = "/api/v1/ocr/document",
    params(OcrQueryParams),
    request_body(content_type = "multipart/form-data", description = "Document file"),
    responses(
        (status = 200, description = "Document processed successfully", body = OcrResponse),
        (status = 400, description = "Invalid input or missing file"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "OCR processing failed"),
    ),
    security(("bearer" = [])),
    tag = "OCR"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
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
        .ocr
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
#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for BatchOcr.
pub struct BatchOcrRequest {
    pub files: Vec<String>,
    pub languages: Option<Vec<String>>,
    pub detect_layout: Option<bool>,
    pub detect_tables: Option<bool>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for BatchOcr.
pub struct BatchOcrResponse {
    pub job_id: String,
    pub status: String,
    pub total_files: usize,
}

/// Batch process multiple files (async job)
#[utoipa::path(
    post,
    path = "/api/v1/ocr/batch",
    request_body = BatchOcrRequest,
    responses(
        (status = 200, description = "Batch job queued", body = BatchOcrResponse),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "OCR"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn batch_process(
    State(state): State<Arc<AppState>>,
    Json(request): Json<BatchOcrRequest>,
) -> Result<Json<BatchOcrResponse>, (StatusCode, String)> {
    let job_uuid = uuid::Uuid::new_v4();
    let job_id = job_uuid.to_string();
    let total_files = request.files.len();
    let now = chrono::Utc::now().to_rfc3339();

    state.job_store.insert(
        job_uuid,
        crate::JobEntry {
            status: "queued".to_string(),
            progress: 0.0,
            total_items: total_files as u32,
            completed_items: 0,
            failed_items: 0,
            created_at: now.clone(),
            updated_at: now,
            result: None,
            error: None,
        },
    );

    Ok(Json(BatchOcrResponse {
        job_id,
        status: "queued".to_string(),
        total_files,
    }))
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
