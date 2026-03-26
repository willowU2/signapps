//! Cloud-based document parse worker using Azure Document Intelligence.
//!
//! Calls the Azure AI Document Intelligence (formerly Form Recognizer) API
//! with the `prebuilt-layout` model to extract text, tables, and structure.

use std::time::Duration;

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
// Azure API constants
// ---------------------------------------------------------------------------

const AZURE_API_VERSION: &str = "2024-11-30";
const POLL_INTERVAL: Duration = Duration::from_secs(2);
const MAX_POLL_ATTEMPTS: u32 = 120; // 4 minutes at 2s intervals

// ---------------------------------------------------------------------------
// Azure API response types
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct AnalyzeStatusResponse {
    status: String,
    #[serde(rename = "analyzeResult")]
    analyze_result: Option<AnalyzeResult>,
    error: Option<AzureError>,
}

#[derive(Deserialize)]
struct AzureError {
    code: Option<String>,
    message: Option<String>,
}

#[derive(Deserialize)]
struct AnalyzeResult {
    content: Option<String>,
    pages: Option<Vec<AzurePage>>,
    tables: Option<Vec<AzureTable>>,
    languages: Option<Vec<AzureLanguage>>,
}

#[derive(Deserialize)]
struct AzurePage {
    #[serde(rename = "pageNumber")]
    page_number: u32,
    lines: Option<Vec<AzureLine>>,
}

#[derive(Deserialize)]
struct AzureLine {
    content: String,
}

#[derive(Deserialize)]
struct AzureTable {
    #[serde(rename = "rowCount")]
    row_count: u32,
    #[serde(rename = "columnCount")]
    column_count: u32,
    cells: Vec<AzureTableCell>,
    #[serde(rename = "boundingRegions")]
    bounding_regions: Option<Vec<AzureBoundingRegion>>,
}

#[derive(Deserialize)]
struct AzureTableCell {
    #[serde(rename = "rowIndex")]
    row_index: u32,
    #[serde(rename = "columnIndex")]
    column_index: u32,
    content: String,
    kind: Option<String>,
}

#[derive(Deserialize)]
struct AzureBoundingRegion {
    #[serde(rename = "pageNumber")]
    page_number: u32,
}

#[derive(Deserialize)]
struct AzureLanguage {
    locale: String,
}

// ---------------------------------------------------------------------------
// CloudDocParse
// ---------------------------------------------------------------------------

/// Document parse worker that calls Azure Document Intelligence for
/// high-fidelity document parsing with table extraction.
pub struct CloudDocParse {
    client: reqwest::Client,
    endpoint: String,
    api_key: String,
}

impl CloudDocParse {
    /// Create a new Azure Document Intelligence document parser.
    ///
    /// * `endpoint` — Azure resource endpoint (e.g.
    ///   `https://<resource>.cognitiveservices.azure.com`).
    /// * `api_key` — subscription key for the Azure resource.
    pub fn new(endpoint: &str, api_key: &str) -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(300))
                .build()
                .expect("failed to build HTTP client"),
            endpoint: endpoint.trim_end_matches('/').to_string(),
            api_key: api_key.to_string(),
        }
    }

    /// Submit a document for analysis and poll until complete.
    async fn analyze_document(&self, doc: Bytes) -> Result<AnalyzeResult> {
        let url = format!(
            "{}/documentintelligence/documentModels/prebuilt-layout:analyze\
             ?api-version={}",
            self.endpoint, AZURE_API_VERSION
        );

        debug!(url, doc_size = doc.len(), "submitting document to Azure");

        let resp = self
            .client
            .post(&url)
            .header("Ocp-Apim-Subscription-Key", &self.api_key)
            .header("Content-Type", "application/octet-stream")
            .body(doc.to_vec())
            .send()
            .await
            .context("failed to submit document to Azure Document Intelligence")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Azure Document Intelligence returned {status}: {error_body}");
        }

        // Extract the Operation-Location header for polling.
        let operation_url = resp
            .headers()
            .get("Operation-Location")
            .or_else(|| resp.headers().get("operation-location"))
            .ok_or_else(|| anyhow::anyhow!("Azure response missing Operation-Location header"))?
            .to_str()
            .context("Operation-Location header is not valid UTF-8")?
            .to_string();

        debug!(operation_url, "polling Azure operation");

        // Poll until the operation completes.
        for attempt in 1..=MAX_POLL_ATTEMPTS {
            tokio::time::sleep(POLL_INTERVAL).await;

            let poll_resp = self
                .client
                .get(&operation_url)
                .header("Ocp-Apim-Subscription-Key", &self.api_key)
                .send()
                .await
                .context("failed to poll Azure operation")?;

            let poll_status = poll_resp.status();
            if !poll_status.is_success() {
                let error_body = poll_resp.text().await.unwrap_or_default();
                anyhow::bail!("Azure poll returned {poll_status}: {error_body}");
            }

            let status_resp: AnalyzeStatusResponse = poll_resp
                .json()
                .await
                .context("failed to parse Azure poll response")?;

            match status_resp.status.as_str() {
                "succeeded" => {
                    debug!(attempt, "Azure analysis succeeded");
                    return status_resp.analyze_result.ok_or_else(|| {
                        anyhow::anyhow!("Azure returned succeeded but no analyzeResult")
                    });
                },
                "failed" => {
                    let err = status_resp.error.unwrap_or(AzureError {
                        code: None,
                        message: None,
                    });
                    anyhow::bail!(
                        "Azure analysis failed: {} — {}",
                        err.code.unwrap_or_default(),
                        err.message.unwrap_or_default()
                    );
                },
                "running" | "notStarted" => {
                    debug!(attempt, status = %status_resp.status, "waiting…");
                },
                other => {
                    warn!(status = other, "unexpected Azure operation status");
                },
            }
        }

        anyhow::bail!(
            "Azure Document Intelligence operation timed out after {} attempts",
            MAX_POLL_ATTEMPTS
        );
    }
}

/// Convert an [`AnalyzeResult`] into a [`ParsedDocument`].
fn to_parsed_document(result: AnalyzeResult) -> ParsedDocument {
    // --- Pages ---
    let pages: Vec<ParsedPage> = result
        .pages
        .unwrap_or_default()
        .into_iter()
        .map(|p| {
            let text = p
                .lines
                .unwrap_or_default()
                .into_iter()
                .map(|l| l.content)
                .collect::<Vec<_>>()
                .join("\n");
            ParsedPage {
                page_number: p.page_number,
                text,
                images: vec![],
            }
        })
        .collect();

    // --- Tables ---
    let tables: Vec<ParsedTable> = result
        .tables
        .unwrap_or_default()
        .into_iter()
        .map(|t| {
            let page = t
                .bounding_regions
                .as_ref()
                .and_then(|r| r.first())
                .map(|r| r.page_number)
                .unwrap_or(1);

            // Separate header cells from content cells.
            let mut headers: Vec<String> = vec![String::new(); t.column_count as usize];
            let mut row_data: Vec<Vec<String>> = Vec::new();

            for cell in &t.cells {
                let is_header = cell
                    .kind
                    .as_deref()
                    .map(|k| k == "columnHeader")
                    .unwrap_or(false);

                if is_header {
                    if (cell.column_index as usize) < headers.len() {
                        headers[cell.column_index as usize] = cell.content.clone();
                    }
                } else {
                    let ri = cell.row_index as usize;
                    // Account for header row offset: if there are headers,
                    // the first data row in Azure is row_index 1.
                    let data_row = if headers.iter().any(|h| !h.is_empty()) {
                        ri.saturating_sub(1)
                    } else {
                        ri
                    };
                    while row_data.len() <= data_row {
                        row_data.push(vec![String::new(); t.column_count as usize]);
                    }
                    if (cell.column_index as usize) < t.column_count as usize {
                        row_data[data_row][cell.column_index as usize] = cell.content.clone();
                    }
                }
            }

            ParsedTable {
                page,
                headers,
                rows: row_data,
            }
        })
        .collect();

    // --- Full text ---
    let full_text = result.content.unwrap_or_else(|| {
        pages
            .iter()
            .map(|p| p.text.as_str())
            .collect::<Vec<_>>()
            .join("\n\n")
    });

    // --- Language ---
    let language = result
        .languages
        .as_ref()
        .and_then(|langs| langs.first())
        .map(|l| l.locale.clone());

    let page_count = pages.len() as u32;

    ParsedDocument {
        full_text,
        pages,
        tables,
        metadata: DocumentMetadata {
            title: None,
            author: None,
            page_count: Some(page_count),
            language,
            created_at: None,
        },
    }
}

#[async_trait]
impl AiWorker for CloudDocParse {
    fn capability(&self) -> Capability {
        Capability::DocParse
    }

    fn backend_type(&self) -> BackendType {
        BackendType::Cloud {
            provider: "azure".to_string(),
        }
    }

    fn required_vram_mb(&self) -> u64 {
        0
    }

    fn quality_score(&self) -> f32 {
        0.95
    }

    fn is_loaded(&self) -> bool {
        true
    }

    async fn health_check(&self) -> bool {
        // Azure is assumed available; no cheap health endpoint exists.
        true
    }

    async fn load(&self) -> Result<()> {
        Ok(())
    }

    async fn unload(&self) -> Result<()> {
        Ok(())
    }
}

#[async_trait]
impl DocParseWorker for CloudDocParse {
    async fn parse(&self, doc: Bytes, filename: &str) -> Result<ParsedDocument> {
        debug!(
            filename,
            doc_size = doc.len(),
            "cloud docparse: parse via Azure"
        );

        let result = self.analyze_document(doc).await?;
        Ok(to_parsed_document(result))
    }

    async fn extract_tables(&self, doc: Bytes) -> Result<Vec<ParsedTable>> {
        debug!(
            doc_size = doc.len(),
            "cloud docparse: extract_tables via Azure"
        );

        let result = self.analyze_document(doc).await?;
        let parsed = to_parsed_document(result);
        Ok(parsed.tables)
    }
}
