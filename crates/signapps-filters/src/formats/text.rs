//! Plain text filter — imports/exports plain text as paragraphs.

use crate::error::{FilterError, FilterResult};
use crate::intermediate::{
    DocBody, DocMetadata, DocNode, DocType, InlineMarks, InlineNode, IntermediateDocument,
};
use crate::traits::FilterTrait;

/// Converts plain text to/from `IntermediateDocument`.
///
/// Each line of text becomes a `DocNode::Paragraph` with a single `InlineNode`.
/// Empty lines are preserved as empty paragraphs.
pub struct TextFilter;

impl FilterTrait for TextFilter {
    fn name(&self) -> &str {
        "Plain Text Filter"
    }

    fn mime_types(&self) -> &[&str] {
        &["text/plain"]
    }

    fn extensions(&self) -> &[&str] {
        &["txt", "text", "log"]
    }

    fn import(&self, bytes: &[u8]) -> FilterResult<IntermediateDocument> {
        let text = std::str::from_utf8(bytes)
            .map_err(|e| FilterError::ImportFailed(format!("invalid UTF-8: {e}")))?;

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

        // If input is empty, produce a single empty paragraph
        let nodes = if nodes.is_empty() {
            vec![DocNode::Paragraph {
                content: vec![InlineNode {
                    text: String::new(),
                    marks: InlineMarks::default(),
                }],
                style: None,
            }]
        } else {
            nodes
        };

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
                    "TextFilter cannot export {:?} body",
                    std::mem::discriminant(other)
                )));
            },
        };

        let mut lines = Vec::with_capacity(nodes.len());
        for node in nodes {
            lines.push(node_to_text(node));
        }

        Ok(lines.join("\n").into_bytes())
    }

    fn export_mime_type(&self) -> &str {
        "text/plain"
    }

    fn export_extension(&self) -> &str {
        "txt"
    }
}

/// Extract plain text from a `DocNode` recursively.
fn node_to_text(node: &DocNode) -> String {
    match node {
        DocNode::Paragraph { content, .. } | DocNode::Heading { content, .. } => {
            inlines_to_text(content)
        },
        DocNode::BulletList { items } => items
            .iter()
            .map(|item| {
                item.content
                    .iter()
                    .map(node_to_text)
                    .collect::<Vec<_>>()
                    .join("\n")
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
                    .map(node_to_text)
                    .collect::<Vec<_>>()
                    .join("\n");
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
                    .map(node_to_text)
                    .collect::<Vec<_>>()
                    .join("\n");
                format!("{check} {text}")
            })
            .collect::<Vec<_>>()
            .join("\n"),
        DocNode::CodeBlock { code, .. } => code.clone(),
        DocNode::Blockquote { nodes } => nodes
            .iter()
            .map(node_to_text)
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
                            .map(node_to_text)
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

/// Concatenate inline node text (ignoring marks for plain text).
fn inlines_to_text(inlines: &[InlineNode]) -> String {
    inlines.iter().map(|n| n.text.as_str()).collect()
}
