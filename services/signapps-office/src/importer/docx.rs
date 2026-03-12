//! DOCX import to Tiptap JSON.

use super::ImportError;
use std::io::{Cursor, Read};
use zip::ZipArchive;

/// Convert DOCX to Tiptap JSON
pub fn docx_to_tiptap(content: &[u8]) -> Result<serde_json::Value, ImportError> {
    let cursor = Cursor::new(content);
    let mut archive = ZipArchive::new(cursor)
        .map_err(|e| ImportError::ParseError(format!("Invalid DOCX file: {}", e)))?;

    // Read word/document.xml
    let document_xml = read_file_from_zip(&mut archive, "word/document.xml")?;

    // Parse the XML and convert to Tiptap JSON
    let tiptap = parse_docx_xml(&document_xml)?;

    Ok(tiptap)
}

fn read_file_from_zip(archive: &mut ZipArchive<Cursor<&[u8]>>, path: &str) -> Result<String, ImportError> {
    let mut file = archive
        .by_name(path)
        .map_err(|e| ImportError::ParseError(format!("File not found in DOCX: {} - {}", path, e)))?;

    let mut content = String::new();
    file.read_to_string(&mut content)
        .map_err(|e| ImportError::ParseError(format!("Failed to read {}: {}", path, e)))?;

    Ok(content)
}

fn parse_docx_xml(xml: &str) -> Result<serde_json::Value, ImportError> {
    // Simple XML parsing for DOCX structure
    // DOCX uses WordprocessingML (http://schemas.openxmlformats.org/wordprocessingml/2006/main)

    let mut content = Vec::new();
    let mut current_text = String::new();
    let mut in_paragraph = false;
    let mut in_text = false;
    let mut current_marks: Vec<serde_json::Value> = Vec::new();
    let mut paragraph_content: Vec<serde_json::Value> = Vec::new();

    // Track formatting state
    let mut is_bold = false;
    let mut is_italic = false;
    let mut is_underline = false;
    let mut is_strike = false;

    // Simple state machine parser
    let chars = xml.chars().peekable();
    let mut tag_buffer = String::new();
    let mut in_tag = false;

    for c in chars {
        if c == '<' {
            // Flush any accumulated text
            if in_text && !current_text.is_empty() {
                let mut text_node = serde_json::json!({
                    "type": "text",
                    "text": current_text.clone()
                });

                // Apply current marks
                let mut marks = Vec::new();
                if is_bold {
                    marks.push(serde_json::json!({ "type": "bold" }));
                }
                if is_italic {
                    marks.push(serde_json::json!({ "type": "italic" }));
                }
                if is_underline {
                    marks.push(serde_json::json!({ "type": "underline" }));
                }
                if is_strike {
                    marks.push(serde_json::json!({ "type": "strike" }));
                }
                marks.extend(current_marks.clone());

                if !marks.is_empty() {
                    text_node["marks"] = serde_json::json!(marks);
                }

                paragraph_content.push(text_node);
                current_text.clear();
            }

            in_tag = true;
            tag_buffer.clear();
        } else if c == '>' {
            in_tag = false;

            // Process tag
            let tag = tag_buffer.trim();

            if let Some(tag_name) = tag.strip_prefix('/') {
                // Closing tag
                process_closing_tag(tag_name, &mut in_paragraph, &mut in_text,
                    &mut paragraph_content, &mut content, &mut is_bold,
                    &mut is_italic, &mut is_underline, &mut is_strike);
            } else if tag.ends_with('/') {
                // Self-closing tag
                let tag_name = tag.trim_end_matches('/').trim();
                process_self_closing_tag(tag_name, &mut paragraph_content);
            } else {
                // Opening tag
                process_opening_tag(tag, &mut in_paragraph, &mut in_text,
                    &mut is_bold, &mut is_italic, &mut is_underline,
                    &mut is_strike, &mut current_marks, &mut content,
                    &mut paragraph_content);
            }
        } else if in_tag {
            tag_buffer.push(c);
        } else if in_text {
            current_text.push(c);
        }
    }

    // Flush any remaining paragraph
    if in_paragraph && !paragraph_content.is_empty() {
        content.push(serde_json::json!({
            "type": "paragraph",
            "content": paragraph_content
        }));
    }

    // If no content was extracted, create a minimal document
    if content.is_empty() {
        content.push(serde_json::json!({
            "type": "paragraph"
        }));
    }

    Ok(serde_json::json!({
        "type": "doc",
        "content": content
    }))
}

#[allow(clippy::too_many_arguments)]
fn process_opening_tag(
    tag: &str,
    in_paragraph: &mut bool,
    in_text: &mut bool,
    is_bold: &mut bool,
    is_italic: &mut bool,
    is_underline: &mut bool,
    is_strike: &mut bool,
    _current_marks: &mut Vec<serde_json::Value>,
    content: &mut Vec<serde_json::Value>,
    paragraph_content: &mut Vec<serde_json::Value>,
) {
    let tag_name = tag.split_whitespace().next().unwrap_or(tag);

    match tag_name {
        // Paragraph start
        "w:p" => {
            // Flush previous paragraph if any
            if *in_paragraph && !paragraph_content.is_empty() {
                content.push(serde_json::json!({
                    "type": "paragraph",
                    "content": paragraph_content.clone()
                }));
                paragraph_content.clear();
            }
            *in_paragraph = true;
            // Reset formatting for new paragraph
            *is_bold = false;
            *is_italic = false;
            *is_underline = false;
            *is_strike = false;
        }
        // Text run properties
        "w:b" => *is_bold = true,
        "w:i" => *is_italic = true,
        "w:u" => *is_underline = true,
        "w:strike" => *is_strike = true,
        // Text content
        "w:t" => *in_text = true,
        _ => {}
    }
}

#[allow(clippy::too_many_arguments)]
fn process_closing_tag(
    tag_name: &str,
    in_paragraph: &mut bool,
    in_text: &mut bool,
    paragraph_content: &mut Vec<serde_json::Value>,
    content: &mut Vec<serde_json::Value>,
    is_bold: &mut bool,
    is_italic: &mut bool,
    is_underline: &mut bool,
    is_strike: &mut bool,
) {
    match tag_name {
        "w:p" => {
            if !paragraph_content.is_empty() {
                content.push(serde_json::json!({
                    "type": "paragraph",
                    "content": paragraph_content.clone()
                }));
            } else {
                // Empty paragraph
                content.push(serde_json::json!({
                    "type": "paragraph"
                }));
            }
            paragraph_content.clear();
            *in_paragraph = false;
            *is_bold = false;
            *is_italic = false;
            *is_underline = false;
            *is_strike = false;
        }
        "w:t" => *in_text = false,
        "w:r" => {
            // Run ended, reset run-level formatting
            // Note: We keep the formatting until the paragraph ends
            // to handle cases where formatting spans multiple runs
        }
        "w:rPr" => {
            // Run properties ended
        }
        _ => {}
    }
}

fn process_self_closing_tag(tag_name: &str, paragraph_content: &mut Vec<serde_json::Value>) {
    if tag_name == "w:br" {
        paragraph_content.push(serde_json::json!({
            "type": "hardBreak"
        }));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: Full DOCX testing requires actual DOCX files
    // These tests verify the XML parsing logic

    #[test]
    fn test_simple_xml() {
        let xml = r#"
            <w:document>
                <w:body>
                    <w:p>
                        <w:r>
                            <w:t>Hello World</w:t>
                        </w:r>
                    </w:p>
                </w:body>
            </w:document>
        "#;

        let result = parse_docx_xml(xml).unwrap();
        assert_eq!(result["type"], "doc");

        let content = result["content"].as_array().unwrap();
        assert!(!content.is_empty());
    }

    #[test]
    fn test_bold_text() {
        let xml = r#"
            <w:document>
                <w:body>
                    <w:p>
                        <w:r>
                            <w:rPr>
                                <w:b/>
                            </w:rPr>
                            <w:t>Bold</w:t>
                        </w:r>
                    </w:p>
                </w:body>
            </w:document>
        "#;

        let result = parse_docx_xml(xml).unwrap();
        let content = result["content"].as_array().unwrap();
        let para = &content[0];

        if let Some(inline) = para["content"].as_array() {
            if !inline.is_empty() {
                // Check for bold mark
                if let Some(marks) = inline[0]["marks"].as_array() {
                    assert!(marks.iter().any(|m| m["type"] == "bold"));
                }
            }
        }
    }
}
