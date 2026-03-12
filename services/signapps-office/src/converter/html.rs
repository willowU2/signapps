//! HTML conversion utilities.

use super::ConversionError;
use scraper::{Html, Selector};

/// Convert HTML to Markdown
pub fn html_to_markdown(html: &str) -> Result<String, ConversionError> {
    let document = Html::parse_document(html);
    let body_selector = Selector::parse("body").unwrap();

    let body = document
        .select(&body_selector)
        .next()
        .map(|b| b.inner_html())
        .unwrap_or_else(|| html.to_string());

    // Simple HTML to Markdown conversion
    let markdown = html_to_markdown_impl(&body);
    Ok(markdown)
}

/// Convert HTML to plain text
pub fn html_to_text(html: &str) -> Result<String, ConversionError> {
    let document = Html::parse_document(html);
    let body_selector = Selector::parse("body").unwrap();

    let body = document.select(&body_selector).next();

    let text = if let Some(body) = body {
        extract_text(&body)
    } else {
        // Fallback: parse entire document
        let root = document.root_element();
        extract_text(&root)
    };

    Ok(text.trim().to_string())
}

fn extract_text(element: &scraper::ElementRef) -> String {
    let mut text = String::new();

    for node in element.children() {
        match node.value() {
            scraper::Node::Text(t) => {
                text.push_str(t);
            }
            scraper::Node::Element(_) => {
                if let Some(child_elem) = scraper::ElementRef::wrap(node) {
                    let tag = child_elem.value().name();

                    // Add appropriate spacing for block elements
                    let is_block = matches!(
                        tag,
                        "p" | "div"
                            | "h1"
                            | "h2"
                            | "h3"
                            | "h4"
                            | "h5"
                            | "h6"
                            | "li"
                            | "br"
                            | "hr"
                            | "blockquote"
                            | "pre"
                    );

                    if is_block && !text.is_empty() && !text.ends_with('\n') {
                        text.push('\n');
                    }

                    text.push_str(&extract_text(&child_elem));

                    if is_block {
                        text.push('\n');
                    }
                }
            }
            _ => {}
        }
    }

    text
}

fn html_to_markdown_impl(html: &str) -> String {
    let document = Html::parse_fragment(html);
    let mut markdown = String::new();

    for node in document.root_element().children() {
        if let Some(elem) = scraper::ElementRef::wrap(node) {
            markdown.push_str(&element_to_markdown(&elem));
        } else if let scraper::Node::Text(t) = node.value() {
            markdown.push_str(t);
        }
    }

    // Clean up multiple newlines
    let mut result = String::new();
    let mut prev_newline = false;
    for c in markdown.chars() {
        if c == '\n' {
            if !prev_newline {
                result.push(c);
                prev_newline = true;
            } else {
                result.push(c);
            }
        } else {
            prev_newline = false;
            result.push(c);
        }
    }

    result.trim().to_string()
}

fn element_to_markdown(elem: &scraper::ElementRef) -> String {
    let tag = elem.value().name();
    let mut result = String::new();

    match tag {
        "h1" => {
            result.push_str("# ");
            result.push_str(&children_to_markdown(elem));
            result.push_str("\n\n");
        }
        "h2" => {
            result.push_str("## ");
            result.push_str(&children_to_markdown(elem));
            result.push_str("\n\n");
        }
        "h3" => {
            result.push_str("### ");
            result.push_str(&children_to_markdown(elem));
            result.push_str("\n\n");
        }
        "h4" => {
            result.push_str("#### ");
            result.push_str(&children_to_markdown(elem));
            result.push_str("\n\n");
        }
        "h5" => {
            result.push_str("##### ");
            result.push_str(&children_to_markdown(elem));
            result.push_str("\n\n");
        }
        "h6" => {
            result.push_str("###### ");
            result.push_str(&children_to_markdown(elem));
            result.push_str("\n\n");
        }
        "p" => {
            result.push_str(&children_to_markdown(elem));
            result.push_str("\n\n");
        }
        "strong" | "b" => {
            result.push_str("**");
            result.push_str(&children_to_markdown(elem));
            result.push_str("**");
        }
        "em" | "i" => {
            result.push('*');
            result.push_str(&children_to_markdown(elem));
            result.push('*');
        }
        "u" => {
            result.push_str("<u>");
            result.push_str(&children_to_markdown(elem));
            result.push_str("</u>");
        }
        "s" | "strike" | "del" => {
            result.push_str("~~");
            result.push_str(&children_to_markdown(elem));
            result.push_str("~~");
        }
        "code" => {
            result.push('`');
            result.push_str(&children_to_markdown(elem));
            result.push('`');
        }
        "pre" => {
            result.push_str("```\n");
            result.push_str(&children_to_markdown(elem));
            result.push_str("\n```\n\n");
        }
        "a" => {
            let href = elem.value().attr("href").unwrap_or("#");
            result.push('[');
            result.push_str(&children_to_markdown(elem));
            result.push_str("](");
            result.push_str(href);
            result.push(')');
        }
        "img" => {
            let src = elem.value().attr("src").unwrap_or("");
            let alt = elem.value().attr("alt").unwrap_or("");
            result.push_str(&format!("![{}]({})", alt, src));
        }
        "ul" => {
            for child in elem.children() {
                if let Some(li) = scraper::ElementRef::wrap(child) {
                    if li.value().name() == "li" {
                        result.push_str("- ");
                        result.push_str(children_to_markdown(&li).trim());
                        result.push('\n');
                    }
                }
            }
            result.push('\n');
        }
        "ol" => {
            let mut idx = 1;
            for child in elem.children() {
                if let Some(li) = scraper::ElementRef::wrap(child) {
                    if li.value().name() == "li" {
                        result.push_str(&format!("{}. ", idx));
                        result.push_str(children_to_markdown(&li).trim());
                        result.push('\n');
                        idx += 1;
                    }
                }
            }
            result.push('\n');
        }
        "blockquote" => {
            for line in children_to_markdown(elem).lines() {
                result.push_str("> ");
                result.push_str(line);
                result.push('\n');
            }
            result.push('\n');
        }
        "hr" => {
            result.push_str("---\n\n");
        }
        "br" => {
            result.push_str("  \n");
        }
        "table" => {
            result.push_str(&table_to_markdown(elem));
            result.push('\n');
        }
        _ => {
            // Unknown tag: just process children
            result.push_str(&children_to_markdown(elem));
        }
    }

    result
}

fn children_to_markdown(elem: &scraper::ElementRef) -> String {
    let mut result = String::new();

    for child in elem.children() {
        if let Some(child_elem) = scraper::ElementRef::wrap(child) {
            result.push_str(&element_to_markdown(&child_elem));
        } else if let scraper::Node::Text(t) = child.value() {
            result.push_str(t);
        }
    }

    result
}

fn table_to_markdown(table: &scraper::ElementRef) -> String {
    let mut result = String::new();
    let mut rows: Vec<Vec<String>> = Vec::new();
    let mut max_cols = 0;

    // Extract all rows
    let tr_selector = Selector::parse("tr").unwrap();
    let th_selector = Selector::parse("th").unwrap();
    let td_selector = Selector::parse("td").unwrap();

    for tr in table.select(&tr_selector) {
        let mut row: Vec<String> = Vec::new();

        // Try headers first, then cells
        for th in tr.select(&th_selector) {
            row.push(children_to_markdown(&th).trim().to_string());
        }
        for td in tr.select(&td_selector) {
            row.push(children_to_markdown(&td).trim().to_string());
        }

        if !row.is_empty() {
            max_cols = max_cols.max(row.len());
            rows.push(row);
        }
    }

    if rows.is_empty() {
        return result;
    }

    // Pad rows to max_cols
    for row in &mut rows {
        while row.len() < max_cols {
            row.push(String::new());
        }
    }

    // Generate markdown table
    for (i, row) in rows.iter().enumerate() {
        result.push('|');
        for cell in row {
            result.push(' ');
            result.push_str(cell);
            result.push_str(" |");
        }
        result.push('\n');

        // Add separator after header row
        if i == 0 {
            result.push('|');
            for _ in 0..max_cols {
                result.push_str(" --- |");
            }
            result.push('\n');
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_html_to_text() {
        let html = "<html><body><p>Hello</p><p>World</p></body></html>";
        let text = html_to_text(html).unwrap();
        assert!(text.contains("Hello"));
        assert!(text.contains("World"));
    }

    #[test]
    fn test_html_to_markdown_heading() {
        let html = "<h1>Title</h1>";
        let md = html_to_markdown_impl(html);
        assert!(md.contains("# Title"));
    }

    #[test]
    fn test_html_to_markdown_bold() {
        let html = "<strong>bold</strong>";
        let md = html_to_markdown_impl(html);
        assert!(md.contains("**bold**"));
    }
}
