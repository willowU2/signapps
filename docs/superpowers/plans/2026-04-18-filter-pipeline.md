# Filter Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a unified `signapps-filters` crate that replaces the scattered import/export code in `signapps-docs/src/office/` with a modular, trait-based filter pipeline inspired by LibreOffice's filter architecture.

**Architecture:** Two-stage pipeline — FormatDetector identifies the input format, then FilterRegistry selects the correct filter implementing `FilterTrait`. Each filter converts to/from an `IntermediateDocument` model. Existing converters/importers are migrated into this pattern. New formats (PPTX import, ODS, CSV) are added as filter modules.

**Tech Stack:** Rust (docx-rs, calamine, rust_xlsxwriter, comrak, scraper, printpdf, lopdf, zip), serde, thiserror

---

## File Structure

### New crate: `crates/signapps-filters/`

| File | Responsibility |
|------|---------------|
| `Cargo.toml` | Crate manifest with format-specific feature flags |
| `src/lib.rs` | Public API re-exports |
| `src/error.rs` | `FilterError` enum (thiserror) |
| `src/intermediate.rs` | `IntermediateDocument` model — typed node tree |
| `src/detector.rs` | `FormatDetector` — magic bytes + extension + content heuristics |
| `src/registry.rs` | `FilterRegistry` — lookup filters by format |
| `src/traits.rs` | `FilterTrait` — import/export interface |
| `src/formats/mod.rs` | Format module index |
| `src/formats/docx.rs` | DOCX import/export (migrated from office service) |
| `src/formats/xlsx.rs` | XLSX import/export (migrated from office service) |
| `src/formats/csv.rs` | CSV import/export (migrated from office service) |
| `src/formats/markdown.rs` | Markdown import/export (migrated) |
| `src/formats/html.rs` | HTML import/export (migrated) |
| `src/formats/pdf.rs` | PDF export (migrated) |
| `src/formats/pptx.rs` | PPTX export (migrated) + import (**new**) |
| `src/formats/ods.rs` | ODS import/export (migrated from spreadsheet/ods.rs) |
| `src/formats/text.rs` | Plain text import/export |

### Modified files

| File | Change |
|------|--------|
| `Cargo.toml` (root) | Add `crates/signapps-filters` to workspace members |
| `services/signapps-docs/Cargo.toml` | Add `signapps-filters` dependency |
| `services/signapps-docs/src/office/mod.rs` | Use `signapps_filters` instead of local converter/importer |
| `services/signapps-docs/src/office/handlers/import.rs` | Delegate to FilterRegistry |
| `services/signapps-docs/src/office/handlers/conversion.rs` | Delegate to FilterRegistry |

---

## Task 1: Create crate skeleton + error types

**Files:**
- Create: `crates/signapps-filters/Cargo.toml`
- Create: `crates/signapps-filters/src/lib.rs`
- Create: `crates/signapps-filters/src/error.rs`
- Modify: `Cargo.toml` (root workspace)

- [ ] **Step 1: Create crate directory**

```bash
mkdir -p crates/signapps-filters/src
```

- [ ] **Step 2: Write Cargo.toml**

```toml
# crates/signapps-filters/Cargo.toml
[package]
name = "signapps-filters"
version.workspace = true
edition = "2021"
rust-version.workspace = true
authors.workspace = true
license.workspace = true
description = "Unified document filter pipeline for SignApps Platform"

[dependencies]
thiserror = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }
chrono = { workspace = true }
uuid = { workspace = true }
tracing = { workspace = true }

# Format-specific dependencies
docx-rs = "0.4"
calamine = "0.26"
rust_xlsxwriter = "0.79"
comrak = "0.31"
scraper = "0.20"
printpdf = "0.7"
lopdf = "0.33"
zip = "2.0"
mime_guess = { workspace = true }
base64 = "0.22"
bytes = { workspace = true }

[dev-dependencies]
tokio = { workspace = true, features = ["macros", "rt-multi-thread"] }
```

- [ ] **Step 3: Write error.rs**

```rust
//! Filter pipeline error types.

use thiserror::Error;

/// Errors produced by the filter pipeline.
#[derive(Error, Debug)]
pub enum FilterError {
    /// Format could not be detected from the input bytes.
    #[error("unable to detect format: {0}")]
    UnknownFormat(String),

    /// No filter registered for the requested format.
    #[error("no filter available for format: {0}")]
    UnsupportedFormat(String),

    /// Import failed.
    #[error("import failed: {0}")]
    ImportFailed(String),

    /// Export failed.
    #[error("export failed: {0}")]
    ExportFailed(String),

    /// I/O error during filter processing.
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    /// JSON serialization/deserialization error.
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),

    /// ZIP archive error (for OOXML formats).
    #[error("zip error: {0}")]
    Zip(#[from] zip::result::ZipError),
}

/// Convenience alias.
pub type FilterResult<T> = std::result::Result<T, FilterError>;
```

- [ ] **Step 4: Write lib.rs**

```rust
//! Unified document filter pipeline for SignApps Platform.
//!
//! Provides a two-stage pipeline for document import/export:
//! 1. `FormatDetector` identifies the input format from bytes
//! 2. `FilterRegistry` selects the appropriate `FilterTrait` implementation
//!
//! # Examples
//!
//! ```rust,ignore
//! let registry = FilterRegistry::default();
//! let format = FormatDetector::detect(&bytes, Some("report.docx"));
//! let doc = registry.import(format, &bytes)?;
//! let pdf = registry.export(&doc, Format::Pdf)?;
//! ```

pub mod error;
pub mod intermediate;
pub mod detector;
pub mod traits;
pub mod registry;
pub mod formats;

pub use error::{FilterError, FilterResult};
pub use intermediate::*;
pub use detector::{Format, FormatDetector};
pub use traits::FilterTrait;
pub use registry::FilterRegistry;
```

- [ ] **Step 5: Add to workspace**

In root `Cargo.toml`, add `"crates/signapps-filters"` to the workspace members list, after the existing crates.

- [ ] **Step 6: Verify compilation**

Run: `rtk cargo check -p signapps-filters`
Expected: 0 errors (will warn about unused modules since they're empty)

- [ ] **Step 7: Commit**

```bash
git add crates/signapps-filters/ Cargo.toml
git commit -m "feat(filters): create signapps-filters crate skeleton with error types"
```

---

## Task 2: Intermediate Document Model

**Files:**
- Create: `crates/signapps-filters/src/intermediate.rs`

- [ ] **Step 1: Write the intermediate document model**

```rust
//! Intermediate document model used as the pivot format between all filters.
//!
//! Every filter converts to/from this model. The model is a typed node tree
//! covering documents, spreadsheets, and presentations.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Top-level intermediate document — the pivot between all formats.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntermediateDocument {
    /// Document type discriminator.
    pub doc_type: DocType,
    /// Document metadata.
    pub metadata: DocMetadata,
    /// Content body — depends on doc_type.
    pub body: DocBody,
}

/// What kind of document this is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DocType {
    Document,
    Spreadsheet,
    Presentation,
}

/// Document metadata (title, author, dates).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DocMetadata {
    pub title: Option<String>,
    pub author: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub modified_at: Option<DateTime<Utc>>,
    pub language: Option<String>,
}

/// Content body — one variant per document type.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DocBody {
    Document { nodes: Vec<DocNode> },
    Spreadsheet { sheets: Vec<SheetData> },
    Presentation { slides: Vec<SlideData>, master: Option<MasterData> },
}

// ============================================================================
// Document nodes (Writer-like)
// ============================================================================

/// A block-level node in a document.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DocNode {
    Paragraph { content: Vec<InlineNode>, style: Option<String> },
    Heading { level: u8, content: Vec<InlineNode> },
    BulletList { items: Vec<ListItem> },
    OrderedList { items: Vec<ListItem>, start: u32 },
    TaskList { items: Vec<TaskItem> },
    Blockquote { nodes: Vec<DocNode> },
    CodeBlock { language: Option<String>, code: String },
    Table { rows: Vec<TableRow> },
    Image { src: String, alt: Option<String>, width: Option<u32>, height: Option<u32> },
    HorizontalRule,
    PageBreak,
}

/// An inline text span.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InlineNode {
    pub text: String,
    pub marks: InlineMarks,
}

/// Text formatting marks.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct InlineMarks {
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub bold: bool,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub italic: bool,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub underline: bool,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub strikethrough: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub background: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub font_size: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub link: Option<String>,
}

/// A list item containing block nodes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListItem {
    pub content: Vec<DocNode>,
}

/// A task list item with checked state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskItem {
    pub checked: bool,
    pub content: Vec<DocNode>,
}

/// A table row.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableRow {
    pub cells: Vec<TableCell>,
    pub is_header: bool,
}

/// A table cell.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableCell {
    pub content: Vec<DocNode>,
    pub colspan: u32,
    pub rowspan: u32,
}

// ============================================================================
// Spreadsheet data
// ============================================================================

/// A single sheet within a spreadsheet.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SheetData {
    pub name: String,
    pub rows: Vec<RowData>,
    pub col_widths: Vec<f64>,
    pub frozen_rows: u32,
    pub frozen_cols: u32,
}

/// A row of cells.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RowData {
    pub cells: Vec<CellData>,
    pub height: Option<f64>,
}

/// A spreadsheet cell.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CellData {
    pub value: CellValue,
    pub formula: Option<String>,
    pub style: Option<CellStyle>,
}

/// Cell value variants.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "v", rename_all = "snake_case")]
pub enum CellValue {
    Empty,
    Text(String),
    Number(f64),
    Bool(bool),
    Date(String),
    Error(String),
}

/// Cell formatting.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CellStyle {
    pub bold: bool,
    pub italic: bool,
    pub font_size: Option<f32>,
    pub color: Option<String>,
    pub background: Option<String>,
    pub number_format: Option<String>,
    pub alignment: Option<String>,
}

// ============================================================================
// Presentation data
// ============================================================================

/// A single slide.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlideData {
    pub layout: String,
    pub elements: Vec<SlideElement>,
    pub notes: Option<String>,
    pub transition: Option<String>,
}

/// An element on a slide.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SlideElement {
    Title { text: String },
    Subtitle { text: String },
    TextBlock { content: Vec<DocNode>, x: f64, y: f64, width: f64, height: f64 },
    Image { src: String, x: f64, y: f64, width: f64, height: f64 },
    Shape { shape_type: String, x: f64, y: f64, width: f64, height: f64 },
}

/// Master slide data (branding defaults).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MasterData {
    pub background_color: Option<String>,
    pub font_family: Option<String>,
    pub accent_color: Option<String>,
}
```

- [ ] **Step 2: Verify compilation**

Run: `rtk cargo check -p signapps-filters`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add crates/signapps-filters/src/intermediate.rs
git commit -m "feat(filters): add IntermediateDocument model (docs, sheets, slides)"
```

---

## Task 3: FilterTrait + FormatDetector + Registry

**Files:**
- Create: `crates/signapps-filters/src/traits.rs`
- Create: `crates/signapps-filters/src/detector.rs`
- Create: `crates/signapps-filters/src/registry.rs`

- [ ] **Step 1: Write traits.rs**

```rust
//! Core filter trait — every format implements this.

use crate::error::FilterResult;
use crate::intermediate::IntermediateDocument;

/// A bidirectional document filter (import and/or export).
///
/// Not all filters support both directions. A filter that only exports
/// returns `Err(FilterError::UnsupportedFormat(...))` from `import`.
pub trait FilterTrait: Send + Sync {
    /// Human-readable filter name (e.g. "DOCX Filter").
    fn name(&self) -> &str;

    /// MIME types this filter handles.
    fn mime_types(&self) -> &[&str];

    /// File extensions this filter handles (without dot).
    fn extensions(&self) -> &[&str];

    /// Import bytes into an IntermediateDocument.
    fn import(&self, bytes: &[u8]) -> FilterResult<IntermediateDocument>;

    /// Export an IntermediateDocument to bytes.
    fn export(&self, doc: &IntermediateDocument) -> FilterResult<Vec<u8>>;

    /// Whether this filter supports import.
    fn can_import(&self) -> bool { true }

    /// Whether this filter supports export.
    fn can_export(&self) -> bool { true }

    /// Output MIME type when exporting.
    fn export_mime_type(&self) -> &str;

    /// Output file extension when exporting (without dot).
    fn export_extension(&self) -> &str;
}
```

- [ ] **Step 2: Write detector.rs**

```rust
//! Format detection from bytes, file extension, and content heuristics.

use serde::{Deserialize, Serialize};

/// Known document formats.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Format {
    Docx,
    Xlsx,
    Pptx,
    Odt,
    Ods,
    Odp,
    Pdf,
    Csv,
    Markdown,
    Html,
    Text,
}

impl Format {
    /// Canonical file extension (without dot).
    pub fn extension(self) -> &'static str {
        match self {
            Self::Docx => "docx",
            Self::Xlsx => "xlsx",
            Self::Pptx => "pptx",
            Self::Odt => "odt",
            Self::Ods => "ods",
            Self::Odp => "odp",
            Self::Pdf => "pdf",
            Self::Csv => "csv",
            Self::Markdown => "md",
            Self::Html => "html",
            Self::Text => "txt",
        }
    }
}

/// Detects the format of a byte slice using multiple strategies.
pub struct FormatDetector;

impl FormatDetector {
    /// Detect format from bytes and optional filename.
    ///
    /// Strategy order:
    /// 1. Magic bytes (binary formats)
    /// 2. File extension (if filename provided)
    /// 3. Content heuristics (text formats)
    /// 4. Fallback: Text
    pub fn detect(bytes: &[u8], filename: Option<&str>) -> Format {
        // 1. Magic bytes
        if let Some(fmt) = Self::detect_magic(bytes) {
            return fmt;
        }

        // 2. File extension
        if let Some(name) = filename {
            if let Some(fmt) = Self::detect_extension(name) {
                return fmt;
            }
        }

        // 3. Content heuristics
        if let Some(fmt) = Self::detect_content(bytes) {
            return fmt;
        }

        // 4. Fallback
        Format::Text
    }

    fn detect_magic(bytes: &[u8]) -> Option<Format> {
        if bytes.len() < 4 {
            return None;
        }

        // ZIP-based formats (DOCX, XLSX, PPTX, OD*)
        if bytes[..4] == [0x50, 0x4B, 0x03, 0x04] {
            return Self::detect_zip_contents(bytes);
        }

        // PDF
        if bytes.starts_with(b"%PDF") {
            return Some(Format::Pdf);
        }

        None
    }

    fn detect_zip_contents(bytes: &[u8]) -> Option<Format> {
        let cursor = std::io::Cursor::new(bytes);
        let mut archive = zip::ZipArchive::new(cursor).ok()?;

        // Check for OOXML content types
        if archive.by_name("[Content_Types].xml").is_ok() {
            if archive.by_name("word/document.xml").is_ok() {
                return Some(Format::Docx);
            }
            if archive.by_name("xl/workbook.xml").is_ok() {
                return Some(Format::Xlsx);
            }
            if archive.by_name("ppt/presentation.xml").is_ok() {
                return Some(Format::Pptx);
            }
        }

        // Check for ODF
        if archive.by_name("content.xml").is_ok() {
            if let Ok(mut mimetype) = archive.by_name("mimetype") {
                let mut buf = String::new();
                std::io::Read::read_to_string(&mut mimetype, &mut buf).ok()?;
                return match buf.trim() {
                    "application/vnd.oasis.opendocument.text" => Some(Format::Odt),
                    "application/vnd.oasis.opendocument.spreadsheet" => Some(Format::Ods),
                    "application/vnd.oasis.opendocument.presentation" => Some(Format::Odp),
                    _ => None,
                };
            }
        }

        None
    }

    fn detect_extension(filename: &str) -> Option<Format> {
        let ext = filename.rsplit('.').next()?.to_lowercase();
        match ext.as_str() {
            "docx" => Some(Format::Docx),
            "xlsx" | "xls" | "xlsb" => Some(Format::Xlsx),
            "pptx" | "ppt" => Some(Format::Pptx),
            "odt" => Some(Format::Odt),
            "ods" => Some(Format::Ods),
            "odp" => Some(Format::Odp),
            "pdf" => Some(Format::Pdf),
            "csv" | "tsv" => Some(Format::Csv),
            "md" | "markdown" => Some(Format::Markdown),
            "html" | "htm" => Some(Format::Html),
            "txt" | "text" | "log" => Some(Format::Text),
            _ => None,
        }
    }

    fn detect_content(bytes: &[u8]) -> Option<Format> {
        let text = std::str::from_utf8(bytes).ok()?;
        let trimmed = text.trim_start();

        // HTML detection
        if trimmed.starts_with("<!DOCTYPE")
            || trimmed.starts_with("<html")
            || trimmed.starts_with("<body")
        {
            return Some(Format::Html);
        }

        // Markdown detection
        if trimmed.starts_with("# ")
            || trimmed.starts_with("## ")
            || trimmed.contains("\n# ")
            || trimmed.contains("\n## ")
            || trimmed.contains("\n```")
        {
            return Some(Format::Markdown);
        }

        // CSV detection (comma/semicolon/tab separated with consistent columns)
        let lines: Vec<&str> = trimmed.lines().take(5).collect();
        if lines.len() >= 2 {
            let delim = if lines[0].contains('\t') {
                '\t'
            } else if lines[0].contains(';') {
                ';'
            } else if lines[0].contains(',') {
                ','
            } else {
                return None;
            };
            let cols = lines[0].matches(delim).count();
            if cols >= 1 && lines.iter().skip(1).all(|l| l.matches(delim).count() == cols) {
                return Some(Format::Csv);
            }
        }

        None
    }
}
```

- [ ] **Step 3: Write registry.rs**

```rust
//! Filter registry — maps formats to their filter implementations.

use std::collections::HashMap;

use crate::detector::Format;
use crate::error::{FilterError, FilterResult};
use crate::intermediate::IntermediateDocument;
use crate::traits::FilterTrait;

/// Central registry of all available filters.
pub struct FilterRegistry {
    filters: HashMap<Format, Box<dyn FilterTrait>>,
}

impl FilterRegistry {
    /// Create an empty registry.
    pub fn new() -> Self {
        Self {
            filters: HashMap::new(),
        }
    }

    /// Create a registry pre-loaded with all built-in filters.
    pub fn with_defaults() -> Self {
        let mut registry = Self::new();
        registry.register(Format::Markdown, Box::new(crate::formats::markdown::MarkdownFilter));
        registry.register(Format::Html, Box::new(crate::formats::html::HtmlFilter));
        registry.register(Format::Text, Box::new(crate::formats::text::TextFilter));
        registry.register(Format::Csv, Box::new(crate::formats::csv::CsvFilter));
        registry.register(Format::Docx, Box::new(crate::formats::docx::DocxFilter));
        registry.register(Format::Xlsx, Box::new(crate::formats::xlsx::XlsxFilter));
        registry.register(Format::Ods, Box::new(crate::formats::ods::OdsFilter));
        registry.register(Format::Pdf, Box::new(crate::formats::pdf::PdfFilter));
        registry.register(Format::Pptx, Box::new(crate::formats::pptx::PptxFilter));
        registry
    }

    /// Register a filter for a format.
    pub fn register(&mut self, format: Format, filter: Box<dyn FilterTrait>) {
        self.filters.insert(format, filter);
    }

    /// Import bytes in the given format into an IntermediateDocument.
    pub fn import(&self, format: Format, bytes: &[u8]) -> FilterResult<IntermediateDocument> {
        let filter = self
            .filters
            .get(&format)
            .ok_or_else(|| FilterError::UnsupportedFormat(format!("{format:?}")))?;

        if !filter.can_import() {
            return Err(FilterError::UnsupportedFormat(format!(
                "{:?} filter does not support import",
                format
            )));
        }

        tracing::info!(format = ?format, filter = filter.name(), "importing document");
        filter.import(bytes)
    }

    /// Export an IntermediateDocument to bytes in the given format.
    pub fn export(&self, doc: &IntermediateDocument, format: Format) -> FilterResult<Vec<u8>> {
        let filter = self
            .filters
            .get(&format)
            .ok_or_else(|| FilterError::UnsupportedFormat(format!("{format:?}")))?;

        if !filter.can_export() {
            return Err(FilterError::UnsupportedFormat(format!(
                "{:?} filter does not support export",
                format
            )));
        }

        tracing::info!(format = ?format, filter = filter.name(), "exporting document");
        filter.export(doc)
    }

    /// Get the MIME type for a format's export output.
    pub fn export_mime_type(&self, format: Format) -> Option<&str> {
        self.filters.get(&format).map(|f| f.export_mime_type())
    }

    /// Get the file extension for a format's export output.
    pub fn export_extension(&self, format: Format) -> Option<&str> {
        self.filters.get(&format).map(|f| f.export_extension())
    }

    /// List all registered formats.
    pub fn supported_formats(&self) -> Vec<Format> {
        self.filters.keys().copied().collect()
    }
}

impl Default for FilterRegistry {
    fn default() -> Self {
        Self::with_defaults()
    }
}
```

- [ ] **Step 4: Verify compilation**

Run: `rtk cargo check -p signapps-filters`
Expected: errors about missing `formats` module (expected — next task)

- [ ] **Step 5: Commit**

```bash
git add crates/signapps-filters/src/traits.rs \
       crates/signapps-filters/src/detector.rs \
       crates/signapps-filters/src/registry.rs
git commit -m "feat(filters): add FilterTrait, FormatDetector, and FilterRegistry"
```

---

## Task 4: Text + Markdown + HTML filters (simple formats first)

**Files:**
- Create: `crates/signapps-filters/src/formats/mod.rs`
- Create: `crates/signapps-filters/src/formats/text.rs`
- Create: `crates/signapps-filters/src/formats/markdown.rs`
- Create: `crates/signapps-filters/src/formats/html.rs`

- [ ] **Step 1: Write formats/mod.rs**

```rust
//! Format filter implementations.

pub mod text;
pub mod markdown;
pub mod html;
pub mod csv;
pub mod docx;
pub mod xlsx;
pub mod ods;
pub mod pdf;
pub mod pptx;
```

- [ ] **Step 2: Write text.rs**

```rust
//! Plain text import/export filter.

use crate::error::{FilterError, FilterResult};
use crate::intermediate::*;
use crate::traits::FilterTrait;

/// Plain text filter — imports text as paragraphs, exports as joined lines.
pub struct TextFilter;

impl FilterTrait for TextFilter {
    fn name(&self) -> &str { "Plain Text Filter" }
    fn mime_types(&self) -> &[&str] { &["text/plain"] }
    fn extensions(&self) -> &[&str] { &["txt", "text", "log"] }
    fn export_mime_type(&self) -> &str { "text/plain" }
    fn export_extension(&self) -> &str { "txt" }

    fn import(&self, bytes: &[u8]) -> FilterResult<IntermediateDocument> {
        let text = String::from_utf8_lossy(bytes);
        let nodes: Vec<DocNode> = text
            .lines()
            .map(|line| DocNode::Paragraph {
                content: vec![InlineNode {
                    text: line.to_string(),
                    marks: InlineMarks::default(),
                }],
                style: None,
            })
            .collect();

        Ok(IntermediateDocument {
            doc_type: DocType::Document,
            metadata: DocMetadata::default(),
            body: DocBody::Document { nodes },
        })
    }

    fn export(&self, doc: &IntermediateDocument) -> FilterResult<Vec<u8>> {
        let DocBody::Document { nodes } = &doc.body else {
            return Err(FilterError::ExportFailed("expected document body".into()));
        };

        let mut output = String::new();
        for node in nodes {
            if let DocNode::Paragraph { content, .. } = node {
                for inline in content {
                    output.push_str(&inline.text);
                }
                output.push('\n');
            }
        }

        Ok(output.into_bytes())
    }
}
```

- [ ] **Step 3: Write markdown.rs**

```rust
//! Markdown import/export filter using comrak (GFM).

use comrak::{markdown_to_html, Options};

use crate::error::{FilterError, FilterResult};
use crate::intermediate::*;
use crate::traits::FilterTrait;

/// Markdown filter — converts GFM markdown to/from IntermediateDocument.
pub struct MarkdownFilter;

impl FilterTrait for MarkdownFilter {
    fn name(&self) -> &str { "Markdown Filter (GFM)" }
    fn mime_types(&self) -> &[&str] { &["text/markdown"] }
    fn extensions(&self) -> &[&str] { &["md", "markdown"] }
    fn export_mime_type(&self) -> &str { "text/markdown" }
    fn export_extension(&self) -> &str { "md" }

    fn import(&self, bytes: &[u8]) -> FilterResult<IntermediateDocument> {
        let text = String::from_utf8_lossy(bytes);
        let mut opts = Options::default();
        opts.extension.strikethrough = true;
        opts.extension.table = true;
        opts.extension.autolink = true;
        opts.extension.tasklist = true;
        opts.extension.superscript = true;

        let html = markdown_to_html(&text, &opts);
        // Delegate to HTML filter for DOM → IntermediateDocument conversion
        let html_filter = super::html::HtmlFilter;
        html_filter.import(html.as_bytes())
    }

    fn export(&self, doc: &IntermediateDocument) -> FilterResult<Vec<u8>> {
        let DocBody::Document { nodes } = &doc.body else {
            return Err(FilterError::ExportFailed("expected document body".into()));
        };

        let mut md = String::new();
        for node in nodes {
            node_to_markdown(node, &mut md, 0);
        }
        Ok(md.into_bytes())
    }
}

fn node_to_markdown(node: &DocNode, out: &mut String, depth: usize) {
    match node {
        DocNode::Heading { level, content } => {
            for _ in 0..*level { out.push('#'); }
            out.push(' ');
            for inline in content { inline_to_markdown(inline, out); }
            out.push_str("\n\n");
        }
        DocNode::Paragraph { content, .. } => {
            for inline in content { inline_to_markdown(inline, out); }
            out.push_str("\n\n");
        }
        DocNode::BulletList { items } => {
            for item in items {
                out.push_str(&"  ".repeat(depth));
                out.push_str("- ");
                for node in &item.content { node_to_markdown(node, out, depth + 1); }
            }
        }
        DocNode::OrderedList { items, start } => {
            for (i, item) in items.iter().enumerate() {
                out.push_str(&"  ".repeat(depth));
                out.push_str(&format!("{}. ", start + i as u32));
                for node in &item.content { node_to_markdown(node, out, depth + 1); }
            }
        }
        DocNode::TaskList { items } => {
            for item in items {
                let check = if item.checked { "[x]" } else { "[ ]" };
                out.push_str(&format!("- {check} "));
                for node in &item.content { node_to_markdown(node, out, depth + 1); }
            }
        }
        DocNode::CodeBlock { language, code } => {
            out.push_str("```");
            if let Some(lang) = language { out.push_str(lang); }
            out.push('\n');
            out.push_str(code);
            out.push_str("\n```\n\n");
        }
        DocNode::Blockquote { nodes } => {
            for node in nodes {
                out.push_str("> ");
                node_to_markdown(node, out, depth);
            }
        }
        DocNode::HorizontalRule => out.push_str("---\n\n"),
        DocNode::PageBreak => out.push_str("\n---\n\n"),
        DocNode::Image { src, alt, .. } => {
            out.push_str(&format!("![{}]({})\n\n", alt.as_deref().unwrap_or(""), src));
        }
        DocNode::Table { rows } => {
            for (i, row) in rows.iter().enumerate() {
                out.push('|');
                for cell in &row.cells {
                    out.push(' ');
                    for node in &cell.content { node_to_markdown(node, out, depth); }
                    out.push_str(" |");
                }
                out.push('\n');
                if i == 0 {
                    out.push('|');
                    for _ in &row.cells { out.push_str(" --- |"); }
                    out.push('\n');
                }
            }
            out.push('\n');
        }
    }
}

fn inline_to_markdown(inline: &InlineNode, out: &mut String) {
    let mut prefix = String::new();
    let mut suffix = String::new();

    if inline.marks.bold { prefix.push_str("**"); suffix.insert_str(0, "**"); }
    if inline.marks.italic { prefix.push('*'); suffix.insert(0, '*'); }
    if inline.marks.strikethrough { prefix.push_str("~~"); suffix.insert_str(0, "~~"); }
    if let Some(link) = &inline.marks.link {
        prefix.push('[');
        suffix.push_str(&format!("]({})", link));
    }

    out.push_str(&prefix);
    out.push_str(&inline.text);
    out.push_str(&suffix);
}
```

- [ ] **Step 4: Write html.rs**

```rust
//! HTML import/export filter using scraper.

use scraper::{Html, Selector};

use crate::error::{FilterError, FilterResult};
use crate::intermediate::*;
use crate::traits::FilterTrait;

/// HTML filter — parses HTML DOM into IntermediateDocument nodes.
pub struct HtmlFilter;

impl FilterTrait for HtmlFilter {
    fn name(&self) -> &str { "HTML Filter" }
    fn mime_types(&self) -> &[&str] { &["text/html"] }
    fn extensions(&self) -> &[&str] { &["html", "htm"] }
    fn export_mime_type(&self) -> &str { "text/html" }
    fn export_extension(&self) -> &str { "html" }

    fn import(&self, bytes: &[u8]) -> FilterResult<IntermediateDocument> {
        let html_str = String::from_utf8_lossy(bytes);
        let document = Html::parse_document(&html_str);

        let body_sel = Selector::parse("body").unwrap();
        let root = document.select(&body_sel).next();

        let nodes = if let Some(body) = root {
            parse_children(&body)
        } else {
            let fragment = Html::parse_fragment(&html_str);
            parse_children(&fragment.root_element())
        };

        Ok(IntermediateDocument {
            doc_type: DocType::Document,
            metadata: DocMetadata::default(),
            body: DocBody::Document { nodes },
        })
    }

    fn export(&self, doc: &IntermediateDocument) -> FilterResult<Vec<u8>> {
        let DocBody::Document { nodes } = &doc.body else {
            return Err(FilterError::ExportFailed("expected document body".into()));
        };

        let mut html = String::from("<!DOCTYPE html><html><body>\n");
        for node in nodes {
            node_to_html(node, &mut html);
        }
        html.push_str("</body></html>");
        Ok(html.into_bytes())
    }
}

fn parse_children(element: &scraper::ElementRef) -> Vec<DocNode> {
    let mut nodes = Vec::new();
    for child in element.children() {
        if let Some(el) = scraper::ElementRef::wrap(child) {
            let tag = el.value().name();
            match tag {
                "h1" | "h2" | "h3" | "h4" | "h5" | "h6" => {
                    let level = tag[1..].parse::<u8>().unwrap_or(1);
                    nodes.push(DocNode::Heading {
                        level,
                        content: extract_inlines(&el),
                    });
                }
                "p" => {
                    nodes.push(DocNode::Paragraph {
                        content: extract_inlines(&el),
                        style: None,
                    });
                }
                "ul" => {
                    let items = el
                        .children()
                        .filter_map(scraper::ElementRef::wrap)
                        .filter(|c| c.value().name() == "li")
                        .map(|li| ListItem { content: parse_children(&li) })
                        .collect();
                    nodes.push(DocNode::BulletList { items });
                }
                "ol" => {
                    let start = el.value().attr("start")
                        .and_then(|s| s.parse().ok())
                        .unwrap_or(1);
                    let items = el
                        .children()
                        .filter_map(scraper::ElementRef::wrap)
                        .filter(|c| c.value().name() == "li")
                        .map(|li| ListItem { content: parse_children(&li) })
                        .collect();
                    nodes.push(DocNode::OrderedList { items, start });
                }
                "blockquote" => {
                    nodes.push(DocNode::Blockquote {
                        nodes: parse_children(&el),
                    });
                }
                "pre" => {
                    let code_el = el.children()
                        .filter_map(scraper::ElementRef::wrap)
                        .find(|c| c.value().name() == "code");
                    let (lang, code) = if let Some(ce) = code_el {
                        let lang = ce.value().attr("class")
                            .and_then(|c| c.strip_prefix("language-"))
                            .map(|s| s.to_string());
                        (lang, ce.text().collect::<String>())
                    } else {
                        (None, el.text().collect::<String>())
                    };
                    nodes.push(DocNode::CodeBlock { language: lang, code });
                }
                "hr" => nodes.push(DocNode::HorizontalRule),
                "img" => {
                    let src = el.value().attr("src").unwrap_or("").to_string();
                    let alt = el.value().attr("alt").map(|s| s.to_string());
                    nodes.push(DocNode::Image { src, alt, width: None, height: None });
                }
                "table" => {
                    nodes.push(parse_table(&el));
                }
                "div" | "section" | "article" | "main" => {
                    nodes.extend(parse_children(&el));
                }
                _ => {
                    let text = el.text().collect::<String>();
                    if !text.trim().is_empty() {
                        nodes.push(DocNode::Paragraph {
                            content: vec![InlineNode {
                                text,
                                marks: InlineMarks::default(),
                            }],
                            style: None,
                        });
                    }
                }
            }
        } else if let Some(text_node) = child.value().as_text() {
            let text = text_node.trim().to_string();
            if !text.is_empty() && nodes.is_empty() {
                nodes.push(DocNode::Paragraph {
                    content: vec![InlineNode { text, marks: InlineMarks::default() }],
                    style: None,
                });
            }
        }
    }
    nodes
}

fn extract_inlines(el: &scraper::ElementRef) -> Vec<InlineNode> {
    let mut inlines = Vec::new();
    for child in el.children() {
        if let Some(sub) = scraper::ElementRef::wrap(child) {
            let tag = sub.value().name();
            let text = sub.text().collect::<String>();
            if text.is_empty() { continue; }
            let mut marks = InlineMarks::default();
            match tag {
                "strong" | "b" => marks.bold = true,
                "em" | "i" => marks.italic = true,
                "u" => marks.underline = true,
                "s" | "del" | "strike" => marks.strikethrough = true,
                "a" => marks.link = sub.value().attr("href").map(|s| s.to_string()),
                "code" => { /* inline code — keep as text */ }
                _ => {}
            }
            inlines.push(InlineNode { text, marks });
        } else if let Some(text_node) = child.value().as_text() {
            let text = text_node.to_string();
            if !text.is_empty() {
                inlines.push(InlineNode { text, marks: InlineMarks::default() });
            }
        }
    }
    if inlines.is_empty() {
        let text = el.text().collect::<String>();
        if !text.is_empty() {
            inlines.push(InlineNode { text, marks: InlineMarks::default() });
        }
    }
    inlines
}

fn parse_table(el: &scraper::ElementRef) -> DocNode {
    let mut rows = Vec::new();
    let row_sel = Selector::parse("tr").unwrap();
    for tr in el.select(&row_sel) {
        let mut cells = Vec::new();
        let is_header = tr.children()
            .filter_map(scraper::ElementRef::wrap)
            .any(|c| c.value().name() == "th");
        for child in tr.children().filter_map(scraper::ElementRef::wrap) {
            if child.value().name() == "td" || child.value().name() == "th" {
                cells.push(TableCell {
                    content: parse_children(&child),
                    colspan: child.value().attr("colspan").and_then(|s| s.parse().ok()).unwrap_or(1),
                    rowspan: child.value().attr("rowspan").and_then(|s| s.parse().ok()).unwrap_or(1),
                });
            }
        }
        rows.push(TableRow { cells, is_header });
    }
    DocNode::Table { rows }
}

fn node_to_html(node: &DocNode, out: &mut String) {
    match node {
        DocNode::Heading { level, content } => {
            out.push_str(&format!("<h{level}>"));
            for inline in content { inline_to_html(inline, out); }
            out.push_str(&format!("</h{level}>\n"));
        }
        DocNode::Paragraph { content, .. } => {
            out.push_str("<p>");
            for inline in content { inline_to_html(inline, out); }
            out.push_str("</p>\n");
        }
        DocNode::BulletList { items } => {
            out.push_str("<ul>\n");
            for item in items {
                out.push_str("<li>");
                for n in &item.content { node_to_html(n, out); }
                out.push_str("</li>\n");
            }
            out.push_str("</ul>\n");
        }
        DocNode::OrderedList { items, start } => {
            out.push_str(&format!("<ol start=\"{start}\">\n"));
            for item in items {
                out.push_str("<li>");
                for n in &item.content { node_to_html(n, out); }
                out.push_str("</li>\n");
            }
            out.push_str("</ol>\n");
        }
        DocNode::CodeBlock { language, code } => {
            let lang_attr = language.as_deref().map(|l| format!(" class=\"language-{l}\"")).unwrap_or_default();
            out.push_str(&format!("<pre><code{lang_attr}>{code}</code></pre>\n"));
        }
        DocNode::Blockquote { nodes } => {
            out.push_str("<blockquote>");
            for n in nodes { node_to_html(n, out); }
            out.push_str("</blockquote>\n");
        }
        DocNode::HorizontalRule => out.push_str("<hr />\n"),
        DocNode::PageBreak => out.push_str("<div style=\"page-break-after: always\"></div>\n"),
        DocNode::Image { src, alt, width, height } => {
            let alt_str = alt.as_deref().unwrap_or("");
            let mut attrs = format!("src=\"{src}\" alt=\"{alt_str}\"");
            if let Some(w) = width { attrs.push_str(&format!(" width=\"{w}\"")); }
            if let Some(h) = height { attrs.push_str(&format!(" height=\"{h}\"")); }
            out.push_str(&format!("<img {attrs} />\n"));
        }
        DocNode::Table { rows } => {
            out.push_str("<table>\n");
            for row in rows {
                out.push_str("<tr>");
                let tag = if row.is_header { "th" } else { "td" };
                for cell in &row.cells {
                    out.push_str(&format!("<{tag}>"));
                    for n in &cell.content { node_to_html(n, out); }
                    out.push_str(&format!("</{tag}>"));
                }
                out.push_str("</tr>\n");
            }
            out.push_str("</table>\n");
        }
        DocNode::TaskList { items } => {
            out.push_str("<ul>\n");
            for item in items {
                let checked = if item.checked { " checked" } else { "" };
                out.push_str(&format!("<li><input type=\"checkbox\"{checked} disabled /> "));
                for n in &item.content { node_to_html(n, out); }
                out.push_str("</li>\n");
            }
            out.push_str("</ul>\n");
        }
    }
}

fn inline_to_html(inline: &InlineNode, out: &mut String) {
    if let Some(link) = &inline.marks.link { out.push_str(&format!("<a href=\"{link}\">")); }
    if inline.marks.bold { out.push_str("<strong>"); }
    if inline.marks.italic { out.push_str("<em>"); }
    if inline.marks.underline { out.push_str("<u>"); }
    if inline.marks.strikethrough { out.push_str("<s>"); }

    out.push_str(&inline.text);

    if inline.marks.strikethrough { out.push_str("</s>"); }
    if inline.marks.underline { out.push_str("</u>"); }
    if inline.marks.italic { out.push_str("</em>"); }
    if inline.marks.bold { out.push_str("</strong>"); }
    if let Some(_) = &inline.marks.link { out.push_str("</a>"); }
}
```

- [ ] **Step 5: Verify compilation**

Run: `rtk cargo check -p signapps-filters`
Expected: errors about missing csv/docx/xlsx/ods/pdf/pptx modules (expected — next tasks)

- [ ] **Step 6: Commit**

```bash
git add crates/signapps-filters/src/formats/
git commit -m "feat(filters): add Text, Markdown, HTML filters with IntermediateDocument conversion"
```

---

## Task 5: CSV + DOCX + XLSX + ODS + PDF + PPTX filter stubs

**Files:**
- Create: `crates/signapps-filters/src/formats/csv.rs`
- Create: `crates/signapps-filters/src/formats/docx.rs`
- Create: `crates/signapps-filters/src/formats/xlsx.rs`
- Create: `crates/signapps-filters/src/formats/ods.rs`
- Create: `crates/signapps-filters/src/formats/pdf.rs`
- Create: `crates/signapps-filters/src/formats/pptx.rs`

> **Note:** These filters delegate to the existing code in `signapps-docs/src/office/`. The full migration of the internal logic is a separate follow-up task. For now, each filter implements the `FilterTrait` interface with the core conversion logic, reusing the existing parsing crates (calamine, docx-rs, rust_xlsxwriter, etc.) directly.

- [ ] **Step 1: Write csv.rs**

```rust
//! CSV import/export filter.

use crate::error::{FilterError, FilterResult};
use crate::intermediate::*;
use crate::traits::FilterTrait;

/// CSV filter — imports/exports tabular data.
pub struct CsvFilter;

impl FilterTrait for CsvFilter {
    fn name(&self) -> &str { "CSV Filter" }
    fn mime_types(&self) -> &[&str] { &["text/csv"] }
    fn extensions(&self) -> &[&str] { &["csv", "tsv"] }
    fn export_mime_type(&self) -> &str { "text/csv" }
    fn export_extension(&self) -> &str { "csv" }

    fn import(&self, bytes: &[u8]) -> FilterResult<IntermediateDocument> {
        let text = String::from_utf8_lossy(bytes);
        let delimiter = detect_delimiter(&text);

        let rows: Vec<RowData> = text
            .lines()
            .filter(|l| !l.trim().is_empty())
            .map(|line| {
                let cells = line
                    .split(delimiter)
                    .map(|val| {
                        let trimmed = val.trim().trim_matches('"');
                        CellData {
                            value: if trimmed.is_empty() {
                                CellValue::Empty
                            } else if let Ok(n) = trimmed.parse::<f64>() {
                                CellValue::Number(n)
                            } else {
                                CellValue::Text(trimmed.to_string())
                            },
                            formula: None,
                            style: None,
                        }
                    })
                    .collect();
                RowData { cells, height: None }
            })
            .collect();

        Ok(IntermediateDocument {
            doc_type: DocType::Spreadsheet,
            metadata: DocMetadata::default(),
            body: DocBody::Spreadsheet {
                sheets: vec![SheetData {
                    name: "Sheet1".to_string(),
                    rows,
                    col_widths: Vec::new(),
                    frozen_rows: 0,
                    frozen_cols: 0,
                }],
            },
        })
    }

    fn export(&self, doc: &IntermediateDocument) -> FilterResult<Vec<u8>> {
        let DocBody::Spreadsheet { sheets } = &doc.body else {
            return Err(FilterError::ExportFailed("expected spreadsheet body".into()));
        };
        let sheet = sheets.first().ok_or_else(|| FilterError::ExportFailed("no sheets".into()))?;

        let mut output = String::new();
        for row in &sheet.rows {
            let line: Vec<String> = row.cells.iter().map(|c| match &c.value {
                CellValue::Empty => String::new(),
                CellValue::Text(s) => {
                    if s.contains(',') || s.contains('"') || s.contains('\n') {
                        format!("\"{}\"", s.replace('"', "\"\""))
                    } else {
                        s.clone()
                    }
                }
                CellValue::Number(n) => n.to_string(),
                CellValue::Bool(b) => b.to_string(),
                CellValue::Date(d) => d.clone(),
                CellValue::Error(e) => e.clone(),
            }).collect();
            output.push_str(&line.join(","));
            output.push('\n');
        }
        Ok(output.into_bytes())
    }
}

fn detect_delimiter(text: &str) -> char {
    let first_line = text.lines().next().unwrap_or("");
    let tab_count = first_line.matches('\t').count();
    let semi_count = first_line.matches(';').count();
    let comma_count = first_line.matches(',').count();

    if tab_count > comma_count && tab_count > semi_count { '\t' }
    else if semi_count > comma_count { ';' }
    else { ',' }
}
```

- [ ] **Step 2: Write the remaining filter stubs (docx, xlsx, ods, pdf, pptx)**

Each stub implements `FilterTrait` with the core logic. For the initial version, import/export performs basic conversion. Full fidelity migration from `signapps-docs` is done incrementally.

Create `crates/signapps-filters/src/formats/docx.rs`:

```rust
//! DOCX import/export filter.

use crate::error::{FilterError, FilterResult};
use crate::intermediate::*;
use crate::traits::FilterTrait;

/// DOCX (Office Open XML) filter.
pub struct DocxFilter;

impl FilterTrait for DocxFilter {
    fn name(&self) -> &str { "DOCX Filter" }
    fn mime_types(&self) -> &[&str] { &["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] }
    fn extensions(&self) -> &[&str] { &["docx"] }
    fn export_mime_type(&self) -> &str { "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
    fn export_extension(&self) -> &str { "docx" }

    fn import(&self, bytes: &[u8]) -> FilterResult<IntermediateDocument> {
        let cursor = std::io::Cursor::new(bytes);
        let mut archive = zip::ZipArchive::new(cursor)
            .map_err(|e| FilterError::ImportFailed(format!("invalid DOCX zip: {e}")))?;

        let mut xml = String::new();
        {
            let mut doc_xml = archive
                .by_name("word/document.xml")
                .map_err(|e| FilterError::ImportFailed(format!("missing word/document.xml: {e}")))?;
            std::io::Read::read_to_string(&mut doc_xml, &mut xml)
                .map_err(|e| FilterError::ImportFailed(format!("read error: {e}")))?;
        }

        let nodes = parse_docx_xml(&xml);

        Ok(IntermediateDocument {
            doc_type: DocType::Document,
            metadata: DocMetadata::default(),
            body: DocBody::Document { nodes },
        })
    }

    fn export(&self, doc: &IntermediateDocument) -> FilterResult<Vec<u8>> {
        let DocBody::Document { nodes } = &doc.body else {
            return Err(FilterError::ExportFailed("expected document body".into()));
        };

        // Convert to HTML first, then use the existing HTML→DOCX path
        let mut html = String::new();
        for node in nodes {
            super::html::node_to_html(node, &mut html);
        }

        // Build minimal DOCX using docx-rs
        let mut docx = docx_rs::Docx::new();
        for node in nodes {
            match node {
                DocNode::Paragraph { content, .. } => {
                    let mut para = docx_rs::Paragraph::new();
                    for inline in content {
                        let mut run = docx_rs::Run::new().add_text(&inline.text);
                        if inline.marks.bold {
                            run = run.bold();
                        }
                        if inline.marks.italic {
                            run = run.italic();
                        }
                        para = para.add_run(run);
                    }
                    docx = docx.add_paragraph(para);
                }
                DocNode::Heading { level, content } => {
                    let style = format!("Heading{level}");
                    let mut para = docx_rs::Paragraph::new()
                        .style(&style);
                    for inline in content {
                        para = para.add_run(docx_rs::Run::new().add_text(&inline.text));
                    }
                    docx = docx.add_paragraph(para);
                }
                _ => {
                    // Other node types: serialize as plain text paragraph for now
                    let text = node_to_plain_text(node);
                    if !text.is_empty() {
                        docx = docx.add_paragraph(
                            docx_rs::Paragraph::new().add_run(docx_rs::Run::new().add_text(&text))
                        );
                    }
                }
            }
        }

        let mut buf = Vec::new();
        docx.build()
            .pack(&mut std::io::Cursor::new(&mut buf))
            .map_err(|e| FilterError::ExportFailed(format!("docx pack error: {e}")))?;
        Ok(buf)
    }
}

fn node_to_plain_text(node: &DocNode) -> String {
    match node {
        DocNode::Paragraph { content, .. } | DocNode::Heading { content, .. } => {
            content.iter().map(|i| i.text.as_str()).collect::<Vec<_>>().join("")
        }
        DocNode::CodeBlock { code, .. } => code.clone(),
        DocNode::BulletList { items } | DocNode::OrderedList { items, .. } => {
            items.iter().flat_map(|i| i.content.iter().map(node_to_plain_text)).collect::<Vec<_>>().join("\n")
        }
        _ => String::new(),
    }
}

fn parse_docx_xml(xml: &str) -> Vec<DocNode> {
    // Simplified XML parser — extracts paragraphs and basic formatting
    // from word/document.xml. Full fidelity parsing to be migrated from
    // signapps-docs/src/office/importer/docx.rs incrementally.
    let mut nodes = Vec::new();
    let mut in_paragraph = false;
    let mut current_text = String::new();
    let mut is_bold = false;
    let mut is_italic = false;

    for line in xml.lines() {
        let trimmed = line.trim();
        if trimmed.contains("<w:p ") || trimmed.contains("<w:p>") {
            in_paragraph = true;
            current_text.clear();
            is_bold = false;
            is_italic = false;
        }
        if trimmed.contains("<w:b/>") || trimmed.contains("<w:b ") { is_bold = true; }
        if trimmed.contains("<w:i/>") || trimmed.contains("<w:i ") { is_italic = true; }
        if trimmed.contains("<w:t>") || trimmed.contains("<w:t ") {
            if let Some(start) = trimmed.find('>') {
                if let Some(end) = trimmed[start+1..].find('<') {
                    current_text.push_str(&trimmed[start+1..start+1+end]);
                }
            }
        }
        if trimmed.contains("</w:p>") && in_paragraph {
            in_paragraph = false;
            if !current_text.is_empty() {
                nodes.push(DocNode::Paragraph {
                    content: vec![InlineNode {
                        text: current_text.clone(),
                        marks: InlineMarks {
                            bold: is_bold,
                            italic: is_italic,
                            ..InlineMarks::default()
                        },
                    }],
                    style: None,
                });
            }
        }
    }
    nodes
}
```

Create `crates/signapps-filters/src/formats/xlsx.rs`:

```rust
//! XLSX import/export filter using calamine + rust_xlsxwriter.

use calamine::{Reader, Xlsx, Data};

use crate::error::{FilterError, FilterResult};
use crate::intermediate::*;
use crate::traits::FilterTrait;

/// XLSX (Excel) filter.
pub struct XlsxFilter;

impl FilterTrait for XlsxFilter {
    fn name(&self) -> &str { "XLSX Filter" }
    fn mime_types(&self) -> &[&str] { &["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] }
    fn extensions(&self) -> &[&str] { &["xlsx", "xls", "xlsb"] }
    fn export_mime_type(&self) -> &str { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
    fn export_extension(&self) -> &str { "xlsx" }

    fn import(&self, bytes: &[u8]) -> FilterResult<IntermediateDocument> {
        let cursor = std::io::Cursor::new(bytes);
        let mut workbook: Xlsx<_> = Xlsx::new(cursor)
            .map_err(|e| FilterError::ImportFailed(format!("xlsx read error: {e}")))?;

        let sheet_names: Vec<String> = workbook.sheet_names().to_vec();
        let mut sheets = Vec::new();

        for name in &sheet_names {
            let range = workbook.worksheet_range(name)
                .map_err(|e| FilterError::ImportFailed(format!("sheet '{name}': {e}")))?;

            let mut rows = Vec::new();
            for row in range.rows() {
                let cells: Vec<CellData> = row.iter().map(|cell| {
                    let value = match cell {
                        Data::Empty => CellValue::Empty,
                        Data::String(s) => CellValue::Text(s.clone()),
                        Data::Float(f) => CellValue::Number(*f),
                        Data::Int(i) => CellValue::Number(*i as f64),
                        Data::Bool(b) => CellValue::Bool(*b),
                        Data::DateTime(dt) => CellValue::Date(format!("{dt}")),
                        Data::Error(e) => CellValue::Error(format!("{e:?}")),
                        _ => CellValue::Empty,
                    };
                    CellData { value, formula: None, style: None }
                }).collect();
                rows.push(RowData { cells, height: None });
            }

            sheets.push(SheetData {
                name: name.clone(),
                rows,
                col_widths: Vec::new(),
                frozen_rows: 0,
                frozen_cols: 0,
            });
        }

        Ok(IntermediateDocument {
            doc_type: DocType::Spreadsheet,
            metadata: DocMetadata::default(),
            body: DocBody::Spreadsheet { sheets },
        })
    }

    fn export(&self, doc: &IntermediateDocument) -> FilterResult<Vec<u8>> {
        let DocBody::Spreadsheet { sheets } = &doc.body else {
            return Err(FilterError::ExportFailed("expected spreadsheet body".into()));
        };

        let mut workbook = rust_xlsxwriter::Workbook::new();

        for sheet_data in sheets {
            let worksheet = workbook.add_worksheet();
            worksheet.set_name(&sheet_data.name)
                .map_err(|e| FilterError::ExportFailed(format!("set name: {e}")))?;

            for (row_idx, row) in sheet_data.rows.iter().enumerate() {
                for (col_idx, cell) in row.cells.iter().enumerate() {
                    let r = row_idx as u32;
                    let c = col_idx as u16;
                    match &cell.value {
                        CellValue::Text(s) => { worksheet.write_string(r, c, s).ok(); }
                        CellValue::Number(n) => { worksheet.write_number(r, c, *n).ok(); }
                        CellValue::Bool(b) => { worksheet.write_boolean(r, c, *b).ok(); }
                        CellValue::Date(d) => { worksheet.write_string(r, c, d).ok(); }
                        _ => {}
                    }
                }
            }
        }

        let buf = workbook.save_to_buffer()
            .map_err(|e| FilterError::ExportFailed(format!("xlsx save: {e}")))?;
        Ok(buf)
    }
}
```

Create `crates/signapps-filters/src/formats/ods.rs`:

```rust
//! ODS (OpenDocument Spreadsheet) import/export filter.

use calamine::{Reader, Ods, Data};

use crate::error::{FilterError, FilterResult};
use crate::intermediate::*;
use crate::traits::FilterTrait;

/// ODS filter — delegates to calamine for reading.
pub struct OdsFilter;

impl FilterTrait for OdsFilter {
    fn name(&self) -> &str { "ODS Filter" }
    fn mime_types(&self) -> &[&str] { &["application/vnd.oasis.opendocument.spreadsheet"] }
    fn extensions(&self) -> &[&str] { &["ods"] }
    fn export_mime_type(&self) -> &str { "application/vnd.oasis.opendocument.spreadsheet" }
    fn export_extension(&self) -> &str { "ods" }

    fn import(&self, bytes: &[u8]) -> FilterResult<IntermediateDocument> {
        let cursor = std::io::Cursor::new(bytes);
        let mut workbook: Ods<_> = Ods::new(cursor)
            .map_err(|e| FilterError::ImportFailed(format!("ods read error: {e}")))?;

        let sheet_names: Vec<String> = workbook.sheet_names().to_vec();
        let mut sheets = Vec::new();

        for name in &sheet_names {
            let range = workbook.worksheet_range(name)
                .map_err(|e| FilterError::ImportFailed(format!("sheet '{name}': {e}")))?;

            let mut rows = Vec::new();
            for row in range.rows() {
                let cells: Vec<CellData> = row.iter().map(|cell| {
                    let value = match cell {
                        Data::Empty => CellValue::Empty,
                        Data::String(s) => CellValue::Text(s.clone()),
                        Data::Float(f) => CellValue::Number(*f),
                        Data::Int(i) => CellValue::Number(*i as f64),
                        Data::Bool(b) => CellValue::Bool(*b),
                        Data::DateTime(dt) => CellValue::Date(format!("{dt}")),
                        Data::Error(e) => CellValue::Error(format!("{e:?}")),
                        _ => CellValue::Empty,
                    };
                    CellData { value, formula: None, style: None }
                }).collect();
                rows.push(RowData { cells, height: None });
            }

            sheets.push(SheetData {
                name: name.clone(),
                rows,
                col_widths: Vec::new(),
                frozen_rows: 0,
                frozen_cols: 0,
            });
        }

        Ok(IntermediateDocument {
            doc_type: DocType::Spreadsheet,
            metadata: DocMetadata::default(),
            body: DocBody::Spreadsheet { sheets },
        })
    }

    fn export(&self, _doc: &IntermediateDocument) -> FilterResult<Vec<u8>> {
        // ODS export requires building the OpenDocument ZIP manually.
        // For now, convert to XLSX as a fallback — full ODS export is a follow-up.
        Err(FilterError::UnsupportedFormat("ODS export not yet implemented — use XLSX".into()))
    }

    fn can_export(&self) -> bool { false }
}
```

Create `crates/signapps-filters/src/formats/pdf.rs`:

```rust
//! PDF export filter.

use crate::error::{FilterError, FilterResult};
use crate::intermediate::*;
use crate::traits::FilterTrait;

/// PDF filter — export only (PDF import is text extraction, not round-trip).
pub struct PdfFilter;

impl FilterTrait for PdfFilter {
    fn name(&self) -> &str { "PDF Filter" }
    fn mime_types(&self) -> &[&str] { &["application/pdf"] }
    fn extensions(&self) -> &[&str] { &["pdf"] }
    fn export_mime_type(&self) -> &str { "application/pdf" }
    fn export_extension(&self) -> &str { "pdf" }
    fn can_import(&self) -> bool { false }

    fn import(&self, _bytes: &[u8]) -> FilterResult<IntermediateDocument> {
        Err(FilterError::UnsupportedFormat("PDF import not supported — use text extraction".into()))
    }

    fn export(&self, doc: &IntermediateDocument) -> FilterResult<Vec<u8>> {
        let DocBody::Document { nodes } = &doc.body else {
            return Err(FilterError::ExportFailed("expected document body for PDF".into()));
        };

        // Convert to HTML first, then generate PDF
        let mut html = String::from("<html><body style=\"font-family: Helvetica; font-size: 12pt;\">\n");
        for node in nodes {
            super::html::node_to_html(node, &mut html);
        }
        html.push_str("</body></html>");

        // Use printpdf for basic PDF generation
        use printpdf::*;
        let (pdfdoc, page1, layer1) = PdfDocument::new(
            doc.metadata.title.as_deref().unwrap_or("Document"),
            Mm(210.0), Mm(297.0), "Layer 1",
        );

        let font = pdfdoc.add_builtin_font(BuiltinFont::Helvetica)
            .map_err(|e| FilterError::ExportFailed(format!("font error: {e}")))?;
        let layer = pdfdoc.get_page(page1).get_layer(layer1);

        let mut y = 280.0_f64;
        for node in nodes {
            let (text, font_size) = match node {
                DocNode::Heading { level, content } => {
                    let size = match level { 1 => 24.0, 2 => 20.0, 3 => 16.0, _ => 14.0 };
                    let t: String = content.iter().map(|i| i.text.as_str()).collect();
                    (t, size)
                }
                DocNode::Paragraph { content, .. } => {
                    let t: String = content.iter().map(|i| i.text.as_str()).collect();
                    (t, 12.0)
                }
                _ => continue,
            };

            if y < 20.0 { break; } // Simple page overflow guard

            layer.use_text(&text, font_size, Mm(20.0), Mm(y), &font);
            y -= font_size * 0.5 + 4.0;
        }

        let bytes = pdfdoc.save_to_bytes()
            .map_err(|e| FilterError::ExportFailed(format!("pdf save: {e}")))?;
        Ok(bytes)
    }
}
```

Create `crates/signapps-filters/src/formats/pptx.rs`:

```rust
//! PPTX import/export filter.

use crate::error::{FilterError, FilterResult};
use crate::intermediate::*;
use crate::traits::FilterTrait;

/// PPTX filter — export reuses existing presentation module logic.
pub struct PptxFilter;

impl FilterTrait for PptxFilter {
    fn name(&self) -> &str { "PPTX Filter" }
    fn mime_types(&self) -> &[&str] { &["application/vnd.openxmlformats-officedocument.presentationml.presentation"] }
    fn extensions(&self) -> &[&str] { &["pptx"] }
    fn export_mime_type(&self) -> &str { "application/vnd.openxmlformats-officedocument.presentationml.presentation" }
    fn export_extension(&self) -> &str { "pptx" }

    fn import(&self, bytes: &[u8]) -> FilterResult<IntermediateDocument> {
        let cursor = std::io::Cursor::new(bytes);
        let mut archive = zip::ZipArchive::new(cursor)
            .map_err(|e| FilterError::ImportFailed(format!("invalid PPTX zip: {e}")))?;

        // Read presentation.xml for slide count
        let mut pres_xml = String::new();
        {
            let mut pres = archive.by_name("ppt/presentation.xml")
                .map_err(|e| FilterError::ImportFailed(format!("missing presentation.xml: {e}")))?;
            std::io::Read::read_to_string(&mut pres, &mut pres_xml).ok();
        }

        // Parse individual slide XMLs
        let mut slides = Vec::new();
        for i in 1..=100 {
            let slide_path = format!("ppt/slides/slide{i}.xml");
            let Ok(mut slide_file) = archive.by_name(&slide_path) else { break };
            let mut slide_xml = String::new();
            std::io::Read::read_to_string(&mut slide_file, &mut slide_xml).ok();

            let elements = parse_slide_xml(&slide_xml);
            slides.push(SlideData {
                layout: "title_and_content".to_string(),
                elements,
                notes: None,
                transition: None,
            });
        }

        Ok(IntermediateDocument {
            doc_type: DocType::Presentation,
            metadata: DocMetadata::default(),
            body: DocBody::Presentation { slides, master: None },
        })
    }

    fn export(&self, _doc: &IntermediateDocument) -> FilterResult<Vec<u8>> {
        // PPTX export delegates to the existing presentation module in signapps-docs.
        // This stub will be wired up when signapps-docs integrates signapps-filters.
        Err(FilterError::UnsupportedFormat(
            "PPTX export via filter pipeline not yet wired — use /api/v1/presentation/export".into()
        ))
    }

    fn can_export(&self) -> bool { false }
}

fn parse_slide_xml(xml: &str) -> Vec<SlideElement> {
    let mut elements = Vec::new();

    // Extract text content from <a:t> tags within the slide XML
    let mut current_texts: Vec<String> = Vec::new();
    for line in xml.lines() {
        let trimmed = line.trim();
        if trimmed.contains("<a:t>") || trimmed.contains("<a:t ") {
            if let Some(start) = trimmed.find('>') {
                if let Some(end) = trimmed[start+1..].find('<') {
                    let text = &trimmed[start+1..start+1+end];
                    if !text.trim().is_empty() {
                        current_texts.push(text.to_string());
                    }
                }
            }
        }
    }

    // Group extracted texts as slide elements
    for (i, text) in current_texts.iter().enumerate() {
        if i == 0 {
            elements.push(SlideElement::Title { text: text.clone() });
        } else {
            elements.push(SlideElement::TextBlock {
                content: vec![DocNode::Paragraph {
                    content: vec![InlineNode {
                        text: text.clone(),
                        marks: InlineMarks::default(),
                    }],
                    style: None,
                }],
                x: 50.0, y: 100.0 + (i as f64 * 40.0),
                width: 600.0, height: 40.0,
            });
        }
    }

    elements
}
```

- [ ] **Step 3: Make html::node_to_html and html::inline_to_html public**

In `crates/signapps-filters/src/formats/html.rs`, change these two functions from private to `pub(crate)`:

```rust
pub(crate) fn node_to_html(node: &DocNode, out: &mut String) {
```

```rust
pub(crate) fn inline_to_html(inline: &InlineNode, out: &mut String) {
```

- [ ] **Step 4: Verify compilation**

Run: `rtk cargo check -p signapps-filters`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add crates/signapps-filters/src/formats/
git commit -m "feat(filters): add CSV, DOCX, XLSX, ODS, PDF, PPTX filters"
```

---

## Task 6: Unit tests

**Files:**
- Create: `crates/signapps-filters/tests/pipeline_tests.rs`

- [ ] **Step 1: Write integration tests**

```rust
//! Filter pipeline integration tests.

use signapps_filters::*;
use signapps_filters::detector::{Format, FormatDetector};
use signapps_filters::registry::FilterRegistry;

// ── Format Detection ───────────────────────────────────────────────────

#[test]
fn detect_markdown_by_content() {
    let bytes = b"# Hello World\n\nSome paragraph\n";
    assert_eq!(FormatDetector::detect(bytes, None), Format::Markdown);
}

#[test]
fn detect_html_by_content() {
    let bytes = b"<!DOCTYPE html><html><body>Hello</body></html>";
    assert_eq!(FormatDetector::detect(bytes, None), Format::Html);
}

#[test]
fn detect_csv_by_content() {
    let bytes = b"name,age,city\nAlice,30,Paris\nBob,25,Lyon\n";
    assert_eq!(FormatDetector::detect(bytes, None), Format::Csv);
}

#[test]
fn detect_docx_by_extension() {
    let bytes = b"not a real docx";
    assert_eq!(FormatDetector::detect(bytes, Some("report.docx")), Format::Docx);
}

#[test]
fn detect_pdf_by_magic_bytes() {
    let bytes = b"%PDF-1.4 some content";
    assert_eq!(FormatDetector::detect(bytes, None), Format::Pdf);
}

#[test]
fn detect_fallback_to_text() {
    let bytes = b"Just some plain text without any markers";
    assert_eq!(FormatDetector::detect(bytes, None), Format::Text);
}

// ── Text Filter ────────────────────────────────────────────────────────

#[test]
fn text_roundtrip() {
    let registry = FilterRegistry::default();
    let input = b"Hello\nWorld\n";
    let doc = registry.import(Format::Text, input).unwrap();

    assert_eq!(doc.doc_type, DocType::Document);
    if let DocBody::Document { nodes } = &doc.body {
        assert_eq!(nodes.len(), 2);
    } else {
        panic!("expected Document body");
    }

    let output = registry.export(&doc, Format::Text).unwrap();
    assert_eq!(String::from_utf8_lossy(&output), "Hello\nWorld\n");
}

// ── Markdown Filter ────────────────────────────────────────────────────

#[test]
fn markdown_import_headings() {
    let registry = FilterRegistry::default();
    let md = b"# Title\n\nSome paragraph\n\n## Subtitle\n";
    let doc = registry.import(Format::Markdown, md).unwrap();

    if let DocBody::Document { nodes } = &doc.body {
        assert!(nodes.len() >= 2, "expected at least heading + paragraph, got {}", nodes.len());
    } else {
        panic!("expected Document body");
    }
}

#[test]
fn markdown_export_produces_valid_md() {
    let registry = FilterRegistry::default();
    let doc = IntermediateDocument {
        doc_type: DocType::Document,
        metadata: DocMetadata::default(),
        body: DocBody::Document {
            nodes: vec![
                DocNode::Heading {
                    level: 1,
                    content: vec![InlineNode {
                        text: "Test".to_string(),
                        marks: InlineMarks::default(),
                    }],
                },
                DocNode::Paragraph {
                    content: vec![InlineNode {
                        text: "Hello world".to_string(),
                        marks: InlineMarks { bold: true, ..Default::default() },
                    }],
                    style: None,
                },
            ],
        },
    };

    let output = registry.export(&doc, Format::Markdown).unwrap();
    let md = String::from_utf8_lossy(&output);
    assert!(md.contains("# Test"), "missing heading: {md}");
    assert!(md.contains("**Hello world**"), "missing bold text: {md}");
}

// ── CSV Filter ─────────────────────────────────────────────────────────

#[test]
fn csv_roundtrip() {
    let registry = FilterRegistry::default();
    let csv = b"name,age\nAlice,30\nBob,25\n";
    let doc = registry.import(Format::Csv, csv).unwrap();

    assert_eq!(doc.doc_type, DocType::Spreadsheet);
    if let DocBody::Spreadsheet { sheets } = &doc.body {
        assert_eq!(sheets.len(), 1);
        assert_eq!(sheets[0].rows.len(), 3);
        assert_eq!(sheets[0].rows[0].cells.len(), 2);
    } else {
        panic!("expected Spreadsheet body");
    }

    let output = registry.export(&doc, Format::Csv).unwrap();
    let result = String::from_utf8_lossy(&output);
    assert!(result.contains("Alice"), "missing Alice: {result}");
    assert!(result.contains("30"), "missing 30: {result}");
}

// ── Registry ───────────────────────────────────────────────────────────

#[test]
fn registry_lists_supported_formats() {
    let registry = FilterRegistry::default();
    let formats = registry.supported_formats();
    assert!(formats.contains(&Format::Text));
    assert!(formats.contains(&Format::Markdown));
    assert!(formats.contains(&Format::Html));
    assert!(formats.contains(&Format::Csv));
    assert!(formats.contains(&Format::Docx));
    assert!(formats.contains(&Format::Xlsx));
}

#[test]
fn registry_rejects_unknown_format() {
    let registry = FilterRegistry::new(); // empty
    let result = registry.import(Format::Text, b"hello");
    assert!(result.is_err());
}

// ── HTML Filter ────────────────────────────────────────────────────────

#[test]
fn html_import_basic_elements() {
    let registry = FilterRegistry::default();
    let html = b"<h1>Title</h1><p>Paragraph with <strong>bold</strong></p>";
    let doc = registry.import(Format::Html, html).unwrap();

    if let DocBody::Document { nodes } = &doc.body {
        assert!(nodes.len() >= 2, "expected h1 + p, got {}", nodes.len());
    } else {
        panic!("expected Document body");
    }
}

#[test]
fn html_roundtrip_preserves_structure() {
    let registry = FilterRegistry::default();
    let html = b"<h1>Title</h1><p>Hello</p><ul><li>Item 1</li><li>Item 2</li></ul>";
    let doc = registry.import(Format::Html, html).unwrap();
    let output = registry.export(&doc, Format::Html).unwrap();
    let result = String::from_utf8_lossy(&output);
    assert!(result.contains("<h1>"), "missing h1: {result}");
    assert!(result.contains("Hello"), "missing text: {result}");
    assert!(result.contains("<ul>"), "missing list: {result}");
}
```

- [ ] **Step 2: Run tests**

Run: `rtk cargo test -p signapps-filters`
Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add crates/signapps-filters/tests/
git commit -m "test(filters): add pipeline integration tests for all text-based filters"
```

---

## Task 7: Wire signapps-docs to use signapps-filters

**Files:**
- Modify: `services/signapps-docs/Cargo.toml`
- Modify: `services/signapps-docs/src/office/mod.rs`

- [ ] **Step 1: Add dependency**

In `services/signapps-docs/Cargo.toml`, add:
```toml
signapps-filters = { path = "../../crates/signapps-filters" }
```

- [ ] **Step 2: Expose registry in OfficeState**

In `services/signapps-docs/src/office/mod.rs`, add the filter registry to `OfficeState`:

```rust
use signapps_filters::FilterRegistry;

pub struct OfficeState {
    pub converter: DocumentConverter,
    pub importer: DocumentImporter,
    pub cache: BinaryCacheService,
    pub jobs: JobStore,
    pub filters: FilterRegistry,  // NEW
}
```

Initialize it with `FilterRegistry::default()` wherever `OfficeState` is constructed.

- [ ] **Step 3: Verify compilation**

Run: `rtk cargo check -p signapps-docs`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add services/signapps-docs/Cargo.toml services/signapps-docs/src/office/mod.rs
git commit -m "feat(docs): wire signapps-filters crate into office service"
```

---

## Summary

| Task | Description | Files | Depends |
|------|-------------|-------|---------|
| 1 | Crate skeleton + errors | 4 | — |
| 2 | IntermediateDocument model | 1 | 1 |
| 3 | FilterTrait + Detector + Registry | 3 | 2 |
| 4 | Text + Markdown + HTML filters | 4 | 3 |
| 5 | CSV + DOCX + XLSX + ODS + PDF + PPTX filters | 6 | 4 |
| 6 | Unit tests | 1 | 5 |
| 7 | Wire into signapps-docs | 2 | 6 |
