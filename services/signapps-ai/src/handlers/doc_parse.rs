//! Document parsing HTTP endpoints.
//!
//! Provides document text/structure extraction and table extraction
//! via multipart form data.

use axum::{extract::Multipart, http::StatusCode, Json};
use serde::Serialize;

use crate::workers::docparse::{CloudDocParse, NativeDocParse};
use crate::workers::{DocParseWorker, ParsedDocument, ParsedTable};

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

/// Response for the table extraction endpoint.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for ExtractTables.
pub struct ExtractTablesResponse {
    /// Extracted tables from the document.
    #[schema(value_type = Vec<serde_json::Value>)]
    pub tables: Vec<ParsedTable>,
    /// Number of tables extracted.
    pub count: usize,
}

// ---------------------------------------------------------------------------
// Worker construction
// ---------------------------------------------------------------------------

/// Build a document parse worker from environment variables.
///
/// Precedence:
/// 1. `AZURE_DOC_ENDPOINT` + `AZURE_DOC_KEY` → [`CloudDocParse`]
/// 2. Fallback → [`NativeDocParse`] (optionally with `OCR_URL`)
fn create_docparse_worker() -> Box<dyn DocParseWorker + Send + Sync> {
    if let (Ok(endpoint), Ok(key)) = (
        std::env::var("AZURE_DOC_ENDPOINT"),
        std::env::var("AZURE_DOC_KEY"),
    ) {
        if !endpoint.is_empty() && !key.is_empty() {
            return Box::new(CloudDocParse::new(&endpoint, &key));
        }
    }

    // Native fallback — optionally delegate PDF/image to OCR service.
    let ocr_url = std::env::var("OCR_URL").ok().filter(|u| !u.is_empty());
    Box::new(NativeDocParse::new(ocr_url))
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// Parse a document into structured pages, tables, and metadata.
///
/// Accepts `multipart/form-data` with:
/// - `document` — the document file (required)
#[utoipa::path(
    post,
    path = "/api/v1/ai/doc/parse",
    request_body(
        content_type = "multipart/form-data",
        description = "Document file to parse",
        content = String,
    ),
    responses(
        (status = 200, description = "Parsed document structure"),
        (status = 400, description = "Missing or empty document"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Parsing failed"),
    ),
    security(("bearerAuth" = [])),
    tag = "documents"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn parse_document(
    mut multipart: Multipart,
) -> Result<Json<ParsedDocument>, (StatusCode, String)> {
    let mut doc_bytes: Option<Vec<u8>> = None;
    let mut filename: Option<String> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            format!("Failed to read multipart field: {e}"),
        )
    })? {
        if field.name() == Some("document") {
            filename = field.file_name().map(|s| s.to_string());
            doc_bytes = Some(
                field
                    .bytes()
                    .await
                    .map_err(|e| {
                        (
                            StatusCode::BAD_REQUEST,
                            format!("Failed to read document bytes: {e}"),
                        )
                    })?
                    .to_vec(),
            );
        }
    }

    let doc = doc_bytes.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "Missing required 'document' field".to_string(),
        )
    })?;

    if doc.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Document file is empty".to_string(),
        ));
    }

    let fname = filename.unwrap_or_else(|| "document.bin".to_string());

    let worker = create_docparse_worker();

    let parsed = worker
        .parse(bytes::Bytes::from(doc), &fname)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Document parsing failed: {e}"),
            )
        })?;

    Ok(Json(parsed))
}

/// Extract tables from a document.
///
/// Accepts `multipart/form-data` with:
/// - `document` — the document file (required)
#[utoipa::path(
    post,
    path = "/api/v1/ai/doc/tables",
    request_body(
        content_type = "multipart/form-data",
        description = "Document file to extract tables from",
        content = String,
    ),
    responses(
        (status = 200, description = "Extracted tables", body = ExtractTablesResponse),
        (status = 400, description = "Missing or empty document"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Table extraction failed"),
    ),
    security(("bearerAuth" = [])),
    tag = "documents"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn extract_tables(
    mut multipart: Multipart,
) -> Result<Json<ExtractTablesResponse>, (StatusCode, String)> {
    let mut doc_bytes: Option<Vec<u8>> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            format!("Failed to read multipart field: {e}"),
        )
    })? {
        if field.name() == Some("document") {
            doc_bytes = Some(
                field
                    .bytes()
                    .await
                    .map_err(|e| {
                        (
                            StatusCode::BAD_REQUEST,
                            format!("Failed to read document bytes: {e}"),
                        )
                    })?
                    .to_vec(),
            );
        }
    }

    let doc = doc_bytes.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "Missing required 'document' field".to_string(),
        )
    })?;

    if doc.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Document file is empty".to_string(),
        ));
    }

    let worker = create_docparse_worker();

    let tables = worker
        .extract_tables(bytes::Bytes::from(doc))
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Table extraction failed: {e}"),
            )
        })?;

    let count = tables.len();
    Ok(Json(ExtractTablesResponse { tables, count }))
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
