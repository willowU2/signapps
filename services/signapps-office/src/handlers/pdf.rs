//! PDF operations HTTP handlers.

use axum::{
    extract::Multipart,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::pdf::{extract_text, get_page_dimensions, get_pdf_info, merge_pdfs, split_pdf, PdfError};

/// PDF info response
#[derive(Debug, Serialize)]
pub struct PdfInfoResponse {
    pub service: &'static str,
    pub version: &'static str,
    pub operations: Vec<&'static str>,
}

/// Get PDF operations info
pub async fn pdf_info() -> Json<PdfInfoResponse> {
    Json(PdfInfoResponse {
        service: "SignApps Office - PDF Operations",
        version: "1.0.0",
        operations: vec![
            "extract_text",
            "merge",
            "split",
            "info",
            "page_dimensions",
        ],
    })
}

/// Extract text from a PDF
pub async fn extract_pdf_text(mut multipart: Multipart) -> Response {
    let mut pdf_data: Option<Vec<u8>> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or_default().to_string();

        if name == "file" {
            match field.bytes().await {
                Ok(bytes) => pdf_data = Some(bytes.to_vec()),
                Err(e) => {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(serde_json::json!({
                            "error": "Failed to read file",
                            "message": e.to_string()
                        })),
                    )
                        .into_response();
                }
            }
        }
    }

    let pdf_data = match pdf_data {
        Some(data) => data,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "No file provided"
                })),
            )
                .into_response();
        }
    };

    match extract_text(&pdf_data) {
        Ok(text) => Json(serde_json::json!({
            "text": text,
            "success": true
        }))
        .into_response(),
        Err(e) => error_response(e),
    }
}

/// Get PDF document info
pub async fn get_pdf_document_info(mut multipart: Multipart) -> Response {
    let mut pdf_data: Option<Vec<u8>> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or_default().to_string();

        if name == "file" {
            match field.bytes().await {
                Ok(bytes) => pdf_data = Some(bytes.to_vec()),
                Err(e) => {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(serde_json::json!({
                            "error": "Failed to read file",
                            "message": e.to_string()
                        })),
                    )
                        .into_response();
                }
            }
        }
    }

    let pdf_data = match pdf_data {
        Some(data) => data,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "No file provided"
                })),
            )
                .into_response();
        }
    };

    match get_pdf_info(&pdf_data) {
        Ok(info) => Json(info).into_response(),
        Err(e) => error_response(e),
    }
}

/// Get page dimensions for all pages
pub async fn get_pdf_pages(mut multipart: Multipart) -> Response {
    let mut pdf_data: Option<Vec<u8>> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or_default().to_string();

        if name == "file" {
            match field.bytes().await {
                Ok(bytes) => pdf_data = Some(bytes.to_vec()),
                Err(e) => {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(serde_json::json!({
                            "error": "Failed to read file",
                            "message": e.to_string()
                        })),
                    )
                        .into_response();
                }
            }
        }
    }

    let pdf_data = match pdf_data {
        Some(data) => data,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "No file provided"
                })),
            )
                .into_response();
        }
    };

    match get_page_dimensions(&pdf_data) {
        Ok(pages) => Json(serde_json::json!({
            "pages": pages,
            "count": pages.len()
        }))
        .into_response(),
        Err(e) => error_response(e),
    }
}

/// Merge request for JSON-based merge
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct MergeRequest {
    /// Base64-encoded PDF files
    pub files: Vec<String>,
}

/// Merge multiple PDFs from multipart upload
pub async fn merge_pdf_files(mut multipart: Multipart) -> Response {
    let mut pdf_files: Vec<Vec<u8>> = Vec::new();

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or_default().to_string();

        if name == "file" || name.starts_with("file") {
            match field.bytes().await {
                Ok(bytes) => pdf_files.push(bytes.to_vec()),
                Err(e) => {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(serde_json::json!({
                            "error": "Failed to read file",
                            "message": e.to_string()
                        })),
                    )
                        .into_response();
                }
            }
        }
    }

    if pdf_files.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "No files provided"
            })),
        )
            .into_response();
    }

    let file_refs: Vec<&[u8]> = pdf_files.iter().map(|f| f.as_slice()).collect();

    match merge_pdfs(&file_refs) {
        Ok(merged_data) => (
            StatusCode::OK,
            [
                (
                    "Content-Type",
                    "application/pdf",
                ),
                (
                    "Content-Disposition",
                    "attachment; filename=\"merged.pdf\"",
                ),
            ],
            merged_data,
        )
            .into_response(),
        Err(e) => error_response(e),
    }
}

/// Split request
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct SplitRequest {
    /// Page ranges to extract (1-based)
    pub ranges: Vec<(u32, u32)>,
}

/// Split a PDF by page ranges
pub async fn split_pdf_file(mut multipart: Multipart) -> Response {
    let mut pdf_data: Option<Vec<u8>> = None;
    let mut ranges: Vec<(u32, u32)> = Vec::new();

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or_default().to_string();

        match name.as_str() {
            "file" => {
                match field.bytes().await {
                    Ok(bytes) => pdf_data = Some(bytes.to_vec()),
                    Err(e) => {
                        return (
                            StatusCode::BAD_REQUEST,
                            Json(serde_json::json!({
                                "error": "Failed to read file",
                                "message": e.to_string()
                            })),
                        )
                            .into_response();
                    }
                }
            }
            "ranges" => {
                match field.text().await {
                    Ok(text) => {
                        // Parse ranges like "1-5,6-10" or JSON array
                        if let Ok(parsed) = serde_json::from_str::<Vec<(u32, u32)>>(&text) {
                            ranges = parsed;
                        } else {
                            // Try parsing comma-separated ranges
                            for range_str in text.split(',') {
                                let parts: Vec<&str> = range_str.trim().split('-').collect();
                                if parts.len() == 2 {
                                    if let (Ok(start), Ok(end)) =
                                        (parts[0].parse::<u32>(), parts[1].parse::<u32>())
                                    {
                                        ranges.push((start, end));
                                    }
                                } else if parts.len() == 1 {
                                    if let Ok(page) = parts[0].parse::<u32>() {
                                        ranges.push((page, page));
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        return (
                            StatusCode::BAD_REQUEST,
                            Json(serde_json::json!({
                                "error": "Failed to read ranges",
                                "message": e.to_string()
                            })),
                        )
                            .into_response();
                    }
                }
            }
            _ => {}
        }
    }

    let pdf_data = match pdf_data {
        Some(data) => data,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "No file provided"
                })),
            )
                .into_response();
        }
    };

    if ranges.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "No ranges provided",
                "hint": "Provide ranges as 'ranges' field, e.g., '1-5,6-10' or JSON array [[1,5],[6,10]]"
            })),
        )
            .into_response();
    }

    match split_pdf(&pdf_data, &ranges) {
        Ok(split_pdfs) => {
            use base64::Engine;

            // Return base64-encoded PDFs for each range
            let results: Vec<serde_json::Value> = split_pdfs
                .iter()
                .enumerate()
                .map(|(i, data)| {
                    serde_json::json!({
                        "range": ranges[i],
                        "data_base64": base64::engine::general_purpose::STANDARD.encode(data),
                        "size_bytes": data.len()
                    })
                })
                .collect();

            Json(serde_json::json!({
                "success": true,
                "count": results.len(),
                "results": results
            }))
            .into_response()
        }
        Err(e) => error_response(e),
    }
}

/// Convert PdfError to HTTP response
fn error_response(err: PdfError) -> Response {
    let (status, message) = match &err {
        PdfError::InvalidInput(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
        PdfError::ParseError(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
        PdfError::OperationFailed(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg.clone()),
        PdfError::IoError(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    };

    tracing::error!("PDF operation error: {:?}", err);

    (
        status,
        Json(serde_json::json!({
            "error": "PDF operation failed",
            "message": message
        })),
    )
        .into_response()
}
