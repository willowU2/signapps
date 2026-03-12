//! Document conversion module.

pub mod comments;
mod docx;
mod html;
mod markdown;
mod pdf;
mod tiptap;

use thiserror::Error;

/// Conversion errors
#[derive(Debug, Error)]
pub enum ConversionError {
    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Unsupported format: {0}")]
    UnsupportedFormat(String),

    #[error("Conversion failed: {0}")]
    ConversionFailed(String),
}

/// Input formats supported
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum InputFormat {
    TiptapJson,
    Html,
    Markdown,
}

/// Output formats supported
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ConversionFormat {
    Docx,
    Pdf,
    Markdown,
    Html,
    Text,
}

/// Result of a conversion
pub struct ConversionResult {
    pub data: Vec<u8>,
    pub mime_type: &'static str,
    pub extension: &'static str,
}

/// Document converter service
#[derive(Clone)]
pub struct DocumentConverter {
    // Future: add caching, configuration, etc.
}

impl DocumentConverter {
    pub fn new() -> Self {
        Self {}
    }

    /// Convert document from one format to another
    pub async fn convert(
        &self,
        content: &str,
        input_format: InputFormat,
        output_format: ConversionFormat,
    ) -> Result<ConversionResult, ConversionError> {
        // Step 1: Parse input to intermediate HTML representation
        let html = match input_format {
            InputFormat::TiptapJson => tiptap::tiptap_to_html(content)?,
            InputFormat::Html => content.to_string(),
            InputFormat::Markdown => markdown::markdown_to_html(content)?,
        };

        // Step 2: Convert HTML to output format
        match output_format {
            ConversionFormat::Docx => {
                let data = docx::html_to_docx(&html)?;
                Ok(ConversionResult {
                    data,
                    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    extension: "docx",
                })
            }
            ConversionFormat::Pdf => {
                let data = pdf::html_to_pdf(&html)?;
                Ok(ConversionResult {
                    data,
                    mime_type: "application/pdf",
                    extension: "pdf",
                })
            }
            ConversionFormat::Markdown => {
                let data = html::html_to_markdown(&html)?;
                Ok(ConversionResult {
                    data: data.into_bytes(),
                    mime_type: "text/markdown",
                    extension: "md",
                })
            }
            ConversionFormat::Html => Ok(ConversionResult {
                data: html.into_bytes(),
                mime_type: "text/html",
                extension: "html",
            }),
            ConversionFormat::Text => {
                let text = html::html_to_text(&html)?;
                Ok(ConversionResult {
                    data: text.into_bytes(),
                    mime_type: "text/plain",
                    extension: "txt",
                })
            }
        }
    }
}

impl Default for DocumentConverter {
    fn default() -> Self {
        Self::new()
    }
}
