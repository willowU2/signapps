//! HTML import to Tiptap JSON.

use super::ImportError;
use scraper::{ElementRef, Html, Selector};

/// Convert HTML to Tiptap JSON
pub fn html_to_tiptap(content: &[u8]) -> Result<serde_json::Value, ImportError> {
    let text = String::from_utf8(content.to_vec())
        .map_err(|e| ImportError::ParseError(format!("Invalid UTF-8: {}", e)))?;

    let document = Html::parse_document(&text);
    let body_selector = Selector::parse("body").expect("valid CSS selector");

    let body = document
        .select(&body_selector)
        .next()
        .ok_or_else(|| ImportError::ParseError("No body element found".to_string()))?;

    let content = process_element(&body)?;

    Ok(serde_json::json!({
        "type": "doc",
        "content": content
    }))
}

fn process_element(element: &ElementRef) -> Result<Vec<serde_json::Value>, ImportError> {
    let mut result = Vec::new();

    for child in element.children() {
        match child.value() {
            scraper::Node::Element(_) => {
                if let Some(child_elem) = ElementRef::wrap(child) {
                    let nodes = element_to_tiptap(&child_elem)?;
                    result.extend(nodes);
                }
            },
            scraper::Node::Text(text) => {
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    // Wrap loose text in paragraph
                    result.push(serde_json::json!({
                        "type": "paragraph",
                        "content": [{
                            "type": "text",
                            "text": trimmed
                        }]
                    }));
                }
            },
            _ => {},
        }
    }

    Ok(result)
}

fn element_to_tiptap(elem: &ElementRef) -> Result<Vec<serde_json::Value>, ImportError> {
    let tag = elem.value().name();
    let mut result = Vec::new();

    match tag {
        // Headings
        "h1" | "h2" | "h3" | "h4" | "h5" | "h6" => {
            let level: u8 = tag
                .chars()
                .last()
                .expect("heading tag has last char")
                .to_digit(10)
                .expect("heading tag ends with digit") as u8;
            let content = process_inline_content(elem)?;
            result.push(serde_json::json!({
                "type": "heading",
                "attrs": { "level": level },
                "content": content
            }));
        },

        // Paragraph
        "p" => {
            let content = process_inline_content(elem)?;
            if !content.is_empty() {
                let mut para = serde_json::json!({
                    "type": "paragraph",
                    "content": content
                });

                // Check for text alignment
                if let Some(style) = elem.value().attr("style") {
                    if let Some(align) = extract_text_align(style) {
                        para["attrs"] = serde_json::json!({ "textAlign": align });
                    }
                }

                result.push(para);
            }
        },

        // Div (container)
        "div" => {
            result.extend(process_element(elem)?);
        },

        // Lists
        "ul" => {
            let items = process_list_items(elem)?;

            // Check if it's a task list
            let is_task_list = elem
                .value()
                .attr("class")
                .map(|c| c.contains("task-list"))
                .unwrap_or(false);

            if is_task_list {
                result.push(serde_json::json!({
                    "type": "taskList",
                    "content": items
                }));
            } else {
                result.push(serde_json::json!({
                    "type": "bulletList",
                    "content": items
                }));
            }
        },

        "ol" => {
            let items = process_list_items(elem)?;
            let start = elem
                .value()
                .attr("start")
                .and_then(|s| s.parse::<u32>().ok())
                .unwrap_or(1);

            let mut node = serde_json::json!({
                "type": "orderedList",
                "content": items
            });

            if start > 1 {
                node["attrs"] = serde_json::json!({ "start": start });
            }

            result.push(node);
        },

        // Blockquote
        "blockquote" => {
            let inner = process_element(elem)?;
            result.push(serde_json::json!({
                "type": "blockquote",
                "content": inner
            }));
        },

        // Preformatted / Code
        "pre" => {
            let code = extract_code_content(elem);
            let language = extract_code_language(elem);

            result.push(serde_json::json!({
                "type": "codeBlock",
                "attrs": { "language": language },
                "content": [{
                    "type": "text",
                    "text": code
                }]
            }));
        },

        // Table
        "table" => {
            let rows = process_table(elem)?;
            result.push(serde_json::json!({
                "type": "table",
                "content": rows
            }));
        },

        // Horizontal rule
        "hr" => {
            result.push(serde_json::json!({
                "type": "horizontalRule"
            }));
        },

        // Images
        "img" => {
            let src = elem.value().attr("src").unwrap_or("");
            let alt = elem.value().attr("alt").unwrap_or("");
            let title = elem.value().attr("title").unwrap_or("");

            result.push(serde_json::json!({
                "type": "image",
                "attrs": {
                    "src": src,
                    "alt": alt,
                    "title": title
                }
            }));
        },

        // Line break
        "br" => {
            result.push(serde_json::json!({
                "type": "hardBreak"
            }));
        },

        // Inline elements that shouldn't create blocks
        "span" | "strong" | "b" | "em" | "i" | "u" | "s" | "strike" | "del" | "code" | "a"
        | "mark" | "sub" | "sup" => {
            // These should be handled as inline content
            // If found at block level, wrap in paragraph
            let content = process_inline_content(elem)?;
            if !content.is_empty() {
                result.push(serde_json::json!({
                    "type": "paragraph",
                    "content": content
                }));
            }
        },

        // Ignore script, style, etc.
        "script" | "style" | "meta" | "link" | "head" | "title" | "noscript" => {
            // Skip these elements
        },

        // Other elements: try to process children
        _ => {
            result.extend(process_element(elem)?);
        },
    }

    Ok(result)
}

fn process_inline_content(elem: &ElementRef) -> Result<Vec<serde_json::Value>, ImportError> {
    let mut result = Vec::new();

    for child in elem.children() {
        match child.value() {
            scraper::Node::Text(text) => {
                let text_str = text.to_string();
                if !text_str.is_empty() {
                    result.push(serde_json::json!({
                        "type": "text",
                        "text": text_str
                    }));
                }
            },
            scraper::Node::Element(_) => {
                if let Some(child_elem) = ElementRef::wrap(child) {
                    let inline = process_inline_element(&child_elem)?;
                    result.extend(inline);
                }
            },
            _ => {},
        }
    }

    Ok(result)
}

fn process_inline_element(elem: &ElementRef) -> Result<Vec<serde_json::Value>, ImportError> {
    let tag = elem.value().name();
    let mut result = Vec::new();

    match tag {
        "strong" | "b" => {
            let inner = process_inline_content(elem)?;
            for mut item in inner {
                add_mark(&mut item, serde_json::json!({ "type": "bold" }));
                result.push(item);
            }
        },
        "em" | "i" => {
            let inner = process_inline_content(elem)?;
            for mut item in inner {
                add_mark(&mut item, serde_json::json!({ "type": "italic" }));
                result.push(item);
            }
        },
        "u" => {
            let inner = process_inline_content(elem)?;
            for mut item in inner {
                add_mark(&mut item, serde_json::json!({ "type": "underline" }));
                result.push(item);
            }
        },
        "s" | "strike" | "del" => {
            let inner = process_inline_content(elem)?;
            for mut item in inner {
                add_mark(&mut item, serde_json::json!({ "type": "strike" }));
                result.push(item);
            }
        },
        "code" => {
            let text = extract_text(elem);
            result.push(serde_json::json!({
                "type": "text",
                "text": text,
                "marks": [{ "type": "code" }]
            }));
        },
        "a" => {
            let href = elem.value().attr("href").unwrap_or("#");
            let target = elem.value().attr("target").unwrap_or("_blank");
            let inner = process_inline_content(elem)?;
            for mut item in inner {
                add_mark(
                    &mut item,
                    serde_json::json!({
                        "type": "link",
                        "attrs": { "href": href, "target": target }
                    }),
                );
                result.push(item);
            }
        },
        "span" => {
            let inner = process_inline_content(elem)?;

            // Check for styling
            if let Some(style) = elem.value().attr("style") {
                let mut text_style_attrs = serde_json::Map::new();

                if let Some(color) = extract_color(style) {
                    text_style_attrs.insert("color".to_string(), serde_json::json!(color));
                }
                if let Some(font_family) = extract_font_family(style) {
                    text_style_attrs
                        .insert("fontFamily".to_string(), serde_json::json!(font_family));
                }
                if let Some(font_size) = extract_font_size(style) {
                    text_style_attrs.insert("fontSize".to_string(), serde_json::json!(font_size));
                }

                if !text_style_attrs.is_empty() {
                    for mut item in inner {
                        add_mark(
                            &mut item,
                            serde_json::json!({
                                "type": "textStyle",
                                "attrs": text_style_attrs
                            }),
                        );
                        result.push(item);
                    }
                } else {
                    result.extend(inner);
                }
            } else {
                result.extend(inner);
            }
        },
        "mark" => {
            let color = elem
                .value()
                .attr("style")
                .and_then(extract_background_color)
                .unwrap_or_else(|| "yellow".to_string());

            let inner = process_inline_content(elem)?;
            for mut item in inner {
                add_mark(
                    &mut item,
                    serde_json::json!({
                        "type": "highlight",
                        "attrs": { "color": color }
                    }),
                );
                result.push(item);
            }
        },
        "sub" => {
            let inner = process_inline_content(elem)?;
            for mut item in inner {
                add_mark(&mut item, serde_json::json!({ "type": "subscript" }));
                result.push(item);
            }
        },
        "sup" => {
            let inner = process_inline_content(elem)?;
            for mut item in inner {
                add_mark(&mut item, serde_json::json!({ "type": "superscript" }));
                result.push(item);
            }
        },
        "br" => {
            result.push(serde_json::json!({
                "type": "hardBreak"
            }));
        },
        "img" => {
            let src = elem.value().attr("src").unwrap_or("");
            let alt = elem.value().attr("alt").unwrap_or("");
            result.push(serde_json::json!({
                "type": "image",
                "attrs": { "src": src, "alt": alt }
            }));
        },
        _ => {
            // Process children for unknown inline elements
            result.extend(process_inline_content(elem)?);
        },
    }

    Ok(result)
}

fn process_list_items(list: &ElementRef) -> Result<Vec<serde_json::Value>, ImportError> {
    let li_selector = Selector::parse("li").expect("valid CSS selector");
    let mut items = Vec::new();

    for li in list.select(&li_selector) {
        // Check if it's a task item
        let checkbox_selector =
            Selector::parse("input[type=\"checkbox\"]").expect("valid CSS selector");
        let checkbox = li.select(&checkbox_selector).next();

        if let Some(cb) = checkbox {
            let checked = cb.value().attr("checked").is_some();
            let content = process_element(&li)?;
            items.push(serde_json::json!({
                "type": "taskItem",
                "attrs": { "checked": checked },
                "content": content
            }));
        } else {
            let content = process_element(&li)?;
            items.push(serde_json::json!({
                "type": "listItem",
                "content": content
            }));
        }
    }

    Ok(items)
}

fn process_table(table: &ElementRef) -> Result<Vec<serde_json::Value>, ImportError> {
    let tr_selector = Selector::parse("tr").expect("valid CSS selector");
    let th_selector = Selector::parse("th").expect("valid CSS selector");
    let td_selector = Selector::parse("td").expect("valid CSS selector");

    let mut rows = Vec::new();

    for tr in table.select(&tr_selector) {
        let mut cells = Vec::new();

        // Process header cells
        for th in tr.select(&th_selector) {
            let content = process_inline_content(&th)?;
            cells.push(serde_json::json!({
                "type": "tableHeader",
                "content": [{
                    "type": "paragraph",
                    "content": content
                }]
            }));
        }

        // Process data cells
        for td in tr.select(&td_selector) {
            let content = process_inline_content(&td)?;
            cells.push(serde_json::json!({
                "type": "tableCell",
                "content": [{
                    "type": "paragraph",
                    "content": content
                }]
            }));
        }

        if !cells.is_empty() {
            rows.push(serde_json::json!({
                "type": "tableRow",
                "content": cells
            }));
        }
    }

    Ok(rows)
}

fn add_mark(item: &mut serde_json::Value, mark: serde_json::Value) {
    if let Some(obj) = item.as_object_mut() {
        let marks = obj.entry("marks").or_insert(serde_json::json!([]));
        if let Some(arr) = marks.as_array_mut() {
            arr.push(mark);
        }
    }
}

fn extract_text(elem: &ElementRef) -> String {
    let mut text = String::new();
    for child in elem.children() {
        if let scraper::Node::Text(t) = child.value() {
            text.push_str(t);
        }
    }
    text
}

fn extract_code_content(pre: &ElementRef) -> String {
    let code_selector = Selector::parse("code").ok();

    if let Some(selector) = &code_selector {
        if let Some(code) = pre.select(selector).next() {
            return extract_text(&code);
        }
    }

    extract_text(pre)
}

fn extract_code_language(pre: &ElementRef) -> String {
    let code_selector = Selector::parse("code").ok();

    if let Some(selector) = &code_selector {
        if let Some(code) = pre.select(selector).next() {
            if let Some(class) = code.value().attr("class") {
                // Common patterns: language-rust, lang-rust, rust
                for part in class.split_whitespace() {
                    if let Some(lang) = part.strip_prefix("language-") {
                        return lang.to_string();
                    }
                    if let Some(lang) = part.strip_prefix("lang-") {
                        return lang.to_string();
                    }
                }
            }
        }
    }

    String::new()
}

fn extract_text_align(style: &str) -> Option<String> {
    for part in style.split(';') {
        let part = part.trim();
        if let Some(value) = part.strip_prefix("text-align:") {
            return Some(value.trim().to_string());
        }
    }
    None
}

fn extract_color(style: &str) -> Option<String> {
    for part in style.split(';') {
        let part = part.trim();
        if part.starts_with("color:") && !part.starts_with("background-color:") {
            let value = part.strip_prefix("color:")?.trim();
            return Some(value.to_string());
        }
    }
    None
}

fn extract_background_color(style: &str) -> Option<String> {
    for part in style.split(';') {
        let part = part.trim();
        if let Some(value) = part.strip_prefix("background-color:") {
            return Some(value.trim().to_string());
        }
    }
    None
}

fn extract_font_family(style: &str) -> Option<String> {
    for part in style.split(';') {
        let part = part.trim();
        if let Some(value) = part.strip_prefix("font-family:") {
            return Some(value.trim().to_string());
        }
    }
    None
}

fn extract_font_size(style: &str) -> Option<String> {
    for part in style.split(';') {
        let part = part.trim();
        if let Some(value) = part.strip_prefix("font-size:") {
            return Some(value.trim().to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_html() {
        let html = "<html><body><p>Hello World</p></body></html>";
        let result = html_to_tiptap(html.as_bytes()).unwrap();

        assert_eq!(result["type"], "doc");
        let content = result["content"].as_array().unwrap();
        assert_eq!(content[0]["type"], "paragraph");
    }

    #[test]
    fn test_heading() {
        let html = "<html><body><h1>Title</h1></body></html>";
        let result = html_to_tiptap(html.as_bytes()).unwrap();

        let content = result["content"].as_array().unwrap();
        assert_eq!(content[0]["type"], "heading");
        assert_eq!(content[0]["attrs"]["level"], 1);
    }

    #[test]
    fn test_formatting() {
        let html = "<html><body><p><strong>bold</strong></p></body></html>";
        let result = html_to_tiptap(html.as_bytes()).unwrap();

        let content = result["content"].as_array().unwrap();
        let para = &content[0];
        let inline = para["content"].as_array().unwrap();
        assert_eq!(inline[0]["marks"][0]["type"], "bold");
    }
}
