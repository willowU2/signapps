//! Unified document filter endpoints using FilterRegistry.
//!
//! Provides clean `/api/v1/filters/*` endpoints for format detection,
//! import, export, and format-to-format conversion via the intermediate
//! document model.

use axum::{
    extract::{Multipart, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_filters::{Format, FormatDetector, IntermediateDocument};

use crate::office::OfficeState;

/// Information about a supported document format.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct FormatInfo {
    /// Human-readable format name (e.g. "Docx", "Pdf").
    pub name: String,
    /// Canonical file extension without dot (e.g. "docx", "pdf").
    pub extension: String,
    /// MIME type for this format.
    pub mime_type: String,
    /// Whether import (bytes -> IntermediateDocument) is supported.
    pub can_import: bool,
    /// Whether export (IntermediateDocument -> bytes) is supported.
    pub can_export: bool,
}

/// GET /api/v1/filters/formats -- list all supported formats
///
/// Returns metadata for every format registered in the FilterRegistry,
/// including whether import and export are available.
///
/// # Errors
///
/// This endpoint does not produce errors.
///
/// # Panics
///
/// No panic possible.
#[utoipa::path(
    get,
    path = "/api/v1/filters/formats",
    tag = "Filters",
    responses(
        (status = 200, description = "Supported formats", body = Vec<FormatInfo>),
    )
)]
#[tracing::instrument(skip(state))]
pub async fn list_formats(State(state): State<OfficeState>) -> Json<Vec<FormatInfo>> {
    let registry = &state.filters;
    let formats = registry.supported_formats();

    let info: Vec<FormatInfo> = formats
        .iter()
        .map(|f| FormatInfo {
            name: format!("{f:?}"),
            extension: f.extension().to_string(),
            mime_type: f.mime_type().to_string(),
            can_import: registry.export_mime_type(*f).is_some(),
            can_export: registry.export_extension(*f).is_some(),
        })
        .collect();

    Json(info)
}

/// POST /api/v1/filters/import -- import a file via multipart upload
///
/// Accepts a multipart form with a `file` field. The format is auto-detected
/// from magic bytes and filename. Returns the parsed IntermediateDocument as JSON.
///
/// # Errors
///
/// Returns 400 if no file field is present, the format is unsupported,
/// or the import filter fails to parse the content.
///
/// # Panics
///
/// No panic possible.
#[utoipa::path(
    post,
    path = "/api/v1/filters/import",
    tag = "Filters",
    responses(
        (status = 200, description = "Imported document as JSON"),
        (status = 400, description = "Invalid file or unsupported format"),
    )
)]
#[tracing::instrument(skip(state, multipart))]
pub async fn import_file(
    State(state): State<OfficeState>,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut filename: Option<String> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        if field.name() == Some("file") {
            filename = field.file_name().map(|s| s.to_string());
            file_bytes = Some(
                field
                    .bytes()
                    .await
                    .map_err(|e| (StatusCode::BAD_REQUEST, format!("read error: {e}")))?
                    .to_vec(),
            );
        }
    }

    let bytes = file_bytes.ok_or((StatusCode::BAD_REQUEST, "no file field".to_string()))?;
    let format = FormatDetector::detect(&bytes, filename.as_deref());

    let registry = &state.filters;
    let doc = registry
        .import(format, &bytes)
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("import failed: {e}")))?;

    let json = serde_json::to_value(&doc)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("serialize: {e}")))?;

    Ok(Json(json))
}

/// Request body for the export endpoint.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct ExportRequest {
    /// Target format name (e.g. "docx", "pdf", "xlsx").
    pub format: String,
    /// The IntermediateDocument to export, as a JSON value.
    pub document: serde_json::Value,
}

/// POST /api/v1/filters/export -- export an IntermediateDocument to a target format
///
/// Accepts an `ExportRequest` JSON body containing the format name and the
/// intermediate document. Returns the exported file as a binary download.
///
/// # Errors
///
/// Returns 400 if the format string is unrecognised, the document JSON
/// cannot be deserialised, or the export filter fails.
///
/// # Panics
///
/// No panic possible.
#[utoipa::path(
    post,
    path = "/api/v1/filters/export",
    tag = "Filters",
    request_body = ExportRequest,
    responses(
        (status = 200, description = "Exported file bytes"),
        (status = 400, description = "Invalid format or document"),
    )
)]
#[tracing::instrument(skip(state, payload))]
pub async fn export_file(
    State(state): State<OfficeState>,
    Json(payload): Json<ExportRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let format = parse_format(&payload.format).ok_or((
        StatusCode::BAD_REQUEST,
        format!("unknown format: {}", payload.format),
    ))?;

    let doc: IntermediateDocument = serde_json::from_value(payload.document)
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("invalid document: {e}")))?;

    let registry = &state.filters;
    let bytes = registry
        .export(&doc, format)
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("export failed: {e}")))?;

    let mime = registry
        .export_mime_type(format)
        .unwrap_or("application/octet-stream");
    let ext = registry.export_extension(format).unwrap_or("bin");

    Ok((
        StatusCode::OK,
        [
            ("content-type", mime.to_string()),
            (
                "content-disposition",
                format!("attachment; filename=\"export.{ext}\""),
            ),
        ],
        bytes,
    ))
}

/// Query parameters for the convert endpoint.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ConvertQuery {
    /// Target format name (e.g. "pdf", "docx", "csv").
    pub target_format: String,
}

/// POST /api/v1/filters/convert -- convert from one format to another
///
/// Accepts a multipart form with a `file` field and a `target_format` query
/// parameter. The source format is auto-detected. The file is imported into
/// an IntermediateDocument and then re-exported in the target format.
///
/// # Errors
///
/// Returns 400 if no file is provided, the target format is unknown,
/// or either the import or export step fails.
///
/// # Panics
///
/// No panic possible.
#[utoipa::path(
    post,
    path = "/api/v1/filters/convert",
    tag = "Filters",
    params(ConvertQuery),
    responses(
        (status = 200, description = "Converted file"),
        (status = 400, description = "Conversion failed"),
    )
)]
#[tracing::instrument(skip(state, multipart))]
pub async fn convert_file(
    State(state): State<OfficeState>,
    Query(query): Query<ConvertQuery>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut filename: Option<String> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        if field.name() == Some("file") {
            filename = field.file_name().map(|s| s.to_string());
            file_bytes = Some(
                field
                    .bytes()
                    .await
                    .map_err(|e| (StatusCode::BAD_REQUEST, format!("read error: {e}")))?
                    .to_vec(),
            );
        }
    }

    let bytes = file_bytes.ok_or((StatusCode::BAD_REQUEST, "no file field".to_string()))?;
    let source_format = FormatDetector::detect(&bytes, filename.as_deref());
    let target_format = parse_format(&query.target_format).ok_or((
        StatusCode::BAD_REQUEST,
        format!("unknown target: {}", query.target_format),
    ))?;

    let registry = &state.filters;

    // Import -> IntermediateDocument -> Export
    let doc = registry
        .import(source_format, &bytes)
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("import failed: {e}")))?;
    let output = registry
        .export(&doc, target_format)
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("export failed: {e}")))?;

    let mime = registry
        .export_mime_type(target_format)
        .unwrap_or("application/octet-stream");
    let ext = registry.export_extension(target_format).unwrap_or("bin");

    Ok((
        StatusCode::OK,
        [
            ("content-type", mime.to_string()),
            (
                "content-disposition",
                format!("attachment; filename=\"converted.{ext}\""),
            ),
        ],
        output,
    ))
}

/// Parse a user-supplied format string into a `Format` enum variant.
fn parse_format(s: &str) -> Option<Format> {
    match s.to_lowercase().as_str() {
        "docx" => Some(Format::Docx),
        "xlsx" => Some(Format::Xlsx),
        "pptx" => Some(Format::Pptx),
        "odt" => Some(Format::Odt),
        "ods" => Some(Format::Ods),
        "odp" => Some(Format::Odp),
        "pdf" => Some(Format::Pdf),
        "csv" => Some(Format::Csv),
        "markdown" | "md" => Some(Format::Markdown),
        "html" => Some(Format::Html),
        "text" | "txt" => Some(Format::Text),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_format_known_variants() {
        assert_eq!(parse_format("docx"), Some(Format::Docx));
        assert_eq!(parse_format("XLSX"), Some(Format::Xlsx));
        assert_eq!(parse_format("Pdf"), Some(Format::Pdf));
        assert_eq!(parse_format("md"), Some(Format::Markdown));
        assert_eq!(parse_format("txt"), Some(Format::Text));
        assert_eq!(parse_format("csv"), Some(Format::Csv));
        assert_eq!(parse_format("pptx"), Some(Format::Pptx));
        assert_eq!(parse_format("odt"), Some(Format::Odt));
        assert_eq!(parse_format("ods"), Some(Format::Ods));
        assert_eq!(parse_format("odp"), Some(Format::Odp));
        assert_eq!(parse_format("html"), Some(Format::Html));
        assert_eq!(parse_format("markdown"), Some(Format::Markdown));
        assert_eq!(parse_format("text"), Some(Format::Text));
    }

    #[test]
    fn parse_format_unknown_returns_none() {
        assert_eq!(parse_format("bmp"), None);
        assert_eq!(parse_format(""), None);
        assert_eq!(parse_format("jpeg"), None);
    }

    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }
}
