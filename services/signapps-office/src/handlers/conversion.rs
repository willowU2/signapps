//! Document conversion handlers.

use axum::{
    body::Body,
    extract::{Multipart, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::converter::{ConversionError, ConversionFormat};
use crate::AppState;

/// Supported input formats
#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum InputFormat {
    TiptapJson,
    Html,
    Markdown,
}

/// Supported output formats
#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum OutputFormat {
    Docx,
    Pdf,
    Markdown,
    Html,
    Text,
}

impl From<OutputFormat> for ConversionFormat {
    fn from(format: OutputFormat) -> Self {
        match format {
            OutputFormat::Docx => ConversionFormat::Docx,
            OutputFormat::Pdf => ConversionFormat::Pdf,
            OutputFormat::Markdown => ConversionFormat::Markdown,
            OutputFormat::Html => ConversionFormat::Html,
            OutputFormat::Text => ConversionFormat::Text,
        }
    }
}

/// Query parameters for conversion
#[derive(Debug, Deserialize)]
pub struct ConversionQuery {
    /// Output format (docx, pdf, markdown, html, text)
    pub format: OutputFormat,
    /// Optional filename for the output
    pub filename: Option<String>,
}

/// Comment data for export
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ExportComment {
    pub id: String,
    pub author: String,
    pub content: String,
    pub created_at: String,
    pub resolved: bool,
    #[serde(default)]
    pub replies: Vec<ExportCommentReply>,
}

/// Comment reply for export
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ExportCommentReply {
    pub author: String,
    pub content: String,
    pub created_at: String,
}

/// Request body for JSON conversion
#[derive(Debug, Deserialize)]
pub struct ConversionRequest {
    /// Input format (tiptapjson, html, markdown)
    pub input_format: InputFormat,
    /// The document content
    pub content: serde_json::Value,
    /// Optional document title (reserved for future use)
    #[allow(dead_code)]
    pub title: Option<String>,
    /// Optional comments to include in export
    #[serde(default)]
    pub comments: Option<Vec<ExportComment>>,
}

/// Response for conversion info
#[derive(Debug, Serialize)]
pub struct ConversionInfoResponse {
    pub supported_input_formats: Vec<&'static str>,
    pub supported_output_formats: Vec<&'static str>,
    pub max_file_size_mb: u32,
    pub version: String,
}

/// Get conversion service info
pub async fn info() -> Json<ConversionInfoResponse> {
    Json(ConversionInfoResponse {
        supported_input_formats: vec!["tiptapjson", "html", "markdown"],
        supported_output_formats: vec!["docx", "pdf", "markdown", "html", "text"],
        max_file_size_mb: 50,
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

/// Convert document from JSON body
pub async fn convert_json(
    State(state): State<AppState>,
    Query(query): Query<ConversionQuery>,
    Json(request): Json<ConversionRequest>,
) -> Result<Response, ConversionErrorResponse> {
    let content_str = match request.input_format {
        InputFormat::TiptapJson => serde_json::to_string(&request.content)
            .map_err(|e| ConversionError::InvalidInput(e.to_string()))?,
        InputFormat::Html | InputFormat::Markdown => request
            .content
            .as_str()
            .ok_or_else(|| ConversionError::InvalidInput("Content must be a string".to_string()))?
            .to_string(),
    };

    let input_format = match request.input_format {
        InputFormat::TiptapJson => crate::converter::InputFormat::TiptapJson,
        InputFormat::Html => crate::converter::InputFormat::Html,
        InputFormat::Markdown => crate::converter::InputFormat::Markdown,
    };

    // Convert external comments to internal format
    let internal_comments: Option<Vec<crate::converter::comments::Comment>> =
        request.comments.map(|comments| {
            comments
                .into_iter()
                .map(|c| crate::converter::comments::Comment {
                    id: c.id,
                    author: c.author,
                    author_id: String::new(),
                    content: c.content,
                    created_at: c.created_at,
                    resolved: c.resolved,
                    replies: c
                        .replies
                        .into_iter()
                        .map(|r| crate::converter::comments::CommentReply {
                            id: String::new(),
                            author: r.author,
                            author_id: String::new(),
                            content: r.content,
                            created_at: r.created_at,
                        })
                        .collect(),
                })
                .collect()
        });

    let result = state
        .converter
        .convert_with_comments(
            &content_str,
            input_format,
            query.format.into(),
            internal_comments.as_deref(),
        )
        .await?;

    let filename = query
        .filename
        .unwrap_or_else(|| format!("document.{}", result.extension));

    let content_type = result.mime_type;

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", filename),
        )
        .header(header::CONTENT_LENGTH, result.data.len())
        .body(Body::from(result.data))
        .unwrap())
}

/// Convert document from multipart upload
pub async fn convert_upload(
    State(state): State<AppState>,
    Query(query): Query<ConversionQuery>,
    mut multipart: Multipart,
) -> Result<Response, ConversionErrorResponse> {
    let mut content: Option<String> = None;
    let mut input_format: Option<crate::converter::InputFormat> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| ConversionError::InvalidInput(e.to_string()))?
    {
        let name = field.name().unwrap_or_default().to_string();

        match name.as_str() {
            "file" => {
                let filename = field.file_name().unwrap_or("").to_string();
                let data = field
                    .bytes()
                    .await
                    .map_err(|e| ConversionError::InvalidInput(e.to_string()))?;

                content = Some(
                    String::from_utf8(data.to_vec())
                        .map_err(|e| ConversionError::InvalidInput(e.to_string()))?,
                );

                // Auto-detect format from extension
                input_format = Some(detect_format_from_filename(&filename));
            }
            "input_format" => {
                let format_str = field
                    .text()
                    .await
                    .map_err(|e| ConversionError::InvalidInput(e.to_string()))?;
                input_format = Some(parse_input_format(&format_str)?);
            }
            _ => {}
        }
    }

    let content = content.ok_or_else(|| ConversionError::InvalidInput("No file provided".into()))?;
    let input_format =
        input_format.ok_or_else(|| ConversionError::InvalidInput("No format provided".into()))?;

    let result = state
        .converter
        .convert(&content, input_format, query.format.into())
        .await?;

    let filename = query
        .filename
        .unwrap_or_else(|| format!("document.{}", result.extension));

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, result.mime_type)
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", filename),
        )
        .header(header::CONTENT_LENGTH, result.data.len())
        .body(Body::from(result.data))
        .unwrap())
}

fn detect_format_from_filename(filename: &str) -> crate::converter::InputFormat {
    let ext = filename.rsplit('.').next().unwrap_or("").to_lowercase();
    match ext.as_str() {
        "json" => crate::converter::InputFormat::TiptapJson,
        "html" | "htm" => crate::converter::InputFormat::Html,
        "md" | "markdown" => crate::converter::InputFormat::Markdown,
        _ => crate::converter::InputFormat::Html,
    }
}

fn parse_input_format(s: &str) -> Result<crate::converter::InputFormat, ConversionError> {
    match s.to_lowercase().as_str() {
        "tiptapjson" | "tiptap" | "json" => Ok(crate::converter::InputFormat::TiptapJson),
        "html" => Ok(crate::converter::InputFormat::Html),
        "markdown" | "md" => Ok(crate::converter::InputFormat::Markdown),
        _ => Err(ConversionError::InvalidInput(format!(
            "Unknown input format: {}",
            s
        ))),
    }
}

/// Batch conversion request item
#[derive(Debug, Deserialize)]
pub struct BatchConversionItem {
    pub id: String,
    pub input_format: InputFormat,
    pub content: serde_json::Value,
    pub output_format: OutputFormat,
}

/// Batch conversion request
#[derive(Debug, Deserialize)]
pub struct BatchConversionRequest {
    pub items: Vec<BatchConversionItem>,
}

/// Batch conversion response item
#[derive(Debug, Serialize)]
pub struct BatchConversionResultItem {
    pub id: String,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data_base64: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extension: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Batch conversion response
#[derive(Debug, Serialize)]
pub struct BatchConversionResponse {
    pub total: usize,
    pub successful: usize,
    pub failed: usize,
    pub results: Vec<BatchConversionResultItem>,
}

/// Convert multiple documents in batch
pub async fn convert_batch(
    State(state): State<AppState>,
    Json(request): Json<BatchConversionRequest>,
) -> Result<Json<BatchConversionResponse>, ConversionErrorResponse> {
    use base64::Engine;

    let total = request.items.len();
    let mut results = Vec::with_capacity(total);
    let mut successful = 0;
    let mut failed = 0;

    for item in request.items {
        let content_str = match item.input_format {
            InputFormat::TiptapJson => {
                match serde_json::to_string(&item.content) {
                    Ok(s) => s,
                    Err(e) => {
                        failed += 1;
                        results.push(BatchConversionResultItem {
                            id: item.id,
                            success: false,
                            data_base64: None,
                            mime_type: None,
                            extension: None,
                            error: Some(e.to_string()),
                        });
                        continue;
                    }
                }
            }
            InputFormat::Html | InputFormat::Markdown => {
                match item.content.as_str() {
                    Some(s) => s.to_string(),
                    None => {
                        failed += 1;
                        results.push(BatchConversionResultItem {
                            id: item.id,
                            success: false,
                            data_base64: None,
                            mime_type: None,
                            extension: None,
                            error: Some("Content must be a string".to_string()),
                        });
                        continue;
                    }
                }
            }
        };

        let input_format = match item.input_format {
            InputFormat::TiptapJson => crate::converter::InputFormat::TiptapJson,
            InputFormat::Html => crate::converter::InputFormat::Html,
            InputFormat::Markdown => crate::converter::InputFormat::Markdown,
        };

        match state
            .converter
            .convert(&content_str, input_format, item.output_format.into())
            .await
        {
            Ok(result) => {
                successful += 1;
                let encoded = base64::engine::general_purpose::STANDARD.encode(&result.data);
                results.push(BatchConversionResultItem {
                    id: item.id,
                    success: true,
                    data_base64: Some(encoded),
                    mime_type: Some(result.mime_type.to_string()),
                    extension: Some(result.extension.to_string()),
                    error: None,
                });
            }
            Err(e) => {
                failed += 1;
                results.push(BatchConversionResultItem {
                    id: item.id,
                    success: false,
                    data_base64: None,
                    mime_type: None,
                    extension: None,
                    error: Some(e.to_string()),
                });
            }
        }
    }

    Ok(Json(BatchConversionResponse {
        total,
        successful,
        failed,
        results,
    }))
}

/// Error response wrapper
pub struct ConversionErrorResponse(ConversionError);

impl From<ConversionError> for ConversionErrorResponse {
    fn from(err: ConversionError) -> Self {
        Self(err)
    }
}

impl IntoResponse for ConversionErrorResponse {
    fn into_response(self) -> Response {
        let (status, message) = match &self.0 {
            ConversionError::InvalidInput(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            ConversionError::UnsupportedFormat(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            ConversionError::ConversionFailed(msg) => {
                (StatusCode::INTERNAL_SERVER_ERROR, msg.clone())
            }
        };

        let body = serde_json::json!({
            "error": message,
            "type": format!("{:?}", self.0),
        });

        (status, Json(body)).into_response()
    }
}
