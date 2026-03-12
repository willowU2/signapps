//! Markdown import to Tiptap JSON.

use super::ImportError;
use comrak::{parse_document, Arena, ComrakOptions};
use comrak::nodes::{AstNode, NodeValue, ListType};

/// Convert Markdown to Tiptap JSON
pub fn markdown_to_tiptap(content: &[u8]) -> Result<serde_json::Value, ImportError> {
    let text = String::from_utf8(content.to_vec())
        .map_err(|e| ImportError::ParseError(format!("Invalid UTF-8: {}", e)))?;

    let arena = Arena::new();
    let mut options = ComrakOptions::default();

    // Enable GFM extensions
    options.extension.strikethrough = true;
    options.extension.table = true;
    options.extension.autolink = true;
    options.extension.tasklist = true;
    options.extension.superscript = true;

    let root = parse_document(&arena, &text, &options);

    let content = process_node(root)?;

    Ok(serde_json::json!({
        "type": "doc",
        "content": content
    }))
}

fn process_node<'a>(node: &'a AstNode<'a>) -> Result<Vec<serde_json::Value>, ImportError> {
    let mut result = Vec::new();

    for child in node.children() {
        let value = child.data.borrow();

        match &value.value {
            NodeValue::Document => {
                result.extend(process_node(child)?);
            }
            NodeValue::Paragraph => {
                let content = process_inline(child)?;
                if !content.is_empty() {
                    result.push(serde_json::json!({
                        "type": "paragraph",
                        "content": content
                    }));
                }
            }
            NodeValue::Heading(heading) => {
                let content = process_inline(child)?;
                result.push(serde_json::json!({
                    "type": "heading",
                    "attrs": { "level": heading.level },
                    "content": content
                }));
            }
            NodeValue::BlockQuote => {
                let inner = process_node(child)?;
                result.push(serde_json::json!({
                    "type": "blockquote",
                    "content": inner
                }));
            }
            NodeValue::List(list) => {
                let list_type = if list.list_type == ListType::Ordered {
                    "orderedList"
                } else {
                    "bulletList"
                };
                let items = process_list_items(child)?;
                let mut node_json = serde_json::json!({
                    "type": list_type,
                    "content": items
                });

                if list.list_type == ListType::Ordered && list.start > 1 {
                    node_json["attrs"] = serde_json::json!({ "start": list.start });
                }

                result.push(node_json);
            }
            NodeValue::CodeBlock(code_block) => {
                let language = code_block.info.split_whitespace().next().unwrap_or("");

                result.push(serde_json::json!({
                    "type": "codeBlock",
                    "attrs": { "language": language },
                    "content": [{
                        "type": "text",
                        "text": code_block.literal.trim_end()
                    }]
                }));
            }
            NodeValue::ThematicBreak => {
                result.push(serde_json::json!({
                    "type": "horizontalRule"
                }));
            }
            NodeValue::Table(_) => {
                let table_content = process_table(child)?;
                result.push(serde_json::json!({
                    "type": "table",
                    "content": table_content
                }));
            }
            NodeValue::TaskItem(_) => {
                // Task items are handled in process_list_items
            }
            _ => {
                // Try to process children for unhandled nodes
                result.extend(process_node(child)?);
            }
        }
    }

    Ok(result)
}

fn process_list_items<'a>(list_node: &'a AstNode<'a>) -> Result<Vec<serde_json::Value>, ImportError> {
    let mut items = Vec::new();

    for child in list_node.children() {
        let value = child.data.borrow();

        match &value.value {
            NodeValue::Item(_) => {
                let content = process_node(child)?;
                items.push(serde_json::json!({
                    "type": "listItem",
                    "content": content
                }));
            }
            NodeValue::TaskItem(checked) => {
                let content = process_node(child)?;
                items.push(serde_json::json!({
                    "type": "taskItem",
                    "attrs": { "checked": *checked },
                    "content": content
                }));
            }
            _ => {}
        }
    }

    Ok(items)
}

fn process_inline<'a>(node: &'a AstNode<'a>) -> Result<Vec<serde_json::Value>, ImportError> {
    let mut result = Vec::new();

    for child in node.children() {
        let value = child.data.borrow();

        match &value.value {
            NodeValue::Text(text) => {
                if !text.is_empty() {
                    result.push(serde_json::json!({
                        "type": "text",
                        "text": text
                    }));
                }
            }
            NodeValue::Code(code) => {
                result.push(serde_json::json!({
                    "type": "text",
                    "text": &code.literal,
                    "marks": [{ "type": "code" }]
                }));
            }
            NodeValue::Strong => {
                let inner = process_inline(child)?;
                for mut item in inner {
                    add_mark(&mut item, "bold");
                    result.push(item);
                }
            }
            NodeValue::Emph => {
                let inner = process_inline(child)?;
                for mut item in inner {
                    add_mark(&mut item, "italic");
                    result.push(item);
                }
            }
            NodeValue::Strikethrough => {
                let inner = process_inline(child)?;
                for mut item in inner {
                    add_mark(&mut item, "strike");
                    result.push(item);
                }
            }
            NodeValue::Link(link) => {
                let inner = process_inline(child)?;
                for mut item in inner {
                    add_link_mark(&mut item, &link.url);
                    result.push(item);
                }
            }
            NodeValue::Image(image) => {
                result.push(serde_json::json!({
                    "type": "image",
                    "attrs": {
                        "src": &image.url,
                        "alt": &image.title
                    }
                }));
            }
            NodeValue::SoftBreak => {
                result.push(serde_json::json!({
                    "type": "text",
                    "text": " "
                }));
            }
            NodeValue::LineBreak => {
                result.push(serde_json::json!({
                    "type": "hardBreak"
                }));
            }
            NodeValue::Superscript => {
                let inner = process_inline(child)?;
                for mut item in inner {
                    add_mark(&mut item, "superscript");
                    result.push(item);
                }
            }
            _ => {
                // Recursively process children
                result.extend(process_inline(child)?);
            }
        }
    }

    Ok(result)
}

fn process_table<'a>(table: &'a AstNode<'a>) -> Result<Vec<serde_json::Value>, ImportError> {
    let mut rows = Vec::new();

    for child in table.children() {
        let value = child.data.borrow();

        if let NodeValue::TableRow(is_header) = &value.value {
            let cells = process_table_cells(child, *is_header)?;
            rows.push(serde_json::json!({
                "type": "tableRow",
                "content": cells
            }));
        }
    }

    Ok(rows)
}

fn process_table_cells<'a>(row: &'a AstNode<'a>, is_header: bool) -> Result<Vec<serde_json::Value>, ImportError> {
    let mut cells = Vec::new();

    for child in row.children() {
        let value = child.data.borrow();

        if let NodeValue::TableCell = &value.value {
            let content = process_inline(child)?;
            let cell_type = if is_header { "tableHeader" } else { "tableCell" };

            cells.push(serde_json::json!({
                "type": cell_type,
                "content": [{
                    "type": "paragraph",
                    "content": content
                }]
            }));
        }
    }

    Ok(cells)
}

fn add_mark(item: &mut serde_json::Value, mark_type: &str) {
    if let Some(obj) = item.as_object_mut() {
        let marks = obj.entry("marks").or_insert(serde_json::json!([]));
        if let Some(arr) = marks.as_array_mut() {
            arr.push(serde_json::json!({ "type": mark_type }));
        }
    }
}

fn add_link_mark(item: &mut serde_json::Value, url: &str) {
    if let Some(obj) = item.as_object_mut() {
        let marks = obj.entry("marks").or_insert(serde_json::json!([]));
        if let Some(arr) = marks.as_array_mut() {
            arr.push(serde_json::json!({
                "type": "link",
                "attrs": { "href": url, "target": "_blank" }
            }));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_markdown() {
        let md = "# Hello World\n\nThis is a paragraph.";
        let result = markdown_to_tiptap(md.as_bytes()).unwrap();

        assert_eq!(result["type"], "doc");
        let content = result["content"].as_array().unwrap();
        assert_eq!(content[0]["type"], "heading");
        assert_eq!(content[0]["attrs"]["level"], 1);
    }

    #[test]
    fn test_bold_italic() {
        let md = "**bold** and *italic*";
        let result = markdown_to_tiptap(md.as_bytes()).unwrap();

        let content = result["content"].as_array().unwrap();
        let para = &content[0];
        let inline = para["content"].as_array().unwrap();

        // Check bold
        assert_eq!(inline[0]["text"], "bold");
        assert!(inline[0]["marks"][0]["type"] == "bold");
    }

    #[test]
    fn test_code_block() {
        let md = "```rust\nfn main() {}\n```";
        let result = markdown_to_tiptap(md.as_bytes()).unwrap();

        let content = result["content"].as_array().unwrap();
        assert_eq!(content[0]["type"], "codeBlock");
        assert_eq!(content[0]["attrs"]["language"], "rust");
    }
}
