//! Document import handlers.

use axum::{
    extract::{Multipart, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::importer::{ImportError, ImportFormat};
use crate::AppState;

/// Query parameters for import
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct ImportQuery {
    /// Optional input format override (auto-detected if not provided)
    pub format: Option<ImportFormat>,
}

/// Response for import info
#[derive(Debug, Serialize)]
/// Response for ImportInfo.
pub struct ImportInfoResponse {
    pub supported_formats: Vec<&'static str>,
    pub max_file_size_mb: u32,
    pub version: String,
}

/// Response for imported document
#[derive(Debug, Serialize)]
/// Response for Import.
pub struct ImportResponse {
    pub success: bool,
    pub detected_format: String,
    pub tiptap_json: serde_json::Value,
    pub metadata: ImportMetadata,
}

/// Import metadata
#[derive(Debug, Serialize)]
/// ImportMetadata data transfer object.
pub struct ImportMetadata {
    pub word_count: usize,
    pub character_count: usize,
    pub has_images: bool,
    pub has_tables: bool,
}

/// Get import service info
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/import",
    responses((status = 200, description = "Success")),
    tag = "Office"
)]
#[tracing::instrument(skip_all)]
pub async fn info() -> Json<ImportInfoResponse> {
    Json(ImportInfoResponse {
        supported_formats: vec!["docx", "markdown", "html", "txt"],
        max_file_size_mb: 50,
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

/// Import document from multipart upload
#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/import",
    responses((status = 201, description = "Success")),
    tag = "Office"
)]
#[tracing::instrument(skip_all)]
pub async fn import_upload(
    State(state): State<AppState>,
    Query(query): Query<ImportQuery>,
    mut multipart: Multipart,
) -> Result<Json<ImportResponse>, ImportErrorResponse> {
    let mut content: Option<Vec<u8>> = None;
    let mut filename: Option<String> = None;
    let mut detected_format: Option<ImportFormat> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| ImportError::InvalidInput(e.to_string()))?
    {
        let name = field.name().unwrap_or_default().to_string();

        if name == "file" {
            filename = Some(field.file_name().unwrap_or("").to_string());
            let data = field
                .bytes()
                .await
                .map_err(|e| ImportError::InvalidInput(e.to_string()))?;

            content = Some(data.to_vec());
        }
    }

    let content = content.ok_or_else(|| ImportError::InvalidInput("No file provided".into()))?;
    let filename = filename.unwrap_or_default();

    // Determine format
    let format = query.format.unwrap_or_else(|| {
        let fmt = detect_format(&content, &filename);
        detected_format = Some(fmt);
        fmt
    });

    // Import document
    let result = state.importer.import(&content, format).await?;

    // Calculate metadata
    let metadata = calculate_metadata(&result.tiptap_json);

    Ok(Json(ImportResponse {
        success: true,
        detected_format: format!("{:?}", format).to_lowercase(),
        tiptap_json: result.tiptap_json,
        metadata,
    }))
}

/// Import document from JSON body (for HTML/Markdown content)
#[derive(Debug, Deserialize)]
/// Request body for ImportJson.
pub struct ImportJsonRequest {
    pub content: String,
    pub format: Option<ImportFormat>,
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/import",
    responses((status = 201, description = "Success")),
    tag = "Office"
)]
#[tracing::instrument(skip_all)]
pub async fn import_json(
    State(state): State<AppState>,
    Json(request): Json<ImportJsonRequest>,
) -> Result<Json<ImportResponse>, ImportErrorResponse> {
    let content = request.content.as_bytes().to_vec();

    // Determine format
    let format = request
        .format
        .unwrap_or_else(|| detect_format(&content, ""));

    // Import document
    let result = state.importer.import(&content, format).await?;

    // Calculate metadata
    let metadata = calculate_metadata(&result.tiptap_json);

    Ok(Json(ImportResponse {
        success: true,
        detected_format: format!("{:?}", format).to_lowercase(),
        tiptap_json: result.tiptap_json,
        metadata,
    }))
}

/// Detect format from content and filename
fn detect_format(content: &[u8], filename: &str) -> ImportFormat {
    // Check magic bytes first
    if content.len() >= 4 {
        // DOCX (ZIP) magic bytes: PK..
        if content[0..4] == [0x50, 0x4B, 0x03, 0x04] {
            return ImportFormat::Docx;
        }
    }

    // Check file extension
    let ext = filename.rsplit('.').next().unwrap_or("").to_lowercase();
    match ext.as_str() {
        "docx" => ImportFormat::Docx,
        "md" | "markdown" => ImportFormat::Markdown,
        "html" | "htm" => ImportFormat::Html,
        "txt" => ImportFormat::Text,
        _ => {
            // Try to detect from content
            let content_str = String::from_utf8_lossy(content);

            // Check for HTML
            if content_str.contains("<!DOCTYPE")
                || content_str.contains("<html")
                || content_str.contains("<body")
            {
                return ImportFormat::Html;
            }

            // Check for Markdown patterns
            if content_str.starts_with('#')
                || content_str.contains("\n# ")
                || content_str.contains("\n## ")
                || content_str.contains("```")
            {
                return ImportFormat::Markdown;
            }

            // Default to plain text
            ImportFormat::Text
        },
    }
}

fn calculate_metadata(tiptap_json: &serde_json::Value) -> ImportMetadata {
    let text = extract_text_from_tiptap(tiptap_json);
    let word_count = text.split_whitespace().count();
    let character_count = text.chars().count();

    let has_images = json_contains_type(tiptap_json, "image");
    let has_tables = json_contains_type(tiptap_json, "table");

    ImportMetadata {
        word_count,
        character_count,
        has_images,
        has_tables,
    }
}

fn extract_text_from_tiptap(json: &serde_json::Value) -> String {
    let mut text = String::new();

    if let Some(obj) = json.as_object() {
        if let Some(t) = obj.get("text").and_then(|v| v.as_str()) {
            text.push_str(t);
            text.push(' ');
        }
        if let Some(content) = obj.get("content").and_then(|v| v.as_array()) {
            for item in content {
                text.push_str(&extract_text_from_tiptap(item));
            }
        }
    }

    text
}

fn json_contains_type(json: &serde_json::Value, type_name: &str) -> bool {
    if let Some(obj) = json.as_object() {
        if obj.get("type").and_then(|v| v.as_str()) == Some(type_name) {
            return true;
        }
        if let Some(content) = obj.get("content").and_then(|v| v.as_array()) {
            for item in content {
                if json_contains_type(item, type_name) {
                    return true;
                }
            }
        }
    }
    false
}

/// Error response wrapper
pub struct ImportErrorResponse(ImportError);

impl From<ImportError> for ImportErrorResponse {
    fn from(err: ImportError) -> Self {
        Self(err)
    }
}

impl IntoResponse for ImportErrorResponse {
    fn into_response(self) -> Response {
        let (status, message) = match &self.0 {
            ImportError::InvalidInput(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            ImportError::UnsupportedFormat(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            ImportError::ParseError(msg) => (StatusCode::UNPROCESSABLE_ENTITY, msg.clone()),
        };

        let body = serde_json::json!({
            "error": message,
            "type": format!("{:?}", self.0),
        });

        (status, Json(body)).into_response()
    }
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
