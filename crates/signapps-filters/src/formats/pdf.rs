//! PDF filter — exports documents to PDF format.
//!
//! Import is not supported (PDF text extraction is lossy and complex).
//! Export uses `printpdf` to generate a basic PDF document with text content.

use printpdf::{BuiltinFont, Mm, PdfDocument};

use crate::error::{FilterError, FilterResult};
use crate::intermediate::{DocBody, DocNode, InlineNode, IntermediateDocument};
use crate::traits::FilterTrait;

/// Exports `IntermediateDocument` to PDF (export only).
///
/// Uses `printpdf` with the Helvetica built-in font. Headings use a larger
/// font size (18pt), paragraphs use 12pt. Complex nodes (lists, tables)
/// are rendered as plain text.
///
/// Import is not supported — PDF is a presentation format, not an
/// editable document format.
pub struct PdfFilter;

/// Default page width in mm (A4).
const PAGE_WIDTH_MM: f32 = 210.0;
/// Default page height in mm (A4).
const PAGE_HEIGHT_MM: f32 = 297.0;
/// Left margin in mm.
const MARGIN_LEFT_MM: f32 = 20.0;
/// Top margin in mm.
const MARGIN_TOP_MM: f32 = 20.0;
/// Right margin in mm.
const MARGIN_RIGHT_MM: f32 = 20.0;
/// Bottom margin in mm.
const MARGIN_BOTTOM_MM: f32 = 20.0;
/// Line spacing factor.
const LINE_SPACING: f32 = 1.4;

impl FilterTrait for PdfFilter {
    fn name(&self) -> &str {
        "PDF Filter"
    }

    fn mime_types(&self) -> &[&str] {
        &["application/pdf"]
    }

    fn extensions(&self) -> &[&str] {
        &["pdf"]
    }

    fn can_import(&self) -> bool {
        false
    }

    fn import(&self, _bytes: &[u8]) -> FilterResult<IntermediateDocument> {
        Err(FilterError::UnsupportedFormat(
            "PDF import is not supported".to_string(),
        ))
    }

    fn export(&self, doc: &IntermediateDocument) -> FilterResult<Vec<u8>> {
        let nodes = match &doc.body {
            DocBody::Document { nodes } => nodes,
            other => {
                return Err(FilterError::ExportFailed(format!(
                    "PdfFilter cannot export {:?} body",
                    std::mem::discriminant(other)
                )));
            },
        };

        let title = doc
            .metadata
            .title
            .as_deref()
            .unwrap_or("Untitled Document");

        let (pdf_doc, page1, layer1) = PdfDocument::new(
            title,
            Mm(PAGE_WIDTH_MM),
            Mm(PAGE_HEIGHT_MM),
            "Layer 1",
        );

        let font = pdf_doc
            .add_builtin_font(BuiltinFont::Helvetica)
            .map_err(|e| FilterError::ExportFailed(format!("font error: {e}")))?;

        let font_bold = pdf_doc
            .add_builtin_font(BuiltinFont::HelveticaBold)
            .map_err(|e| FilterError::ExportFailed(format!("font error: {e}")))?;

        let mut current_layer = pdf_doc.get_page(page1).get_layer(layer1);
        let mut y_pos = PAGE_HEIGHT_MM - MARGIN_TOP_MM;
        let usable_width = PAGE_WIDTH_MM - MARGIN_LEFT_MM - MARGIN_RIGHT_MM;

        // Approximate chars per line for word wrapping (Helvetica ~0.5mm per pt at 12pt)
        let chars_per_line_12pt = (usable_width / (12.0 * 0.35)) as usize;

        for node in nodes {
            let (text, font_size, is_heading) = match node {
                DocNode::Heading { level, content } => {
                    let size = match level {
                        1 => 24.0_f32,
                        2 => 20.0,
                        3 => 16.0,
                        _ => 14.0,
                    };
                    (inlines_to_text(content), size, true)
                },
                DocNode::Paragraph { content, .. } => (inlines_to_text(content), 12.0_f32, false),
                _ => (node_to_plain_text(node), 12.0_f32, false),
            };

            if text.trim().is_empty() {
                y_pos -= font_size * LINE_SPACING * 0.3528; // pt to mm
                continue;
            }

            // Scale chars per line for font size
            let chars_per_line = if (font_size - 12.0).abs() < f32::EPSILON {
                chars_per_line_12pt
            } else {
                ((usable_width / (font_size * 0.35)) as usize).max(20)
            };

            let wrapped_lines = wrap_text(&text, chars_per_line);

            for line in &wrapped_lines {
                let line_height_mm = font_size * LINE_SPACING * 0.3528;

                // Check if we need a new page
                if y_pos - line_height_mm < MARGIN_BOTTOM_MM {
                    let (new_page, new_layer) =
                        pdf_doc.add_page(Mm(PAGE_WIDTH_MM), Mm(PAGE_HEIGHT_MM), "Layer 1");
                    current_layer = pdf_doc.get_page(new_page).get_layer(new_layer);
                    y_pos = PAGE_HEIGHT_MM - MARGIN_TOP_MM;
                }

                let used_font = if is_heading { &font_bold } else { &font };
                current_layer.use_text(line, font_size, Mm(MARGIN_LEFT_MM), Mm(y_pos), used_font);
                y_pos -= line_height_mm;
            }

            // Add paragraph spacing
            y_pos -= font_size * 0.3528 * 0.5;
        }

        let bytes = pdf_doc.save_to_bytes().map_err(|e| {
            FilterError::ExportFailed(format!("PDF save failed: {e}"))
        })?;

        Ok(bytes)
    }

    fn export_mime_type(&self) -> &str {
        "application/pdf"
    }

    fn export_extension(&self) -> &str {
        "pdf"
    }
}

/// Concatenate inline node text.
fn inlines_to_text(inlines: &[InlineNode]) -> String {
    inlines.iter().map(|n| n.text.as_str()).collect()
}

/// Extract plain text from a non-paragraph `DocNode`.
fn node_to_plain_text(node: &DocNode) -> String {
    match node {
        DocNode::Paragraph { content, .. } | DocNode::Heading { content, .. } => {
            inlines_to_text(content)
        },
        DocNode::BulletList { items } => items
            .iter()
            .map(|item| {
                let text = item
                    .content
                    .iter()
                    .map(node_to_plain_text)
                    .collect::<Vec<_>>()
                    .join(" ");
                format!("  * {text}")
            })
            .collect::<Vec<_>>()
            .join("\n"),
        DocNode::OrderedList { items, start } => items
            .iter()
            .enumerate()
            .map(|(i, item)| {
                let num = *start as usize + i;
                let text = item
                    .content
                    .iter()
                    .map(node_to_plain_text)
                    .collect::<Vec<_>>()
                    .join(" ");
                format!("  {num}. {text}")
            })
            .collect::<Vec<_>>()
            .join("\n"),
        DocNode::TaskList { items } => items
            .iter()
            .map(|item| {
                let check = if item.checked { "[x]" } else { "[ ]" };
                let text = item
                    .content
                    .iter()
                    .map(node_to_plain_text)
                    .collect::<Vec<_>>()
                    .join(" ");
                format!("  {check} {text}")
            })
            .collect::<Vec<_>>()
            .join("\n"),
        DocNode::CodeBlock { code, .. } => code.clone(),
        DocNode::Blockquote { nodes } => nodes
            .iter()
            .map(|n| format!("> {}", node_to_plain_text(n)))
            .collect::<Vec<_>>()
            .join("\n"),
        DocNode::Table { rows } => rows
            .iter()
            .map(|row| {
                row.cells
                    .iter()
                    .map(|cell| {
                        cell.content
                            .iter()
                            .map(node_to_plain_text)
                            .collect::<Vec<_>>()
                            .join(" ")
                    })
                    .collect::<Vec<_>>()
                    .join(" | ")
            })
            .collect::<Vec<_>>()
            .join("\n"),
        DocNode::Image { alt, src, .. } => {
            format!("[Image: {}]", alt.as_deref().unwrap_or(src))
        },
        DocNode::HorizontalRule => "---".to_string(),
        DocNode::PageBreak => String::new(),
    }
}

/// Simple word-wrapping by character count.
fn wrap_text(text: &str, max_chars: usize) -> Vec<String> {
    if max_chars == 0 {
        return vec![text.to_string()];
    }

    let mut lines = Vec::new();

    for input_line in text.lines() {
        if input_line.len() <= max_chars {
            lines.push(input_line.to_string());
            continue;
        }

        let words: Vec<&str> = input_line.split_whitespace().collect();
        let mut current_line = String::new();

        for word in words {
            if current_line.is_empty() {
                current_line = word.to_string();
            } else if current_line.len() + 1 + word.len() <= max_chars {
                current_line.push(' ');
                current_line.push_str(word);
            } else {
                lines.push(current_line);
                current_line = word.to_string();
            }
        }

        if !current_line.is_empty() {
            lines.push(current_line);
        }
    }

    if lines.is_empty() {
        lines.push(String::new());
    }

    lines
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::intermediate::{DocMetadata, DocType, InlineMarks};

    #[test]
    fn import_returns_unsupported() {
        let filter = PdfFilter;
        assert!(!filter.can_import());
        let result = filter.import(b"fake pdf data");
        assert!(result.is_err());
    }

    #[test]
    fn export_basic_document() {
        let doc = IntermediateDocument {
            doc_type: DocType::Document,
            metadata: DocMetadata {
                title: Some("Test PDF".to_string()),
                ..DocMetadata::default()
            },
            body: DocBody::Document {
                nodes: vec![
                    DocNode::Heading {
                        level: 1,
                        content: vec![InlineNode {
                            text: "Hello World".to_string(),
                            marks: InlineMarks::default(),
                        }],
                    },
                    DocNode::Paragraph {
                        content: vec![InlineNode {
                            text: "This is a test paragraph.".to_string(),
                            marks: InlineMarks::default(),
                        }],
                        style: None,
                    },
                ],
            },
        };

        let filter = PdfFilter;
        let bytes = filter.export(&doc).expect("export failed");

        // Should start with %PDF
        let header = String::from_utf8_lossy(&bytes[..5]);
        assert!(header.starts_with("%PDF"), "Expected PDF header, got: {header}");
    }

    #[test]
    fn wrap_text_basic() {
        let lines = wrap_text("hello world foo bar baz", 11);
        assert_eq!(lines, vec!["hello world", "foo bar baz"]);
    }

    #[test]
    fn wrap_text_no_wrap_needed() {
        let lines = wrap_text("short", 100);
        assert_eq!(lines, vec!["short"]);
    }
}
