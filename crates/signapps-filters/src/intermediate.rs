//! Intermediate document model used as the pivot format between all filters.
//!
//! Every filter converts to/from this model. The model is a typed node tree
//! covering documents, spreadsheets, and presentations.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

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
    Document {
        nodes: Vec<DocNode>,
    },
    Spreadsheet {
        sheets: Vec<SheetData>,
    },
    Presentation {
        slides: Vec<SlideData>,
        master: Option<MasterData>,
    },
}

// ============================================================================
// Document nodes (Writer-like)
// ============================================================================

/// A block-level node in a document.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DocNode {
    Paragraph {
        content: Vec<InlineNode>,
        style: Option<String>,
    },
    Heading {
        level: u8,
        content: Vec<InlineNode>,
    },
    BulletList {
        items: Vec<ListItem>,
    },
    OrderedList {
        items: Vec<ListItem>,
        start: u32,
    },
    TaskList {
        items: Vec<TaskItem>,
    },
    Blockquote {
        nodes: Vec<DocNode>,
    },
    CodeBlock {
        language: Option<String>,
        code: String,
    },
    Table {
        rows: Vec<TableRow>,
    },
    Image {
        src: String,
        alt: Option<String>,
        width: Option<u32>,
        height: Option<u32>,
    },
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
    Title {
        text: String,
    },
    Subtitle {
        text: String,
    },
    TextBlock {
        content: Vec<DocNode>,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
    },
    Image {
        src: String,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
    },
    Shape {
        shape_type: String,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
    },
}

/// Master slide data (branding defaults).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MasterData {
    pub background_color: Option<String>,
    pub font_family: Option<String>,
    pub accent_color: Option<String>,
}
