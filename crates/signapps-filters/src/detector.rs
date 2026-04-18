//! Format detection from file bytes and metadata.
//!
//! Uses a 4-stage detection pipeline:
//! 1. Magic bytes (ZIP signature, PDF header)
//! 2. File extension mapping
//! 3. Content heuristics (HTML tags, Markdown markers, CSV patterns)
//! 4. Fallback to plain text

use serde::{Deserialize, Serialize};
use std::io::{Cursor, Read};

/// Known document formats supported by the filter pipeline.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Format {
    /// Microsoft Word (.docx)
    Docx,
    /// Microsoft Excel (.xlsx)
    Xlsx,
    /// Microsoft PowerPoint (.pptx)
    Pptx,
    /// OpenDocument Text (.odt)
    Odt,
    /// OpenDocument Spreadsheet (.ods)
    Ods,
    /// OpenDocument Presentation (.odp)
    Odp,
    /// Portable Document Format (.pdf)
    Pdf,
    /// Comma-Separated Values (.csv)
    Csv,
    /// Markdown (.md)
    Markdown,
    /// HyperText Markup Language (.html)
    Html,
    /// Plain text (.txt)
    Text,
}

impl Format {
    /// Returns the canonical file extension for this format (without dot).
    pub fn extension(&self) -> &str {
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

    /// Returns the primary MIME type for this format.
    pub fn mime_type(&self) -> &str {
        match self {
            Self::Docx => {
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            }
            Self::Xlsx => {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }
            Self::Pptx => {
                "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            }
            Self::Odt => "application/vnd.oasis.opendocument.text",
            Self::Ods => "application/vnd.oasis.opendocument.spreadsheet",
            Self::Odp => "application/vnd.oasis.opendocument.presentation",
            Self::Pdf => "application/pdf",
            Self::Csv => "text/csv",
            Self::Markdown => "text/markdown",
            Self::Html => "text/html",
            Self::Text => "text/plain",
        }
    }
}

/// Detects the format of a document from its bytes and optional filename.
pub struct FormatDetector;

impl FormatDetector {
    /// Detect the format using a 4-stage pipeline:
    /// magic bytes -> extension -> content heuristics -> fallback Text.
    pub fn detect(bytes: &[u8], filename: Option<&str>) -> Format {
        // Stage 1: magic bytes
        if let Some(fmt) = Self::detect_magic(bytes) {
            return fmt;
        }

        // Stage 2: file extension
        if let Some(name) = filename {
            if let Some(fmt) = Self::detect_extension(name) {
                return fmt;
            }
        }

        // Stage 3: content heuristics
        if let Some(fmt) = Self::detect_content(bytes) {
            return fmt;
        }

        // Stage 4: fallback
        Format::Text
    }

    /// Detect format from magic bytes.
    fn detect_magic(bytes: &[u8]) -> Option<Format> {
        if bytes.len() < 4 {
            return None;
        }

        // ZIP signature: PK\x03\x04
        if bytes[0] == 0x50 && bytes[1] == 0x4B && bytes[2] == 0x03 && bytes[3] == 0x04 {
            return Self::detect_zip_contents(bytes);
        }

        // PDF signature: %PDF
        if bytes.starts_with(b"%PDF") {
            return Some(Format::Pdf);
        }

        None
    }

    /// Inspect ZIP archive contents to distinguish OOXML and ODF formats.
    fn detect_zip_contents(bytes: &[u8]) -> Option<Format> {
        let cursor = Cursor::new(bytes);
        let mut archive = zip::ZipArchive::new(cursor).ok()?;

        // Check for OOXML content types
        for i in 0..archive.len() {
            let file = archive.by_index(i).ok()?;
            let name = file.name().to_lowercase();

            if name == "word/document.xml" {
                return Some(Format::Docx);
            }
            if name == "xl/workbook.xml" {
                return Some(Format::Xlsx);
            }
            if name == "ppt/presentation.xml" {
                return Some(Format::Pptx);
            }
        }

        // Check ODF mimetype file
        if let Ok(mut mimetype_file) = archive.by_name("mimetype") {
            let mut mimetype = String::new();
            if mimetype_file.read_to_string(&mut mimetype).is_ok() {
                let mimetype = mimetype.trim();
                match mimetype {
                    "application/vnd.oasis.opendocument.text" => return Some(Format::Odt),
                    "application/vnd.oasis.opendocument.spreadsheet" => {
                        return Some(Format::Ods)
                    }
                    "application/vnd.oasis.opendocument.presentation" => {
                        return Some(Format::Odp)
                    }
                    _ => {}
                }
            }
        }

        None
    }

    /// Detect format from file extension.
    fn detect_extension(filename: &str) -> Option<Format> {
        let ext = filename.rsplit('.').next()?.to_lowercase();
        match ext.as_str() {
            "docx" => Some(Format::Docx),
            "xlsx" => Some(Format::Xlsx),
            "pptx" => Some(Format::Pptx),
            "odt" => Some(Format::Odt),
            "ods" => Some(Format::Ods),
            "odp" => Some(Format::Odp),
            "pdf" => Some(Format::Pdf),
            "csv" | "tsv" => Some(Format::Csv),
            "md" | "markdown" => Some(Format::Markdown),
            "html" | "htm" | "xhtml" => Some(Format::Html),
            "txt" | "text" => Some(Format::Text),
            _ => None,
        }
    }

    /// Detect format from content heuristics (for text-based formats).
    fn detect_content(bytes: &[u8]) -> Option<Format> {
        // Only inspect text content (skip binary data)
        let text = std::str::from_utf8(bytes).ok()?;
        let trimmed = text.trim();

        // HTML detection: look for common HTML markers
        if Self::looks_like_html(trimmed) {
            return Some(Format::Html);
        }

        // Markdown detection: look for common Markdown markers
        if Self::looks_like_markdown(trimmed) {
            return Some(Format::Markdown);
        }

        // CSV detection: consistent delimiter pattern
        if Self::looks_like_csv(trimmed) {
            return Some(Format::Csv);
        }

        None
    }

    /// Check if text looks like HTML.
    fn looks_like_html(text: &str) -> bool {
        let lower = text.to_lowercase();
        lower.starts_with("<!doctype")
            || lower.starts_with("<html")
            || lower.contains("<body")
            || lower.contains("<head")
            || (lower.contains("<div") && lower.contains("</div>"))
    }

    /// Check if text looks like Markdown.
    fn looks_like_markdown(text: &str) -> bool {
        let lines: Vec<&str> = text.lines().take(20).collect();
        let mut score = 0u32;

        for line in &lines {
            let trimmed = line.trim();
            // Headings
            if trimmed.starts_with("# ") || trimmed.starts_with("## ") {
                score += 2;
            }
            // Code fences
            if trimmed.starts_with("```") {
                score += 2;
            }
            // Lists with markers
            if trimmed.starts_with("- ") || trimmed.starts_with("* ") {
                score += 1;
            }
            // Links [text](url)
            if trimmed.contains("](") {
                score += 1;
            }
            // Bold/italic
            if trimmed.contains("**") || trimmed.contains("__") {
                score += 1;
            }
        }

        score >= 3
    }

    /// Check if text looks like CSV (consistent delimiter count across lines).
    fn looks_like_csv(text: &str) -> bool {
        let lines: Vec<&str> = text.lines().take(10).collect();
        if lines.len() < 2 {
            return false;
        }

        // Try comma delimiter
        if Self::consistent_delimiter(&lines, ',') {
            return true;
        }

        // Try semicolon delimiter
        if Self::consistent_delimiter(&lines, ';') {
            return true;
        }

        // Try tab delimiter
        if Self::consistent_delimiter(&lines, '\t') {
            return true;
        }

        false
    }

    /// Check if a delimiter appears consistently across lines.
    fn consistent_delimiter(lines: &[&str], delimiter: char) -> bool {
        let counts: Vec<usize> = lines
            .iter()
            .filter(|l| !l.trim().is_empty())
            .map(|l| l.matches(delimiter).count())
            .collect();

        if counts.is_empty() {
            return false;
        }

        let first = counts[0];
        // Need at least one delimiter per line, and consistent count
        first > 0 && counts.iter().all(|&c| c == first)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_pdf_magic() {
        let bytes = b"%PDF-1.4 some content";
        assert_eq!(FormatDetector::detect(bytes, None), Format::Pdf);
    }

    #[test]
    fn detect_by_extension() {
        assert_eq!(
            FormatDetector::detect(b"hello", Some("report.docx")),
            Format::Docx
        );
        assert_eq!(
            FormatDetector::detect(b"hello", Some("data.xlsx")),
            Format::Xlsx
        );
        assert_eq!(
            FormatDetector::detect(b"hello", Some("slides.pptx")),
            Format::Pptx
        );
        assert_eq!(
            FormatDetector::detect(b"hello", Some("readme.md")),
            Format::Markdown
        );
        assert_eq!(
            FormatDetector::detect(b"hello", Some("page.html")),
            Format::Html
        );
        assert_eq!(
            FormatDetector::detect(b"hello", Some("notes.txt")),
            Format::Text
        );
    }

    #[test]
    fn detect_html_content() {
        let html = b"<!DOCTYPE html><html><body>Hello</body></html>";
        assert_eq!(FormatDetector::detect(html, None), Format::Html);
    }

    #[test]
    fn detect_markdown_content() {
        let md = b"# Title\n\n## Section\n\n- item 1\n- item 2\n\n```rust\nfn main() {}\n```\n";
        assert_eq!(FormatDetector::detect(md, None), Format::Markdown);
    }

    #[test]
    fn detect_csv_content() {
        let csv = b"name,age,city\nAlice,30,Paris\nBob,25,Lyon\n";
        assert_eq!(FormatDetector::detect(csv, None), Format::Csv);
    }

    #[test]
    fn fallback_to_text() {
        let plain = b"Just some plain text without any markers.";
        assert_eq!(FormatDetector::detect(plain, None), Format::Text);
    }

    #[test]
    fn format_extension() {
        assert_eq!(Format::Docx.extension(), "docx");
        assert_eq!(Format::Pdf.extension(), "pdf");
        assert_eq!(Format::Markdown.extension(), "md");
    }

    #[test]
    fn format_mime_type() {
        assert_eq!(Format::Pdf.mime_type(), "application/pdf");
        assert_eq!(Format::Html.mime_type(), "text/html");
        assert_eq!(Format::Csv.mime_type(), "text/csv");
    }
}
