//! DOCX filter — imports/exports Microsoft Word documents.
//!
//! Import reads the ZIP archive and parses `word/document.xml` for paragraphs
//! and basic inline formatting (bold, italic).
//! Export uses the `docx-rs` crate to build a valid DOCX file.

use std::io::{Cursor, Read};

use crate::error::{FilterError, FilterResult};
use crate::intermediate::{
    DocBody, DocMetadata, DocNode, DocType, InlineMarks, InlineNode, IntermediateDocument,
};
use crate::traits::FilterTrait;

/// Converts DOCX files to/from `IntermediateDocument`.
///
/// Import extracts text and basic formatting from `word/document.xml`.
/// Export builds a DOCX using `docx-rs`, mapping headings and paragraphs.
pub struct DocxFilter;

impl FilterTrait for DocxFilter {
    fn name(&self) -> &str {
        "DOCX Filter"
    }

    fn mime_types(&self) -> &[&str] {
        &["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
    }

    fn extensions(&self) -> &[&str] {
        &["docx"]
    }

    fn import(&self, bytes: &[u8]) -> FilterResult<IntermediateDocument> {
        let cursor = Cursor::new(bytes);
        let mut archive = zip::ZipArchive::new(cursor)
            .map_err(|e| FilterError::ImportFailed(format!("invalid ZIP archive: {e}")))?;

        let xml = read_zip_entry(&mut archive, "word/document.xml")?;
        let nodes = parse_document_xml(&xml);

        Ok(IntermediateDocument {
            doc_type: DocType::Document,
            metadata: DocMetadata::default(),
            body: DocBody::Document { nodes },
        })
    }

    fn export(&self, doc: &IntermediateDocument) -> FilterResult<Vec<u8>> {
        let nodes = match &doc.body {
            DocBody::Document { nodes } => nodes,
            other => {
                return Err(FilterError::ExportFailed(format!(
                    "DocxFilter cannot export {:?} body",
                    std::mem::discriminant(other)
                )));
            },
        };

        let mut docx = docx_rs::Docx::new();

        for node in nodes {
            let paragraph = node_to_docx_paragraph(node);
            docx = docx.add_paragraph(paragraph);
        }

        let mut buffer = Cursor::new(Vec::new());
        docx.build()
            .pack(&mut buffer)
            .map_err(|e| FilterError::ExportFailed(format!("DOCX pack failed: {e}")))?;

        Ok(buffer.into_inner())
    }

    fn export_mime_type(&self) -> &str {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    }

    fn export_extension(&self) -> &str {
        "docx"
    }
}

/// Read a file entry from a ZIP archive.
fn read_zip_entry(
    archive: &mut zip::ZipArchive<Cursor<&[u8]>>,
    name: &str,
) -> FilterResult<String> {
    let mut file = archive
        .by_name(name)
        .map_err(|e| FilterError::ImportFailed(format!("missing {name} in DOCX: {e}")))?;
    let mut content = String::new();
    file.read_to_string(&mut content)
        .map_err(|e| FilterError::ImportFailed(format!("cannot read {name}: {e}")))?;
    Ok(content)
}

// ===========================================================================
// Import: XML parsing (minimal, no full XML parser dependency)
// ===========================================================================

/// Parse `word/document.xml` content into `DocNode` items.
///
/// This is a lightweight parser that handles `<w:p>` (paragraphs) containing
/// `<w:r>` (runs) with `<w:t>` (text) and basic formatting (`<w:b/>`, `<w:i/>`).
fn parse_document_xml(xml: &str) -> Vec<DocNode> {
    let mut nodes = Vec::new();

    // Split by paragraph tags
    let mut pos = 0;
    while let Some(p_start) = xml[pos..].find("<w:p ").or_else(|| xml[pos..].find("<w:p>")) {
        let abs_start = pos + p_start;
        if let Some(p_end) = xml[abs_start..].find("</w:p>") {
            let abs_end = abs_start + p_end + "</w:p>".len();
            let paragraph_xml = &xml[abs_start..abs_end];
            if let Some(node) = parse_paragraph(paragraph_xml) {
                nodes.push(node);
            }
            pos = abs_end;
        } else {
            break;
        }
    }

    // If no paragraphs found, create a single paragraph with all text
    if nodes.is_empty() {
        let text = extract_all_text(xml);
        if !text.is_empty() {
            nodes.push(DocNode::Paragraph {
                content: vec![InlineNode {
                    text,
                    marks: InlineMarks::default(),
                }],
                style: None,
            });
        }
    }

    nodes
}

/// Parse a single `<w:p>...</w:p>` element.
fn parse_paragraph(para_xml: &str) -> Option<DocNode> {
    // Check for heading style in <w:pPr><w:pStyle w:val="Heading1"/>
    let heading_level = detect_heading_level(para_xml);

    // Extract runs
    let inlines = parse_runs(para_xml);

    if inlines.is_empty() {
        return None;
    }

    if let Some(level) = heading_level {
        Some(DocNode::Heading {
            level,
            content: inlines,
        })
    } else {
        Some(DocNode::Paragraph {
            content: inlines,
            style: None,
        })
    }
}

/// Detect heading level from paragraph properties.
fn detect_heading_level(para_xml: &str) -> Option<u8> {
    // Look for <w:pStyle w:val="HeadingN"/> or <w:pStyle w:val="TitleN"/>
    if let Some(style_pos) = para_xml.find("<w:pStyle") {
        let rest = &para_xml[style_pos..];
        if let Some(val_pos) = rest.find("w:val=\"") {
            let val_start = val_pos + "w:val=\"".len();
            if let Some(val_end) = rest[val_start..].find('"') {
                let style_val = &rest[val_start..val_start + val_end];
                let lower = style_val.to_lowercase();

                // "heading1" through "heading9"
                if lower.starts_with("heading") {
                    if let Ok(n) = lower.trim_start_matches("heading").parse::<u8>() {
                        return Some(n.clamp(1, 6));
                    }
                }
                // "title" is treated as h1
                if lower == "title" {
                    return Some(1);
                }
            }
        }
    }

    // Also check <w:outlineLvl w:val="N"/>
    if let Some(lvl_pos) = para_xml.find("<w:outlineLvl") {
        let rest = &para_xml[lvl_pos..];
        if let Some(val_pos) = rest.find("w:val=\"") {
            let val_start = val_pos + "w:val=\"".len();
            if let Some(val_end) = rest[val_start..].find('"') {
                let val = &rest[val_start..val_start + val_end];
                if let Ok(n) = val.parse::<u8>() {
                    return Some((n + 1).clamp(1, 6));
                }
            }
        }
    }

    None
}

/// Parse all `<w:r>` runs within a paragraph.
fn parse_runs(para_xml: &str) -> Vec<InlineNode> {
    let mut inlines = Vec::new();
    let mut pos = 0;

    while let Some(r_start) = para_xml[pos..].find("<w:r ").or_else(|| para_xml[pos..].find("<w:r>"))
    {
        let abs_start = pos + r_start;
        if let Some(r_end) = para_xml[abs_start..].find("</w:r>") {
            let abs_end = abs_start + r_end + "</w:r>".len();
            let run_xml = &para_xml[abs_start..abs_end];

            let text = extract_run_text(run_xml);
            if !text.is_empty() {
                let marks = InlineMarks {
                    bold: run_xml.contains("<w:b/>") || run_xml.contains("<w:b "),
                    italic: run_xml.contains("<w:i/>") || run_xml.contains("<w:i "),
                    underline: run_xml.contains("<w:u "),
                    strikethrough: run_xml.contains("<w:strike"),
                    ..InlineMarks::default()
                };
                inlines.push(InlineNode { text, marks });
            }
            pos = abs_end;
        } else {
            break;
        }
    }

    inlines
}

/// Extract text content from `<w:t>` tags within a run.
fn extract_run_text(run_xml: &str) -> String {
    let mut text = String::new();
    let mut pos = 0;

    while let Some(t_start) = run_xml[pos..]
        .find("<w:t>")
        .or_else(|| run_xml[pos..].find("<w:t "))
    {
        let abs_start = pos + t_start;
        // Find the end of the opening tag
        if let Some(tag_end) = run_xml[abs_start..].find('>') {
            let content_start = abs_start + tag_end + 1;
            if let Some(t_end) = run_xml[content_start..].find("</w:t>") {
                text.push_str(&run_xml[content_start..content_start + t_end]);
                pos = content_start + t_end + "</w:t>".len();
            } else {
                break;
            }
        } else {
            break;
        }
    }

    text
}

/// Extract all text from any `<w:t>` tags in the XML (fallback).
fn extract_all_text(xml: &str) -> String {
    let mut text = String::new();
    let mut pos = 0;

    while let Some(t_start) = xml[pos..]
        .find("<w:t>")
        .or_else(|| xml[pos..].find("<w:t "))
    {
        let abs_start = pos + t_start;
        if let Some(tag_end) = xml[abs_start..].find('>') {
            let content_start = abs_start + tag_end + 1;
            if let Some(t_end) = xml[content_start..].find("</w:t>") {
                if !text.is_empty() {
                    text.push(' ');
                }
                text.push_str(&xml[content_start..content_start + t_end]);
                pos = content_start + t_end + "</w:t>".len();
            } else {
                break;
            }
        } else {
            break;
        }
    }

    text
}

// ===========================================================================
// Export: docx-rs builders
// ===========================================================================

/// Convert a `DocNode` to a `docx_rs::Paragraph`.
fn node_to_docx_paragraph(node: &DocNode) -> docx_rs::Paragraph {
    match node {
        DocNode::Heading { level, content } => {
            let style = format!("Heading{level}");
            let mut para = docx_rs::Paragraph::new().style(&style);
            for inline in content {
                para = para.add_run(inline_to_docx_run(inline));
            }
            para
        },
        DocNode::Paragraph { content, .. } => {
            let mut para = docx_rs::Paragraph::new();
            for inline in content {
                para = para.add_run(inline_to_docx_run(inline));
            }
            para
        },
        // Non-paragraph nodes render as plain text paragraphs
        _ => {
            let text = node_to_plain_text(node);
            let run = docx_rs::Run::new().add_text(&text);
            docx_rs::Paragraph::new().add_run(run)
        },
    }
}

/// Convert an `InlineNode` to a `docx_rs::Run`.
fn inline_to_docx_run(inline: &InlineNode) -> docx_rs::Run {
    let mut run = docx_rs::Run::new().add_text(&inline.text);
    if inline.marks.bold {
        run = run.bold();
    }
    if inline.marks.italic {
        run = run.italic();
    }
    run
}

/// Extract plain text from a `DocNode` (for non-paragraph nodes in DOCX export).
fn node_to_plain_text(node: &DocNode) -> String {
    match node {
        DocNode::Paragraph { content, .. } | DocNode::Heading { content, .. } => {
            content.iter().map(|n| n.text.as_str()).collect()
        },
        DocNode::BulletList { items } => items
            .iter()
            .map(|item| {
                item.content
                    .iter()
                    .map(node_to_plain_text)
                    .collect::<Vec<_>>()
                    .join(" ")
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
                format!("{num}. {text}")
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
                format!("{check} {text}")
            })
            .collect::<Vec<_>>()
            .join("\n"),
        DocNode::CodeBlock { code, .. } => code.clone(),
        DocNode::Blockquote { nodes } => nodes
            .iter()
            .map(node_to_plain_text)
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
                    .join("\t")
            })
            .collect::<Vec<_>>()
            .join("\n"),
        DocNode::Image { alt, src, .. } => alt.as_deref().unwrap_or(src).to_string(),
        DocNode::HorizontalRule => "---".to_string(),
        DocNode::PageBreak => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn export_and_reimport_roundtrip() {
        let doc = IntermediateDocument {
            doc_type: DocType::Document,
            metadata: DocMetadata::default(),
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

        let filter = DocxFilter;
        let bytes = filter.export(&doc).expect("export failed");

        // Verify it's a valid ZIP/DOCX
        assert!(bytes.len() > 100);
        assert_eq!(&bytes[0..2], b"PK");

        // Re-import
        let reimported = filter.import(&bytes).expect("reimport failed");
        assert_eq!(reimported.doc_type, DocType::Document);
        if let DocBody::Document { nodes } = &reimported.body {
            // Should have at least the text content
            assert!(!nodes.is_empty());
        } else {
            panic!("expected Document body after reimport");
        }
    }

    #[test]
    fn parse_runs_basic() {
        let xml = r#"<w:r><w:rPr><w:b/></w:rPr><w:t>Bold text</w:t></w:r>"#;
        let inlines = parse_runs(xml);
        assert_eq!(inlines.len(), 1);
        assert_eq!(inlines[0].text, "Bold text");
        assert!(inlines[0].marks.bold);
    }

    #[test]
    fn detect_heading() {
        let xml = r#"<w:pPr><w:pStyle w:val="Heading2"/></w:pPr>"#;
        assert_eq!(detect_heading_level(xml), Some(2));

        let xml_no_heading = r#"<w:pPr><w:jc w:val="center"/></w:pPr>"#;
        assert_eq!(detect_heading_level(xml_no_heading), None);
    }
}
