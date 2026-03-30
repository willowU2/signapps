//! DOCX generation from HTML.

use super::comments::Comment;
use super::ConversionError;
use docx_rs::*;
use scraper::{Html, Selector};

/// Convert HTML to DOCX
pub fn html_to_docx(html: &str) -> Result<Vec<u8>, ConversionError> {
    html_to_docx_with_comments(html, &[])
}

/// Convert HTML to DOCX with comments appendix
pub fn html_to_docx_with_comments(
    html: &str,
    comments: &[Comment],
) -> Result<Vec<u8>, ConversionError> {
    let document = Html::parse_document(html);
    let body_selector = Selector::parse("body").expect("valid CSS selector");

    let body = document
        .select(&body_selector)
        .next()
        .ok_or_else(|| ConversionError::InvalidInput("No body element found".to_string()))?;

    let mut docx = Docx::new();

    // Process body children
    for child in body.children() {
        if let Some(elem) = scraper::ElementRef::wrap(child) {
            process_element(&mut docx, &elem)?;
        }
    }

    // Add comments appendix if there are comments
    if !comments.is_empty() {
        docx = add_comments_appendix(docx, comments);
    }

    // Generate DOCX bytes
    let mut buffer = Vec::new();
    docx.build()
        .pack(&mut std::io::Cursor::new(&mut buffer))
        .map_err(|e| {
            ConversionError::ConversionFailed(format!("Failed to generate DOCX: {}", e))
        })?;

    Ok(buffer)
}

/// Add a comments appendix section to the document
fn add_comments_appendix(mut docx: Docx, comments: &[Comment]) -> Docx {
    // Page break before comments
    let page_break = Paragraph::new().add_run(Run::new().add_break(BreakType::Page));
    docx = docx.add_paragraph(page_break);

    // Header "Comments"
    let header = Paragraph::new().add_run(
        Run::new().add_text("Commentaires").bold().size(36), // 18pt
    );
    docx = docx.add_paragraph(header);

    // Add each comment
    for (index, comment) in comments.iter().enumerate() {
        // Comment header with author and date
        let status = if comment.resolved { " [Résolu]" } else { "" };
        let comment_header = Paragraph::new()
            .add_run(
                Run::new()
                    .add_text(format!(
                        "{}. {} - {}{}",
                        index + 1,
                        comment.author,
                        format_date(&comment.created_at),
                        status
                    ))
                    .bold()
                    .size(22), // 11pt
            )
            .indent(Some(360), None, None, None);
        docx = docx.add_paragraph(comment_header);

        // Comment content
        let comment_content = Paragraph::new()
            .add_run(Run::new().add_text(&comment.content).size(22))
            .indent(Some(720), None, None, None);
        docx = docx.add_paragraph(comment_content);

        // Add replies
        for reply in &comment.replies {
            let reply_para = Paragraph::new()
                .add_run(
                    Run::new()
                        .add_text(format!(
                            "↳ {} ({}): {}",
                            reply.author,
                            format_date(&reply.created_at),
                            reply.content
                        ))
                        .size(20) // 10pt
                        .italic(),
                )
                .indent(Some(1080), None, None, None);
            docx = docx.add_paragraph(reply_para);
        }

        // Spacing between comments
        let spacer = Paragraph::new();
        docx = docx.add_paragraph(spacer);
    }

    docx
}

/// Format ISO date string to readable format
fn format_date(iso_date: &str) -> String {
    // Try to parse ISO 8601 date
    chrono::DateTime::parse_from_rfc3339(iso_date)
        .map(|dt| dt.format("%d/%m/%Y %H:%M").to_string())
        .unwrap_or_else(|_| iso_date.to_string())
}

fn process_element(docx: &mut Docx, elem: &scraper::ElementRef) -> Result<(), ConversionError> {
    let tag = elem.value().name();

    match tag {
        "h1" | "h2" | "h3" | "h4" | "h5" | "h6" => {
            let level = tag
                .chars()
                .last()
                .expect("heading tag has last char")
                .to_digit(10)
                .expect("heading tag ends with digit") as usize;
            let text = extract_text_content(elem);
            let para = create_heading_paragraph(&text, level);
            *docx = std::mem::take(docx).add_paragraph(para);
        },
        "p" => {
            let para = create_paragraph_from_element(elem)?;
            *docx = std::mem::take(docx).add_paragraph(para);
        },
        "ul" | "ol" => {
            let is_ordered = tag == "ol";
            process_list(docx, elem, is_ordered, 0)?;
        },
        "blockquote" => {
            let text = extract_text_content(elem);
            let para = Paragraph::new()
                .add_run(Run::new().add_text(&text).italic())
                .indent(Some(720), None, None, None); // 0.5 inch indent
            *docx = std::mem::take(docx).add_paragraph(para);
        },
        "pre" => {
            let text = extract_text_content(elem);
            // Create a code block style paragraph
            for line in text.lines() {
                let para = Paragraph::new()
                    .add_run(
                        Run::new()
                            .add_text(line)
                            .fonts(RunFonts::new().ascii("Courier New")),
                    )
                    .indent(Some(360), None, None, None);
                *docx = std::mem::take(docx).add_paragraph(para);
            }
        },
        "table" => {
            let table = create_table_from_element(elem)?;
            *docx = std::mem::take(docx).add_table(table);
        },
        "hr" => {
            // Add a horizontal rule as a paragraph with border
            let para = Paragraph::new();
            *docx = std::mem::take(docx).add_paragraph(para);
        },
        "div" => {
            // Check for page break
            if elem.value().attr("data-page-break").is_some() {
                let para = Paragraph::new().add_run(Run::new().add_break(BreakType::Page));
                *docx = std::mem::take(docx).add_paragraph(para);
            } else if elem.value().attr("data-toc").is_some() {
                // Table of Contents placeholder
                let para = Paragraph::new()
                    .add_run(Run::new().add_text("Table of Contents").bold().size(28));
                *docx = std::mem::take(docx).add_paragraph(para);
            } else {
                // Process children of div
                for child in elem.children() {
                    if let Some(child_elem) = scraper::ElementRef::wrap(child) {
                        process_element(docx, &child_elem)?;
                    }
                }
            }
        },
        "br" => {
            let para = Paragraph::new().add_run(Run::new().add_break(BreakType::TextWrapping));
            *docx = std::mem::take(docx).add_paragraph(para);
        },
        "img" => {
            // Images would need special handling with actual image data
            // For now, add alt text as placeholder
            let alt = elem.value().attr("alt").unwrap_or("[Image]");
            let para = Paragraph::new().add_run(Run::new().add_text(format!("[{}]", alt)));
            *docx = std::mem::take(docx).add_paragraph(para);
        },
        _ => {
            // For unknown elements, try to process children
            for child in elem.children() {
                if let Some(child_elem) = scraper::ElementRef::wrap(child) {
                    process_element(docx, &child_elem)?;
                }
            }
        },
    }

    Ok(())
}

fn create_heading_paragraph(text: &str, level: usize) -> Paragraph {
    let size = match level {
        1 => 48, // 24pt
        2 => 36, // 18pt
        3 => 28, // 14pt
        4 => 24, // 12pt
        5 => 22, // 11pt
        _ => 20, // 10pt
    };

    Paragraph::new().add_run(
        Run::new().add_text(text).bold().size(size * 2), // size is in half-points
    )
}

fn create_paragraph_from_element(elem: &scraper::ElementRef) -> Result<Paragraph, ConversionError> {
    let mut paragraph = Paragraph::new();

    // Check for text alignment, line height, and indent
    if let Some(style) = elem.value().attr("style") {
        if style.contains("text-align: center") {
            paragraph = paragraph.align(AlignmentType::Center);
        } else if style.contains("text-align: right") {
            paragraph = paragraph.align(AlignmentType::Right);
        } else if style.contains("text-align: justify") {
            paragraph = paragraph.align(AlignmentType::Both);
        }

        // Sprint 3: Line height support
        if let Some(line_height) = extract_line_height_from_style(style) {
            // DOCX line spacing: 240 twips = single line (100%)
            let spacing = (line_height * 240.0) as i32;
            paragraph = paragraph.line_spacing(LineSpacing::new().line(spacing));
        }

        // Sprint 3: Indent support
        if let Some(indent_px) = extract_margin_left_from_style(style) {
            // Convert px to twips (1 inch = 1440 twips, 1 inch ≈ 96px)
            let indent_twips = (indent_px as f32 * 1440.0 / 96.0) as i32;
            paragraph = paragraph.indent(Some(indent_twips), None, None, None);
        }
    }

    // Process inline content
    paragraph = process_inline_content(paragraph, elem)?;

    Ok(paragraph)
}

fn process_inline_content(
    mut paragraph: Paragraph,
    elem: &scraper::ElementRef,
) -> Result<Paragraph, ConversionError> {
    for child in elem.children() {
        match child.value() {
            scraper::Node::Text(text) => {
                let text_str: &str = text.as_ref();
                if !text_str.trim().is_empty() {
                    paragraph = paragraph.add_run(Run::new().add_text(text_str));
                }
            },
            scraper::Node::Element(_) => {
                if let Some(child_elem) = scraper::ElementRef::wrap(child) {
                    paragraph = process_inline_element(paragraph, &child_elem)?;
                }
            },
            _ => {},
        }
    }
    Ok(paragraph)
}

fn process_inline_element(
    mut paragraph: Paragraph,
    elem: &scraper::ElementRef,
) -> Result<Paragraph, ConversionError> {
    let tag = elem.value().name();
    let text = extract_text_content(elem);

    let mut run = Run::new().add_text(&text);

    match tag {
        "strong" | "b" => {
            run = run.bold();
        },
        "em" | "i" => {
            run = run.italic();
        },
        "u" => {
            run = run.underline("single");
        },
        "s" | "strike" | "del" => {
            run = run.strike();
        },
        "code" => {
            run = run.fonts(RunFonts::new().ascii("Courier New"));
        },
        "a" => {
            // Links - just show text with underline
            run = run.underline("single").color("0000FF");
        },
        "span" => {
            // Check for styling
            if let Some(style) = elem.value().attr("style") {
                if let Some(color) = extract_color_from_style(style) {
                    run = run.color(&color);
                }
                if let Some(font_size) = extract_font_size_from_style(style) {
                    run = run.size(font_size);
                }
            }
        },
        "mark" => {
            run = run.highlight("yellow");
        },
        "sub" => {
            run = run.vanish().size(16); // Smaller text for subscript
        },
        "sup" => {
            run = run.vanish().size(16); // Smaller text for superscript
        },
        "br" => {
            paragraph = paragraph.add_run(Run::new().add_break(BreakType::TextWrapping));
            return Ok(paragraph);
        },
        _ => {
            // For nested elements, recursively process
            return process_inline_content(paragraph, elem);
        },
    }

    paragraph = paragraph.add_run(run);
    Ok(paragraph)
}

fn process_list(
    docx: &mut Docx,
    elem: &scraper::ElementRef,
    is_ordered: bool,
    indent_level: usize,
) -> Result<(), ConversionError> {
    let li_selector = Selector::parse("li").expect("valid CSS selector");
    let mut item_number = 1;

    for li in elem.select(&li_selector) {
        // Only process direct children
        if li.parent().map(|p| p.id()) != Some(elem.id()) {
            continue;
        }

        let prefix = if is_ordered {
            format!("{}. ", item_number)
        } else {
            "• ".to_string()
        };

        let text = extract_text_content(&li);
        let indent = (indent_level + 1) * 360; // 0.25 inch per level

        let para = Paragraph::new()
            .add_run(Run::new().add_text(format!("{}{}", prefix, text)))
            .indent(Some(indent as i32), None, None, None);

        *docx = std::mem::take(docx).add_paragraph(para);

        // Check for nested lists
        let ul_selector = Selector::parse("ul").expect("valid CSS selector");
        let ol_selector = Selector::parse("ol").expect("valid CSS selector");

        for nested in li.select(&ul_selector) {
            process_list(docx, &nested, false, indent_level + 1)?;
        }
        for nested in li.select(&ol_selector) {
            process_list(docx, &nested, true, indent_level + 1)?;
        }

        item_number += 1;
    }

    Ok(())
}

fn create_table_from_element(elem: &scraper::ElementRef) -> Result<Table, ConversionError> {
    let tr_selector = Selector::parse("tr").expect("valid CSS selector");
    let th_selector = Selector::parse("th").expect("valid CSS selector");
    let td_selector = Selector::parse("td").expect("valid CSS selector");

    let mut rows: Vec<TableRow> = Vec::new();

    for tr in elem.select(&tr_selector) {
        let mut cells: Vec<TableCell> = Vec::new();

        // Process header cells
        for th in tr.select(&th_selector) {
            let text = extract_text_content(&th);
            let cell = TableCell::new()
                .add_paragraph(Paragraph::new().add_run(Run::new().add_text(&text).bold()));
            cells.push(cell);
        }

        // Process data cells
        for td in tr.select(&td_selector) {
            let text = extract_text_content(&td);
            let cell = TableCell::new()
                .add_paragraph(Paragraph::new().add_run(Run::new().add_text(&text)));
            cells.push(cell);
        }

        if !cells.is_empty() {
            rows.push(TableRow::new(cells));
        }
    }

    let table = Table::new(rows);
    Ok(table)
}

fn extract_text_content(elem: &scraper::ElementRef) -> String {
    let mut text = String::new();

    for node in elem.children() {
        match node.value() {
            scraper::Node::Text(t) => {
                text.push_str(t);
            },
            scraper::Node::Element(_) => {
                if let Some(child_elem) = scraper::ElementRef::wrap(node) {
                    text.push_str(&extract_text_content(&child_elem));
                }
            },
            _ => {},
        }
    }

    text
}

fn extract_color_from_style(style: &str) -> Option<String> {
    // Extract color: #RRGGBB or color: rgb(r,g,b)
    if let Some(start) = style.find("color:") {
        let rest = &style[start + 6..];
        let end = rest.find(';').unwrap_or(rest.len());
        let color_str = rest[..end].trim();

        if let Some(hex) = color_str.strip_prefix('#') {
            return Some(hex.to_string());
        } else if color_str.starts_with("rgb") {
            // Parse rgb(r, g, b)
            if let Some(rgb) = parse_rgb(color_str) {
                return Some(rgb);
            }
        }
    }
    None
}

fn extract_font_size_from_style(style: &str) -> Option<usize> {
    if let Some(start) = style.find("font-size:") {
        let rest = &style[start + 10..];
        let end = rest.find(';').unwrap_or(rest.len());
        let size_str = rest[..end].trim();

        // Parse pt value
        if let Some(pt) = size_str.strip_suffix("pt") {
            if let Ok(size) = pt.trim().parse::<f32>() {
                return Some((size * 2.0) as usize); // Convert to half-points
            }
        }
        // Parse px value (approximate conversion)
        if let Some(px) = size_str.strip_suffix("px") {
            if let Ok(size) = px.trim().parse::<f32>() {
                return Some((size * 1.5) as usize);
            }
        }
    }
    None
}

fn parse_rgb(rgb_str: &str) -> Option<String> {
    let start = rgb_str.find('(')?;
    let end = rgb_str.find(')')?;
    let values: Vec<&str> = rgb_str[start + 1..end].split(',').collect();

    if values.len() >= 3 {
        let r: u8 = values[0].trim().parse().ok()?;
        let g: u8 = values[1].trim().parse().ok()?;
        let b: u8 = values[2].trim().parse().ok()?;
        return Some(format!("{:02X}{:02X}{:02X}", r, g, b));
    }
    None
}

/// Extract line-height value from CSS style string
fn extract_line_height_from_style(style: &str) -> Option<f32> {
    if let Some(start) = style.find("line-height:") {
        let rest = &style[start + 12..];
        let end = rest.find(';').unwrap_or(rest.len());
        let value = rest[..end].trim();
        // Parse numeric value (e.g., "1.5", "2", "1.15")
        value.parse::<f32>().ok()
    } else {
        None
    }
}

/// Extract margin-left value in pixels from CSS style string
fn extract_margin_left_from_style(style: &str) -> Option<i32> {
    if let Some(start) = style.find("margin-left:") {
        let rest = &style[start + 12..];
        let end = rest.find(';').unwrap_or(rest.len());
        let value = rest[..end].trim();
        if let Some(px) = value.strip_suffix("px") {
            return px.trim().parse::<i32>().ok();
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_document() {
        let html = "<html><body><p>Hello World</p></body></html>";
        let result = html_to_docx(html);
        assert!(result.is_ok());
        assert!(!result.unwrap().is_empty());
    }

    #[test]
    fn test_heading() {
        let html = "<html><body><h1>Title</h1><p>Content</p></body></html>";
        let result = html_to_docx(html);
        assert!(result.is_ok());
    }

    #[test]
    fn test_formatting() {
        let html = "<html><body><p><strong>bold</strong> and <em>italic</em></p></body></html>";
        let result = html_to_docx(html);
        assert!(result.is_ok());
    }
}
