//! Document import module.

mod docx;
mod html;
mod markdown;

use serde::Deserialize;
use thiserror::Error;

/// Import errors
#[derive(Debug, Error)]
pub enum ImportError {
    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Unsupported format: {0}")]
    UnsupportedFormat(String),

    #[error("Parse error: {0}")]
    ParseError(String),
}

/// Input formats supported
#[derive(Debug, Clone, Copy, PartialEq, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum ImportFormat {
    Docx,
    Markdown,
    Html,
    Text,
}

/// Result of an import
pub struct ImportResult {
    pub tiptap_json: serde_json::Value,
}

/// Document importer service
#[derive(Clone)]
pub struct DocumentImporter {
    // Future: add configuration, caching, etc.
}

impl DocumentImporter {
    pub fn new() -> Self {
        Self {}
    }

    /// Import document to Tiptap JSON
    pub async fn import(
        &self,
        content: &[u8],
        format: ImportFormat,
    ) -> Result<ImportResult, ImportError> {
        let tiptap_json = match format {
            ImportFormat::Docx => docx::docx_to_tiptap(content)?,
            ImportFormat::Markdown => markdown::markdown_to_tiptap(content)?,
            ImportFormat::Html => html::html_to_tiptap(content)?,
            ImportFormat::Text => text_to_tiptap(content)?,
        };

        Ok(ImportResult { tiptap_json })
    }
}

impl Default for DocumentImporter {
    fn default() -> Self {
        Self::new()
    }
}

/// Convert plain text to Tiptap JSON
fn text_to_tiptap(content: &[u8]) -> Result<serde_json::Value, ImportError> {
    let text = String::from_utf8(content.to_vec())
        .map_err(|e| ImportError::ParseError(format!("Invalid UTF-8: {}", e)))?;

    let mut paragraphs = Vec::new();

    for line in text.lines() {
        if line.trim().is_empty() {
            // Empty paragraph
            paragraphs.push(serde_json::json!({
                "type": "paragraph"
            }));
        } else {
            paragraphs.push(serde_json::json!({
                "type": "paragraph",
                "content": [{
                    "type": "text",
                    "text": line
                }]
            }));
        }
    }

    Ok(serde_json::json!({
        "type": "doc",
        "content": paragraphs
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_text_to_tiptap() {
        let text = "Hello\nWorld";
        let result = text_to_tiptap(text.as_bytes()).expect("text_to_tiptap should succeed");

        assert_eq!(result["type"], "doc");
        let content = result["content"]
            .as_array()
            .expect("content should be an array");
        assert_eq!(content.len(), 2);
        assert_eq!(content[0]["type"], "paragraph");
    }
}
