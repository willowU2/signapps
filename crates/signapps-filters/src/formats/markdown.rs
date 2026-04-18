//! Markdown filter (GFM) — imports/exports Markdown via `IntermediateDocument`.
//!
//! Import converts Markdown to HTML using `comrak`, then delegates to `HtmlFilter`.
//! Export walks the `DocNode` tree and produces GFM-compatible Markdown.

use comrak::{markdown_to_html, Options};

use crate::error::{FilterError, FilterResult};
use crate::formats::html::HtmlFilter;
use crate::intermediate::{DocBody, DocNode, InlineNode, IntermediateDocument};
use crate::traits::FilterTrait;

/// Converts Markdown (GitHub Flavored) to/from `IntermediateDocument`.
///
/// Import pipeline: Markdown --comrak--> HTML --HtmlFilter--> IntermediateDocument.
/// Export pipeline: IntermediateDocument --> Markdown string.
pub struct MarkdownFilter;

impl FilterTrait for MarkdownFilter {
    fn name(&self) -> &str {
        "Markdown Filter (GFM)"
    }

    fn mime_types(&self) -> &[&str] {
        &["text/markdown"]
    }

    fn extensions(&self) -> &[&str] {
        &["md", "markdown"]
    }

    fn import(&self, bytes: &[u8]) -> FilterResult<IntermediateDocument> {
        let text = std::str::from_utf8(bytes)
            .map_err(|e| FilterError::ImportFailed(format!("invalid UTF-8: {e}")))?;

        let mut options = Options::default();
        options.extension.strikethrough = true;
        options.extension.table = true;
        options.extension.tasklist = true;
        options.extension.autolink = true;

        let html = markdown_to_html(text, &options);

        // Delegate HTML parsing to HtmlFilter
        let html_filter = HtmlFilter;
        html_filter.import(html.as_bytes())
    }

    fn export(&self, doc: &IntermediateDocument) -> FilterResult<Vec<u8>> {
        let nodes = match &doc.body {
            DocBody::Document { nodes } => nodes,
            other => {
                return Err(FilterError::ExportFailed(format!(
                    "MarkdownFilter cannot export {:?} body",
                    std::mem::discriminant(other)
                )));
            },
        };

        let mut buf = String::new();
        for (i, node) in nodes.iter().enumerate() {
            node_to_md(node, &mut buf);
            // Separate top-level blocks with blank lines
            if i + 1 < nodes.len() {
                buf.push('\n');
            }
        }

        Ok(buf.into_bytes())
    }

    fn export_mime_type(&self) -> &str {
        "text/markdown"
    }

    fn export_extension(&self) -> &str {
        "md"
    }
}

// ===========================================================================
// Export helpers
// ===========================================================================

/// Convert a `DocNode` to its Markdown representation.
fn node_to_md(node: &DocNode, buf: &mut String) {
    match node {
        DocNode::Heading { level, content } => {
            let hashes = "#".repeat((*level).clamp(1, 6) as usize);
            buf.push_str(&hashes);
            buf.push(' ');
            inlines_to_md(content, buf);
            buf.push('\n');
        },
        DocNode::Paragraph { content, .. } => {
            inlines_to_md(content, buf);
            buf.push('\n');
        },
        DocNode::BulletList { items } => {
            for item in items {
                buf.push_str("- ");
                for (j, child) in item.content.iter().enumerate() {
                    if j > 0 {
                        buf.push_str("  ");
                    }
                    node_to_md(child, buf);
                }
            }
        },
        DocNode::OrderedList { items, start } => {
            for (i, item) in items.iter().enumerate() {
                let num = *start as usize + i;
                buf.push_str(&format!("{num}. "));
                for (j, child) in item.content.iter().enumerate() {
                    if j > 0 {
                        buf.push_str("   ");
                    }
                    node_to_md(child, buf);
                }
            }
        },
        DocNode::TaskList { items } => {
            for item in items {
                let check = if item.checked { "[x]" } else { "[ ]" };
                buf.push_str(&format!("- {check} "));
                for (j, child) in item.content.iter().enumerate() {
                    if j > 0 {
                        buf.push_str("  ");
                    }
                    node_to_md(child, buf);
                }
            }
        },
        DocNode::CodeBlock { language, code } => {
            buf.push_str("```");
            if let Some(lang) = language {
                buf.push_str(lang);
            }
            buf.push('\n');
            buf.push_str(code);
            if !code.ends_with('\n') {
                buf.push('\n');
            }
            buf.push_str("```\n");
        },
        DocNode::Blockquote { nodes } => {
            let mut inner = String::new();
            for child in nodes {
                node_to_md(child, &mut inner);
            }
            for line in inner.lines() {
                buf.push_str("> ");
                buf.push_str(line);
                buf.push('\n');
            }
        },
        DocNode::Table { rows } => {
            if rows.is_empty() {
                return;
            }

            // Render each row
            for (i, row) in rows.iter().enumerate() {
                buf.push('|');
                for cell in &row.cells {
                    buf.push(' ');
                    let text = cells_to_text(&cell.content);
                    buf.push_str(&text);
                    buf.push_str(" |");
                }
                buf.push('\n');

                // After the first row (assumed header), insert separator
                if i == 0 {
                    buf.push('|');
                    for _ in &row.cells {
                        buf.push_str(" --- |");
                    }
                    buf.push('\n');
                }
            }
        },
        DocNode::Image { src, alt, .. } => {
            let alt_text = alt.as_deref().unwrap_or("");
            buf.push_str(&format!("![{alt_text}]({src})\n"));
        },
        DocNode::HorizontalRule => {
            buf.push_str("---\n");
        },
        DocNode::PageBreak => {
            buf.push_str("---\n");
        },
    }
}

/// Convert inline nodes to Markdown text with marks.
fn inlines_to_md(inlines: &[InlineNode], buf: &mut String) {
    for inline in inlines {
        inline_to_md(inline, buf);
    }
}

/// Convert a single inline node to Markdown with formatting marks.
fn inline_to_md(inline: &InlineNode, buf: &mut String) {
    let marks = &inline.marks;
    let text = &inline.text;

    // Build wrapping markers
    let mut prefix = String::new();
    let mut suffix = String::new();

    if let Some(href) = &marks.link {
        prefix.push('[');
        suffix.push_str(&format!("]({href})"));
    }
    if marks.bold {
        prefix.push_str("**");
        suffix.insert_str(0, "**");
    }
    if marks.italic {
        prefix.push('*');
        suffix.insert(0, '*');
    }
    if marks.strikethrough {
        prefix.push_str("~~");
        suffix.insert_str(0, "~~");
    }

    buf.push_str(&prefix);
    buf.push_str(text);
    buf.push_str(&suffix);
}

/// Extract plain text from a list of `DocNode` (used for table cells).
fn cells_to_text(nodes: &[DocNode]) -> String {
    let mut text = String::new();
    for node in nodes {
        match node {
            DocNode::Paragraph { content, .. } | DocNode::Heading { content, .. } => {
                for inline in content {
                    let mut inline_buf = String::new();
                    inline_to_md(inline, &mut inline_buf);
                    text.push_str(&inline_buf);
                }
            },
            _ => {
                let mut inner = String::new();
                node_to_md(node, &mut inner);
                text.push_str(inner.trim());
            },
        }
    }
    text
}
