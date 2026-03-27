//! Native document parse worker using OCR infrastructure (ocrs).
//!
//! Handles text-based files directly (UTF-8 decode) and delegates
//! PDFs / images to an external OCR service when configured.

use anyhow::{Context, Result};
use async_trait::async_trait;
use bytes::Bytes;
use serde::Deserialize;
use tracing::{debug, warn};

use crate::gateway::{BackendType, Capability};
use crate::workers::{
    AiWorker, DocParseWorker, DocumentMetadata, ParsedDocument, ParsedPage, ParsedTable,
};

// ---------------------------------------------------------------------------
// OCR service response types
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct OcrDocumentResponse {
    text: Option<String>,
    pages: Option<Vec<OcrPageResponse>>,
}

#[derive(Deserialize)]
struct OcrPageResponse {
    page_number: Option<u32>,
    text: Option<String>,
}

// ---------------------------------------------------------------------------
// NativeDocParse
// ---------------------------------------------------------------------------

/// Document parse worker that uses native OCR infrastructure for basic text
/// extraction. Text-based files are decoded directly; PDFs and images are
/// delegated to an OCR service endpoint when available.
pub struct NativeDocParse {
    client: reqwest::Client,
    ocr_url: Option<String>,
}

impl NativeDocParse {
    /// Create a new native document parser.
    ///
    /// `ocr_url` is the base URL of the OCR service (e.g.
    /// `http://localhost:3009/api/v1`). When `None`, only text-based files
    /// can be parsed.
    pub fn new(ocr_url: Option<String>) -> Self {
        Self {
            client: reqwest::Client::new(),
            ocr_url: ocr_url.map(|u| u.trim_end_matches('/').to_string()),
        }
    }
}

/// Detect the file category from its extension.
enum FileType {
    /// Plain text-based formats (txt, md, html, csv, json, xml, etc.)
    Text,
    /// PDF documents
    Pdf,
    /// Image formats (png, jpg, tiff, bmp, webp, etc.)
    Image,
    /// Unknown extension
    Unknown,
}

fn detect_file_type(filename: &str) -> FileType {
    let ext = filename
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();

    match ext.as_str() {
        "txt" | "md" | "markdown" | "html" | "htm" | "csv" | "tsv" | "json" | "jsonl" | "xml"
        | "yaml" | "yml" | "toml" | "ini" | "cfg" | "conf" | "log" | "rst" | "tex" | "rtf"
        | "py" | "rs" | "js" | "ts" | "jsx" | "tsx" | "java" | "c" | "cpp" | "h" | "hpp" | "cs"
        | "go" | "rb" | "php" | "sh" | "bash" | "zsh" | "sql" | "css" | "scss" | "less" | "svg" => {
            FileType::Text
        },
        "pdf" => FileType::Pdf,
        "png" | "jpg" | "jpeg" | "tiff" | "tif" | "bmp" | "webp" | "gif" | "ico" => FileType::Image,
        _ => FileType::Unknown,
    }
}

/// Try to decode bytes as UTF-8 text and wrap in a single-page
/// `ParsedDocument`.
fn text_document(text: String, filename: &str) -> ParsedDocument {
    ParsedDocument {
        full_text: text.clone(),
        pages: vec![ParsedPage {
            page_number: 1,
            text,
            images: vec![],
        }],
        tables: vec![],
        metadata: DocumentMetadata {
            title: Some(filename.to_string()),
            author: None,
            page_count: Some(1),
            language: None,
            created_at: None,
        },
    }
}

#[async_trait]
impl AiWorker for NativeDocParse {
    fn capability(&self) -> Capability {
        Capability::DocParse
    }

    fn backend_type(&self) -> BackendType {
        BackendType::Native
    }

    fn required_vram_mb(&self) -> u64 {
        0
    }

    fn quality_score(&self) -> f32 {
        0.70
    }

    fn is_loaded(&self) -> bool {
        true
    }

    async fn health_check(&self) -> bool {
        if let Some(ref url) = self.ocr_url {
            self.client
                .get(format!("{}/health", url))
                .send()
                .await
                .map(|r| r.status().is_success())
                .unwrap_or(true) // OCR service is optional
        } else {
            true
        }
    }

    async fn load(&self) -> Result<()> {
        Ok(())
    }

    async fn unload(&self) -> Result<()> {
        Ok(())
    }
}

#[async_trait]
impl DocParseWorker for NativeDocParse {
    async fn parse(&self, doc: Bytes, filename: &str) -> Result<ParsedDocument> {
        debug!(filename, doc_size = doc.len(), "native docparse: parse");

        match detect_file_type(filename) {
            FileType::Text => {
                let text = String::from_utf8(doc.to_vec())
                    .context("file declared as text but contains invalid UTF-8")?;
                Ok(text_document(text, filename))
            },
            FileType::Pdf | FileType::Image => {
                let ocr_url = self.ocr_url.as_ref().ok_or_else(|| {
                    anyhow::anyhow!(
                        "PDF/image parsing requires OCR service \
                             (set OCR_URL or configure ocr_url)"
                    )
                })?;

                debug!(ocr_url, filename, "delegating to OCR service");

                let url = format!("{}/ocr/document", ocr_url);
                let mime = mime_guess::from_path(filename)
                    .first_or_octet_stream()
                    .to_string();

                let form = reqwest::multipart::Form::new().part(
                    "file",
                    reqwest::multipart::Part::bytes(doc.to_vec())
                        .file_name(filename.to_string())
                        .mime_str(&mime)
                        .context("invalid MIME type")?,
                );

                let resp = self
                    .client
                    .post(&url)
                    .multipart(form)
                    .send()
                    .await
                    .context("failed to send document to OCR service")?;

                let status = resp.status();
                if !status.is_success() {
                    let error_body = resp.text().await.unwrap_or_default();
                    anyhow::bail!("OCR service returned {status}: {error_body}");
                }

                let ocr_resp: OcrDocumentResponse = resp
                    .json()
                    .await
                    .context("failed to parse OCR service response")?;

                let pages: Vec<ParsedPage> = ocr_resp
                    .pages
                    .unwrap_or_default()
                    .into_iter()
                    .enumerate()
                    .map(|(i, p)| ParsedPage {
                        page_number: p.page_number.unwrap_or((i + 1) as u32),
                        text: p.text.unwrap_or_default(),
                        images: vec![],
                    })
                    .collect();

                let full_text = if let Some(t) = ocr_resp.text {
                    t
                } else {
                    pages
                        .iter()
                        .map(|p| p.text.as_str())
                        .collect::<Vec<_>>()
                        .join("\n\n")
                };

                let page_count = pages.len() as u32;

                Ok(ParsedDocument {
                    full_text,
                    pages,
                    tables: vec![],
                    metadata: DocumentMetadata {
                        title: Some(filename.to_string()),
                        author: None,
                        page_count: Some(page_count),
                        language: None,
                        created_at: None,
                    },
                })
            },
            FileType::Unknown => {
                // Try UTF-8 decode as a fallback.
                match String::from_utf8(doc.to_vec()) {
                    Ok(text) => {
                        warn!(filename, "unknown file extension — decoded as UTF-8");
                        Ok(text_document(text, filename))
                    },
                    Err(_) => anyhow::bail!(
                        "unsupported file type and content is not valid \
                         UTF-8: {filename}"
                    ),
                }
            },
        }
    }

    async fn extract_tables(&self, _doc: Bytes) -> Result<Vec<ParsedTable>> {
        // Native OCR does not support table extraction yet.
        debug!("native docparse: extract_tables not supported");
        Ok(vec![])
    }
}
