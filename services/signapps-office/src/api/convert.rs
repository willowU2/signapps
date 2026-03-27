use axum::{extract::Multipart, http::StatusCode, response::IntoResponse, Json};
use serde_json::json;

use crate::converter::{ConversionFormat, DocumentConverter, InputFormat};

pub async fn handle_convert(mut multipart: Multipart) -> impl IntoResponse {
    let mut input_format = None;
    let mut target_format = None;
    let mut file_data = None;
    let mut filename: Option<String> = None;

    while let Some(field) = multipart.next_field().await.unwrap_or(None) {
        let name = field.name().unwrap_or("").to_string();

        if name == "input_format" {
            input_format = field.text().await.ok();
        } else if name == "target_format" {
            target_format = field.text().await.ok();
        } else if name == "file" {
            filename = field.file_name().map(|s| s.to_string());
            file_data = field.bytes().await.ok();
        }
    }

    let (input, target, data) = match (input_format, target_format, file_data) {
        (Some(i), Some(t), Some(d)) => (i, t, d),
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Missing input_format, target_format, or file" })),
            )
        },
    };

    tracing::info!(
        "Converting {} bytes from {} to {} (filename: {:?})",
        data.len(),
        input,
        target,
        filename
    );

    // Parse input format
    let in_fmt = match input.to_lowercase().as_str() {
        "tiptap" | "tiptap_json" | "tiptapjson" => InputFormat::TiptapJson,
        "html" | "text/html" => InputFormat::Html,
        "markdown" | "md" | "text/markdown" => InputFormat::Markdown,
        other => {
            return (
                StatusCode::NOT_IMPLEMENTED,
                Json(json!({
                    "error": "Unsupported input format",
                    "format": other,
                    "supported": ["tiptap", "html", "markdown"]
                })),
            )
        },
    };

    // Parse target format
    let out_fmt = match target.to_lowercase().as_str() {
        "docx" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document" => {
            ConversionFormat::Docx
        },
        "pdf" | "application/pdf" => ConversionFormat::Pdf,
        "markdown" | "md" | "text/markdown" => ConversionFormat::Markdown,
        "html" | "text/html" => ConversionFormat::Html,
        "text" | "txt" | "text/plain" => ConversionFormat::Text,
        other => {
            return (
                StatusCode::NOT_IMPLEMENTED,
                Json(json!({
                    "error": "Unsupported target format",
                    "format": other,
                    "supported": ["docx", "pdf", "markdown", "html", "text"]
                })),
            )
        },
    };

    // The converter works with string content; decode bytes as UTF-8
    let content = match std::str::from_utf8(&data) {
        Ok(s) => s.to_string(),
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "File content is not valid UTF-8" })),
            )
        },
    };

    let converter = DocumentConverter::new();
    match converter.convert(&content, in_fmt, out_fmt).await {
        Ok(result) => {
            // Return binary conversion result as base64-encoded JSON for simplicity
            use base64::Engine;
            let encoded = base64::engine::general_purpose::STANDARD.encode(&result.data);
            (
                StatusCode::OK,
                Json(json!({
                    "mime_type": result.mime_type,
                    "extension": result.extension,
                    "data_base64": encoded,
                    "size_bytes": result.data.len()
                })),
            )
        },
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        ),
    }
}
