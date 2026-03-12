//! Tiptap JSON to HTML conversion.

use super::ConversionError;
use serde::Deserialize;
use serde_json::Value;

/// Tiptap document structure
#[derive(Debug, Deserialize)]
struct TiptapDoc {
    #[serde(rename = "type")]
    doc_type: String,
    content: Option<Vec<TiptapNode>>,
}

/// Tiptap node
#[derive(Debug, Deserialize)]
struct TiptapNode {
    #[serde(rename = "type")]
    node_type: String,
    content: Option<Vec<TiptapNode>>,
    text: Option<String>,
    attrs: Option<Value>,
    marks: Option<Vec<TiptapMark>>,
}

/// Tiptap mark (formatting)
#[derive(Debug, Deserialize)]
struct TiptapMark {
    #[serde(rename = "type")]
    mark_type: String,
    attrs: Option<Value>,
}

/// Convert Tiptap JSON to HTML
pub fn tiptap_to_html(json: &str) -> Result<String, ConversionError> {
    let doc: TiptapDoc =
        serde_json::from_str(json).map_err(|e| ConversionError::InvalidInput(e.to_string()))?;

    if doc.doc_type != "doc" {
        return Err(ConversionError::InvalidInput(
            "Invalid Tiptap document: root must be 'doc' type".to_string(),
        ));
    }

    let mut html = String::new();
    html.push_str("<!DOCTYPE html><html><head><meta charset=\"UTF-8\"></head><body>");

    if let Some(content) = doc.content {
        for node in content {
            html.push_str(&node_to_html(&node)?);
        }
    }

    html.push_str("</body></html>");
    Ok(html)
}

fn node_to_html(node: &TiptapNode) -> Result<String, ConversionError> {
    let mut html = String::new();

    match node.node_type.as_str() {
        "paragraph" => {
            let style = get_paragraph_style(&node.attrs);
            html.push_str(&format!("<p{}>", style));
            html.push_str(&children_to_html(node)?);
            html.push_str("</p>");
        }
        "heading" => {
            let level = node
                .attrs
                .as_ref()
                .and_then(|a| a.get("level"))
                .and_then(|l| l.as_u64())
                .unwrap_or(1)
                .min(6);
            html.push_str(&format!("<h{}>", level));
            html.push_str(&children_to_html(node)?);
            html.push_str(&format!("</h{}>", level));
        }
        "bulletList" => {
            html.push_str("<ul>");
            html.push_str(&children_to_html(node)?);
            html.push_str("</ul>");
        }
        "orderedList" => {
            let start = node
                .attrs
                .as_ref()
                .and_then(|a| a.get("start"))
                .and_then(|s| s.as_u64())
                .unwrap_or(1);
            html.push_str(&format!("<ol start=\"{}\">", start));
            html.push_str(&children_to_html(node)?);
            html.push_str("</ol>");
        }
        "listItem" => {
            html.push_str("<li>");
            html.push_str(&children_to_html(node)?);
            html.push_str("</li>");
        }
        "taskList" => {
            html.push_str("<ul class=\"task-list\">");
            html.push_str(&children_to_html(node)?);
            html.push_str("</ul>");
        }
        "taskItem" => {
            let checked = node
                .attrs
                .as_ref()
                .and_then(|a| a.get("checked"))
                .and_then(|c| c.as_bool())
                .unwrap_or(false);
            let checkbox = if checked {
                "<input type=\"checkbox\" checked disabled>"
            } else {
                "<input type=\"checkbox\" disabled>"
            };
            html.push_str(&format!("<li class=\"task-item\">{}", checkbox));
            html.push_str(&children_to_html(node)?);
            html.push_str("</li>");
        }
        "blockquote" => {
            html.push_str("<blockquote>");
            html.push_str(&children_to_html(node)?);
            html.push_str("</blockquote>");
        }
        "codeBlock" => {
            let language = node
                .attrs
                .as_ref()
                .and_then(|a| a.get("language"))
                .and_then(|l| l.as_str())
                .unwrap_or("");
            html.push_str(&format!("<pre><code class=\"language-{}\">", language));
            html.push_str(&children_to_html(node)?);
            html.push_str("</code></pre>");
        }
        "horizontalRule" => {
            html.push_str("<hr>");
        }
        "hardBreak" => {
            html.push_str("<br>");
        }
        "image" => {
            let src = node
                .attrs
                .as_ref()
                .and_then(|a| a.get("src"))
                .and_then(|s| s.as_str())
                .unwrap_or("");
            let alt = node
                .attrs
                .as_ref()
                .and_then(|a| a.get("alt"))
                .and_then(|s| s.as_str())
                .unwrap_or("");
            let title = node
                .attrs
                .as_ref()
                .and_then(|a| a.get("title"))
                .and_then(|s| s.as_str())
                .unwrap_or("");
            html.push_str(&format!(
                "<img src=\"{}\" alt=\"{}\" title=\"{}\">",
                escape_html(src),
                escape_html(alt),
                escape_html(title)
            ));
        }
        "table" => {
            html.push_str("<table>");
            html.push_str(&children_to_html(node)?);
            html.push_str("</table>");
        }
        "tableRow" => {
            html.push_str("<tr>");
            html.push_str(&children_to_html(node)?);
            html.push_str("</tr>");
        }
        "tableHeader" => {
            let colspan = get_colspan(&node.attrs);
            let rowspan = get_rowspan(&node.attrs);
            html.push_str(&format!("<th{}{}>", colspan, rowspan));
            html.push_str(&children_to_html(node)?);
            html.push_str("</th>");
        }
        "tableCell" => {
            let colspan = get_colspan(&node.attrs);
            let rowspan = get_rowspan(&node.attrs);
            html.push_str(&format!("<td{}{}>", colspan, rowspan));
            html.push_str(&children_to_html(node)?);
            html.push_str("</td>");
        }
        "text" => {
            if let Some(text) = &node.text {
                let mut text_html = escape_html(text);

                // Apply marks (formatting)
                if let Some(marks) = &node.marks {
                    for mark in marks {
                        text_html = apply_mark(&text_html, mark);
                    }
                }
                html.push_str(&text_html);
            }
        }
        _ => {
            // Unknown node type - try to render children
            html.push_str(&children_to_html(node)?);
        }
    }

    Ok(html)
}

fn children_to_html(node: &TiptapNode) -> Result<String, ConversionError> {
    let mut html = String::new();
    if let Some(content) = &node.content {
        for child in content {
            html.push_str(&node_to_html(child)?);
        }
    }
    // Handle text nodes without content array
    if let Some(text) = &node.text {
        let mut text_html = escape_html(text);
        if let Some(marks) = &node.marks {
            for mark in marks {
                text_html = apply_mark(&text_html, mark);
            }
        }
        html.push_str(&text_html);
    }
    Ok(html)
}

fn apply_mark(text: &str, mark: &TiptapMark) -> String {
    match mark.mark_type.as_str() {
        "bold" => format!("<strong>{}</strong>", text),
        "italic" => format!("<em>{}</em>", text),
        "underline" => format!("<u>{}</u>", text),
        "strike" => format!("<s>{}</s>", text),
        "code" => format!("<code>{}</code>", text),
        "link" => {
            let href = mark
                .attrs
                .as_ref()
                .and_then(|a| a.get("href"))
                .and_then(|h| h.as_str())
                .unwrap_or("#");
            let target = mark
                .attrs
                .as_ref()
                .and_then(|a| a.get("target"))
                .and_then(|t| t.as_str())
                .unwrap_or("_blank");
            format!(
                "<a href=\"{}\" target=\"{}\">{}</a>",
                escape_html(href),
                target,
                text
            )
        }
        "textStyle" => {
            let mut style = String::new();
            if let Some(attrs) = &mark.attrs {
                if let Some(color) = attrs.get("color").and_then(|c| c.as_str()) {
                    style.push_str(&format!("color: {};", color));
                }
                if let Some(font_family) = attrs.get("fontFamily").and_then(|f| f.as_str()) {
                    style.push_str(&format!("font-family: {};", font_family));
                }
                if let Some(font_size) = attrs.get("fontSize").and_then(|f| f.as_str()) {
                    style.push_str(&format!("font-size: {};", font_size));
                }
            }
            if style.is_empty() {
                text.to_string()
            } else {
                format!("<span style=\"{}\">{}</span>", style, text)
            }
        }
        "highlight" => {
            let color = mark
                .attrs
                .as_ref()
                .and_then(|a| a.get("color"))
                .and_then(|c| c.as_str())
                .unwrap_or("yellow");
            format!(
                "<mark style=\"background-color: {};\">{}</mark>",
                color, text
            )
        }
        "subscript" => format!("<sub>{}</sub>", text),
        "superscript" => format!("<sup>{}</sup>", text),
        _ => text.to_string(),
    }
}

fn get_paragraph_style(attrs: &Option<Value>) -> String {
    let mut styles = Vec::new();

    if let Some(attrs) = attrs {
        if let Some(align) = attrs.get("textAlign").and_then(|a| a.as_str()) {
            styles.push(format!("text-align: {}", align));
        }
    }

    if styles.is_empty() {
        String::new()
    } else {
        format!(" style=\"{}\"", styles.join("; "))
    }
}

fn get_colspan(attrs: &Option<Value>) -> String {
    attrs
        .as_ref()
        .and_then(|a| a.get("colspan"))
        .and_then(|c| c.as_u64())
        .filter(|&c| c > 1)
        .map(|c| format!(" colspan=\"{}\"", c))
        .unwrap_or_default()
}

fn get_rowspan(attrs: &Option<Value>) -> String {
    attrs
        .as_ref()
        .and_then(|a| a.get("rowspan"))
        .and_then(|r| r.as_u64())
        .filter(|&r| r > 1)
        .map(|r| format!(" rowspan=\"{}\"", r))
        .unwrap_or_default()
}

fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_paragraph() {
        let json = r#"{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello World"}]}]}"#;
        let html = tiptap_to_html(json).unwrap();
        assert!(html.contains("<p>Hello World</p>"));
    }

    #[test]
    fn test_bold_text() {
        let json = r#"{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"Bold"}]}]}"#;
        let html = tiptap_to_html(json).unwrap();
        assert!(html.contains("<strong>Bold</strong>"));
    }

    #[test]
    fn test_heading() {
        let json = r#"{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Title"}]}]}"#;
        let html = tiptap_to_html(json).unwrap();
        assert!(html.contains("<h2>Title</h2>"));
    }
}
