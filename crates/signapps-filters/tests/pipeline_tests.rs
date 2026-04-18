//! Integration tests for the signapps-filters pipeline.
//!
//! Verifies full end-to-end roundtrips through the filter registry.

use signapps_filters::detector::{Format, FormatDetector};
use signapps_filters::registry::FilterRegistry;
use signapps_filters::*;

#[test]
fn text_roundtrip() {
    let registry = FilterRegistry::default();
    let input = b"Hello\nWorld\n";
    let doc = registry.import(Format::Text, input).unwrap();
    assert_eq!(doc.doc_type, DocType::Document);
    let output = registry.export(&doc, Format::Text).unwrap();
    let text = String::from_utf8_lossy(&output);
    assert!(text.contains("Hello"));
    assert!(text.contains("World"));
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
                        marks: InlineMarks {
                            bold: true,
                            ..Default::default()
                        },
                    }],
                    style: None,
                },
            ],
        },
    };
    let output = registry.export(&doc, Format::Markdown).unwrap();
    let md = String::from_utf8_lossy(&output);
    assert!(md.contains("# Test"), "missing heading: {md}");
    assert!(md.contains("**Hello world**"), "missing bold: {md}");
}

#[test]
fn csv_roundtrip() {
    let registry = FilterRegistry::default();
    let csv = b"name,age\nAlice,30\nBob,25\n";
    let doc = registry.import(Format::Csv, csv).unwrap();
    assert_eq!(doc.doc_type, DocType::Spreadsheet);
    let output = registry.export(&doc, Format::Csv).unwrap();
    let result = String::from_utf8_lossy(&output);
    assert!(result.contains("Alice"));
    assert!(result.contains("30"));
}

#[test]
fn html_roundtrip() {
    let registry = FilterRegistry::default();
    let html = b"<h1>Title</h1><p>Hello</p>";
    let doc = registry.import(Format::Html, html).unwrap();
    let output = registry.export(&doc, Format::Html).unwrap();
    let result = String::from_utf8_lossy(&output);
    assert!(result.contains("<h1>"));
    assert!(result.contains("Hello"));
}

#[test]
fn detect_format_by_extension() {
    assert_eq!(
        FormatDetector::detect(b"anything", Some("report.docx")),
        Format::Docx
    );
    assert_eq!(
        FormatDetector::detect(b"anything", Some("data.csv")),
        Format::Csv
    );
    assert_eq!(
        FormatDetector::detect(b"anything", Some("slides.pptx")),
        Format::Pptx
    );
}

#[test]
fn detect_format_by_content() {
    assert_eq!(
        FormatDetector::detect(b"# Hello\n## World", None),
        Format::Markdown
    );
    assert_eq!(
        FormatDetector::detect(b"<!DOCTYPE html><html>", None),
        Format::Html
    );
    assert_eq!(
        FormatDetector::detect(b"%PDF-1.4 content", None),
        Format::Pdf
    );
}

#[test]
fn registry_lists_all_formats() {
    let registry = FilterRegistry::default();
    let formats = registry.supported_formats();
    assert!(
        formats.len() >= 9,
        "expected at least 9 formats, got {}",
        formats.len()
    );
}

#[test]
fn registry_rejects_empty() {
    let registry = FilterRegistry::new();
    assert!(registry.import(Format::Text, b"hello").is_err());
}
