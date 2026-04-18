//! HTML filter — imports/exports HTML as `IntermediateDocument`.

use scraper::{Html, Node};

use crate::error::{FilterError, FilterResult};
use crate::intermediate::{
    DocBody, DocMetadata, DocNode, DocType, InlineMarks, InlineNode, IntermediateDocument,
    ListItem, TableCell, TableRow,
};
use crate::traits::FilterTrait;

/// Converts HTML to/from `IntermediateDocument`.
///
/// Import parses the HTML DOM (via `scraper`) and maps elements to the
/// intermediate node tree. Export walks the node tree and produces an
/// HTML string wrapped in a full `<!DOCTYPE html>` document.
pub struct HtmlFilter;

impl FilterTrait for HtmlFilter {
    fn name(&self) -> &str {
        "HTML Filter"
    }

    fn mime_types(&self) -> &[&str] {
        &["text/html"]
    }

    fn extensions(&self) -> &[&str] {
        &["html", "htm"]
    }

    fn import(&self, bytes: &[u8]) -> FilterResult<IntermediateDocument> {
        let text = std::str::from_utf8(bytes)
            .map_err(|e| FilterError::ImportFailed(format!("invalid UTF-8: {e}")))?;

        let document = Html::parse_document(text);
        let nodes = children_to_nodes(document.root_element().id(), &document);

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
                    "HtmlFilter cannot export {:?} body",
                    std::mem::discriminant(other)
                )));
            },
        };

        let mut buf = String::from("<!DOCTYPE html>\n<html>\n<body>\n");
        for node in nodes {
            node_to_html(node, &mut buf);
        }
        buf.push_str("</body>\n</html>\n");

        Ok(buf.into_bytes())
    }

    fn export_mime_type(&self) -> &str {
        "text/html"
    }

    fn export_extension(&self) -> &str {
        "html"
    }
}

// ===========================================================================
// Import helpers
// ===========================================================================

/// Convert the children of a DOM node into `DocNode` items.
fn children_to_nodes(parent_id: ego_tree::NodeId, document: &Html) -> Vec<DocNode> {
    let tree_node = document.tree.get(parent_id);
    let Some(tree_node) = tree_node else {
        return Vec::new();
    };

    let mut nodes = Vec::new();
    for child in tree_node.children() {
        match child.value() {
            Node::Element(el) => {
                let tag = el.name().to_lowercase();
                match tag.as_str() {
                    "h1" | "h2" | "h3" | "h4" | "h5" | "h6" => {
                        let level = tag[1..].parse::<u8>().unwrap_or(1);
                        let content = collect_inlines(child.id(), document);
                        nodes.push(DocNode::Heading { level, content });
                    },
                    "p" => {
                        let content = collect_inlines(child.id(), document);
                        nodes.push(DocNode::Paragraph {
                            content,
                            style: None,
                        });
                    },
                    "ul" => {
                        nodes.push(parse_bullet_list(child.id(), document));
                    },
                    "ol" => {
                        let start = el
                            .attr("start")
                            .and_then(|s| s.parse::<u32>().ok())
                            .unwrap_or(1);
                        nodes.push(parse_ordered_list(child.id(), document, start));
                    },
                    "blockquote" => {
                        let inner = children_to_nodes(child.id(), document);
                        nodes.push(DocNode::Blockquote { nodes: inner });
                    },
                    "pre" => {
                        let (lang, code) = extract_code_block(child.id(), document);
                        nodes.push(DocNode::CodeBlock {
                            language: lang,
                            code,
                        });
                    },
                    "hr" => {
                        nodes.push(DocNode::HorizontalRule);
                    },
                    "img" => {
                        let src = el.attr("src").unwrap_or("").to_string();
                        let alt = el.attr("alt").map(String::from);
                        let width = el.attr("width").and_then(|w| w.parse().ok());
                        let height = el.attr("height").and_then(|h| h.parse().ok());
                        nodes.push(DocNode::Image {
                            src,
                            alt,
                            width,
                            height,
                        });
                    },
                    "table" => {
                        nodes.push(parse_table(child.id(), document));
                    },
                    // Structural containers: recurse into children
                    "div" | "section" | "article" | "main" | "header" | "footer" | "nav"
                    | "aside" | "body" | "html" | "head" | "span" => {
                        let inner = children_to_nodes(child.id(), document);
                        nodes.extend(inner);
                    },
                    _ => {
                        // Unknown block element: try to extract inlines
                        let content = collect_inlines(child.id(), document);
                        if !content.is_empty() {
                            nodes.push(DocNode::Paragraph {
                                content,
                                style: None,
                            });
                        }
                    },
                }
            },
            Node::Text(text) => {
                let trimmed = text.text.trim();
                if !trimmed.is_empty() {
                    nodes.push(DocNode::Paragraph {
                        content: vec![InlineNode {
                            text: trimmed.to_string(),
                            marks: InlineMarks::default(),
                        }],
                        style: None,
                    });
                }
            },
            _ => {},
        }
    }

    nodes
}

/// Collect inline content from a DOM element's children.
fn collect_inlines(parent_id: ego_tree::NodeId, document: &Html) -> Vec<InlineNode> {
    collect_inlines_with_marks(parent_id, document, &InlineMarks::default())
}

/// Collect inline nodes, inheriting marks from parent elements.
fn collect_inlines_with_marks(
    parent_id: ego_tree::NodeId,
    document: &Html,
    inherited: &InlineMarks,
) -> Vec<InlineNode> {
    let tree_node = document.tree.get(parent_id);
    let Some(tree_node) = tree_node else {
        return Vec::new();
    };

    let mut inlines = Vec::new();
    for child in tree_node.children() {
        match child.value() {
            Node::Text(text) => {
                if !text.text.is_empty() {
                    inlines.push(InlineNode {
                        text: text.text.to_string(),
                        marks: inherited.clone(),
                    });
                }
            },
            Node::Element(el) => {
                let tag = el.name().to_lowercase();
                let mut marks = inherited.clone();
                match tag.as_str() {
                    "strong" | "b" => marks.bold = true,
                    "em" | "i" => marks.italic = true,
                    "u" | "ins" => marks.underline = true,
                    "s" | "del" | "strike" => marks.strikethrough = true,
                    "a" => {
                        if let Some(href) = el.attr("href") {
                            marks.link = Some(href.to_string());
                        }
                    },
                    "code" => {
                        // Inline code — collect text directly
                        let text = collect_text(child.id(), document);
                        inlines.push(InlineNode {
                            text,
                            marks: marks.clone(),
                        });
                        continue;
                    },
                    "br" => {
                        inlines.push(InlineNode {
                            text: "\n".to_string(),
                            marks: InlineMarks::default(),
                        });
                        continue;
                    },
                    _ => {},
                }
                let nested = collect_inlines_with_marks(child.id(), document, &marks);
                inlines.extend(nested);
            },
            _ => {},
        }
    }

    inlines
}

/// Recursively collect all text content from a node.
fn collect_text(node_id: ego_tree::NodeId, document: &Html) -> String {
    let tree_node = document.tree.get(node_id);
    let Some(tree_node) = tree_node else {
        return String::new();
    };

    let mut text = String::new();
    for child in tree_node.children() {
        match child.value() {
            Node::Text(t) => text.push_str(&t.text),
            Node::Element(_) => text.push_str(&collect_text(child.id(), document)),
            _ => {},
        }
    }
    text
}

/// Parse a `<ul>` into `DocNode::BulletList`.
fn parse_bullet_list(ul_id: ego_tree::NodeId, document: &Html) -> DocNode {
    let tree_node = document.tree.get(ul_id);
    let Some(tree_node) = tree_node else {
        return DocNode::BulletList { items: Vec::new() };
    };

    let mut items = Vec::new();
    for child in tree_node.children() {
        if let Node::Element(el) = child.value() {
            if el.name().to_lowercase() == "li" {
                items.push(ListItem {
                    content: children_to_nodes(child.id(), document),
                });
            }
        }
    }

    DocNode::BulletList { items }
}

/// Parse an `<ol>` into `DocNode::OrderedList`.
fn parse_ordered_list(ol_id: ego_tree::NodeId, document: &Html, start: u32) -> DocNode {
    let tree_node = document.tree.get(ol_id);
    let Some(tree_node) = tree_node else {
        return DocNode::OrderedList {
            items: Vec::new(),
            start,
        };
    };

    let mut items = Vec::new();
    for child in tree_node.children() {
        if let Node::Element(el) = child.value() {
            if el.name().to_lowercase() == "li" {
                items.push(ListItem {
                    content: children_to_nodes(child.id(), document),
                });
            }
        }
    }

    DocNode::OrderedList { items, start }
}

/// Parse a `<table>` into `DocNode::Table`.
fn parse_table(table_id: ego_tree::NodeId, document: &Html) -> DocNode {
    let mut rows = Vec::new();
    collect_table_rows(table_id, document, &mut rows);
    DocNode::Table { rows }
}

/// Recursively collect `<tr>` rows from table, thead, tbody, tfoot elements.
fn collect_table_rows(node_id: ego_tree::NodeId, document: &Html, rows: &mut Vec<TableRow>) {
    let tree_node = document.tree.get(node_id);
    let Some(tree_node) = tree_node else {
        return;
    };

    for child in tree_node.children() {
        if let Node::Element(el) = child.value() {
            let tag = el.name().to_lowercase();
            match tag.as_str() {
                "tr" => {
                    rows.push(parse_table_row(child.id(), document));
                },
                "thead" | "tbody" | "tfoot" => {
                    collect_table_rows(child.id(), document, rows);
                },
                _ => {},
            }
        }
    }
}

/// Parse a single `<tr>` into a `TableRow`.
fn parse_table_row(tr_id: ego_tree::NodeId, document: &Html) -> TableRow {
    let tree_node = document.tree.get(tr_id);
    let Some(tree_node) = tree_node else {
        return TableRow {
            cells: Vec::new(),
            is_header: false,
        };
    };

    let mut cells = Vec::new();
    let mut is_header = false;

    for child in tree_node.children() {
        if let Node::Element(el) = child.value() {
            let tag = el.name().to_lowercase();
            if tag == "th" || tag == "td" {
                if tag == "th" {
                    is_header = true;
                }
                let colspan = el
                    .attr("colspan")
                    .and_then(|s| s.parse::<u32>().ok())
                    .unwrap_or(1);
                let rowspan = el
                    .attr("rowspan")
                    .and_then(|s| s.parse::<u32>().ok())
                    .unwrap_or(1);
                cells.push(TableCell {
                    content: children_to_nodes(child.id(), document),
                    colspan,
                    rowspan,
                });
            }
        }
    }

    TableRow { cells, is_header }
}

/// Extract language and code from a `<pre>` element (optionally containing `<code>`).
fn extract_code_block(pre_id: ego_tree::NodeId, document: &Html) -> (Option<String>, String) {
    let tree_node = document.tree.get(pre_id);
    let Some(tree_node) = tree_node else {
        return (None, String::new());
    };

    for child in tree_node.children() {
        if let Node::Element(el) = child.value() {
            if el.name().to_lowercase() == "code" {
                let lang = el.attr("class").and_then(|c| {
                    c.split_whitespace()
                        .find(|cls| cls.starts_with("language-"))
                        .map(|cls| cls.trim_start_matches("language-").to_string())
                });
                let code = collect_text(child.id(), document);
                return (lang, code);
            }
        }
    }

    // No <code> child — treat all text inside <pre> as code
    let code = collect_text(pre_id, document);
    (None, code)
}

// ===========================================================================
// Export helpers (pub(crate) for reuse by other filters)
// ===========================================================================

/// Convert a `DocNode` to its HTML string representation.
///
/// This function is `pub(crate)` because other filters (docx, pdf) reuse it
/// to produce HTML fragments for their own pipelines.
pub(crate) fn node_to_html(node: &DocNode, buf: &mut String) {
    match node {
        DocNode::Heading { level, content } => {
            let lvl = (*level).clamp(1, 6);
            buf.push_str(&format!("<h{lvl}>"));
            for inline in content {
                inline_to_html(inline, buf);
            }
            buf.push_str(&format!("</h{lvl}>\n"));
        },
        DocNode::Paragraph { content, .. } => {
            buf.push_str("<p>");
            for inline in content {
                inline_to_html(inline, buf);
            }
            buf.push_str("</p>\n");
        },
        DocNode::BulletList { items } => {
            buf.push_str("<ul>\n");
            for item in items {
                buf.push_str("<li>");
                for child in &item.content {
                    node_to_html(child, buf);
                }
                buf.push_str("</li>\n");
            }
            buf.push_str("</ul>\n");
        },
        DocNode::OrderedList { items, start } => {
            if *start != 1 {
                buf.push_str(&format!("<ol start=\"{start}\">\n"));
            } else {
                buf.push_str("<ol>\n");
            }
            for item in items {
                buf.push_str("<li>");
                for child in &item.content {
                    node_to_html(child, buf);
                }
                buf.push_str("</li>\n");
            }
            buf.push_str("</ol>\n");
        },
        DocNode::TaskList { items } => {
            buf.push_str("<ul>\n");
            for item in items {
                let checked = if item.checked { " checked" } else { "" };
                buf.push_str(&format!(
                    "<li><input type=\"checkbox\" disabled{checked}/> "
                ));
                for child in &item.content {
                    node_to_html(child, buf);
                }
                buf.push_str("</li>\n");
            }
            buf.push_str("</ul>\n");
        },
        DocNode::CodeBlock { language, code } => {
            buf.push_str("<pre><code");
            if let Some(lang) = language {
                buf.push_str(&format!(" class=\"language-{lang}\""));
            }
            buf.push('>');
            buf.push_str(&html_escape(code));
            buf.push_str("</code></pre>\n");
        },
        DocNode::Blockquote { nodes } => {
            buf.push_str("<blockquote>\n");
            for child in nodes {
                node_to_html(child, buf);
            }
            buf.push_str("</blockquote>\n");
        },
        DocNode::Table { rows } => {
            buf.push_str("<table>\n");
            for row in rows {
                buf.push_str("<tr>");
                let cell_tag = if row.is_header { "th" } else { "td" };
                for cell in &row.cells {
                    let mut attrs = String::new();
                    if cell.colspan > 1 {
                        attrs.push_str(&format!(" colspan=\"{}\"", cell.colspan));
                    }
                    if cell.rowspan > 1 {
                        attrs.push_str(&format!(" rowspan=\"{}\"", cell.rowspan));
                    }
                    buf.push_str(&format!("<{cell_tag}{attrs}>"));
                    for child in &cell.content {
                        node_to_html(child, buf);
                    }
                    buf.push_str(&format!("</{cell_tag}>"));
                }
                buf.push_str("</tr>\n");
            }
            buf.push_str("</table>\n");
        },
        DocNode::Image {
            src,
            alt,
            width,
            height,
        } => {
            buf.push_str(&format!("<img src=\"{}\"", html_escape(src)));
            if let Some(a) = alt {
                buf.push_str(&format!(" alt=\"{}\"", html_escape(a)));
            }
            if let Some(w) = width {
                buf.push_str(&format!(" width=\"{w}\""));
            }
            if let Some(h) = height {
                buf.push_str(&format!(" height=\"{h}\""));
            }
            buf.push_str("/>\n");
        },
        DocNode::HorizontalRule => {
            buf.push_str("<hr/>\n");
        },
        DocNode::PageBreak => {
            buf.push_str("<div style=\"page-break-after: always;\"></div>\n");
        },
    }
}

/// Convert an `InlineNode` to its HTML representation.
///
/// This function is `pub(crate)` because other filters reuse it.
pub(crate) fn inline_to_html(inline: &InlineNode, buf: &mut String) {
    let marks = &inline.marks;
    let mut open_tags: Vec<&str> = Vec::new();

    // Open link first (outermost)
    if let Some(href) = &marks.link {
        buf.push_str(&format!("<a href=\"{}\">", html_escape(href)));
        open_tags.push("a");
    }
    if marks.bold {
        buf.push_str("<strong>");
        open_tags.push("strong");
    }
    if marks.italic {
        buf.push_str("<em>");
        open_tags.push("em");
    }
    if marks.underline {
        buf.push_str("<u>");
        open_tags.push("u");
    }
    if marks.strikethrough {
        buf.push_str("<s>");
        open_tags.push("s");
    }

    buf.push_str(&html_escape(&inline.text));

    // Close tags in reverse order
    for tag in open_tags.iter().rev() {
        buf.push_str(&format!("</{tag}>"));
    }
}

/// Minimal HTML escaping for text content.
fn html_escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
