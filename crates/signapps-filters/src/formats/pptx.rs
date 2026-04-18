//! PPTX filter — imports Microsoft PowerPoint presentations.
//!
//! Import reads the ZIP archive and parses `ppt/slides/slide{N}.xml` files,
//! extracting text content from `<a:t>` tags.
//! Export is not supported (the signapps-docs presentation module handles that).

use std::io::{Cursor, Read};

use crate::error::{FilterError, FilterResult};
use crate::intermediate::{
    DocBody, DocMetadata, DocNode, DocType, InlineMarks, InlineNode, IntermediateDocument,
    MasterData, SlideData, SlideElement,
};
use crate::traits::FilterTrait;

/// Imports PPTX files into `IntermediateDocument` (import only).
///
/// Reads slide XML files from the ZIP archive and extracts text content.
/// The first text element on each slide becomes a `Title`, subsequent
/// text elements become `TextBlock` elements.
///
/// Export is not supported — use the signapps-docs presentation module.
pub struct PptxFilter;

impl FilterTrait for PptxFilter {
    fn name(&self) -> &str {
        "PPTX Filter"
    }

    fn mime_types(&self) -> &[&str] {
        &["application/vnd.openxmlformats-officedocument.presentationml.presentation"]
    }

    fn extensions(&self) -> &[&str] {
        &["pptx"]
    }

    fn can_export(&self) -> bool {
        false
    }

    fn import(&self, bytes: &[u8]) -> FilterResult<IntermediateDocument> {
        let cursor = Cursor::new(bytes);
        let mut archive = zip::ZipArchive::new(cursor)
            .map_err(|e| FilterError::ImportFailed(format!("invalid ZIP archive: {e}")))?;

        // Collect slide file names in order
        let mut slide_names: Vec<String> = Vec::new();
        for i in 0..archive.len() {
            let file = archive
                .by_index(i)
                .map_err(|e| FilterError::ImportFailed(format!("ZIP entry error: {e}")))?;
            let name = file.name().to_string();
            if name.starts_with("ppt/slides/slide") && name.ends_with(".xml") {
                slide_names.push(name);
            }
        }

        // Sort numerically by slide number
        slide_names.sort_by(|a, b| {
            let num_a = extract_slide_number(a);
            let num_b = extract_slide_number(b);
            num_a.cmp(&num_b)
        });

        let mut slides = Vec::new();
        for slide_name in &slide_names {
            let xml = read_zip_entry(&mut archive, slide_name)?;
            let slide = parse_slide_xml(&xml);
            slides.push(slide);
        }

        Ok(IntermediateDocument {
            doc_type: DocType::Presentation,
            metadata: DocMetadata::default(),
            body: DocBody::Presentation {
                slides,
                master: Some(MasterData {
                    background_color: None,
                    font_family: None,
                    accent_color: None,
                }),
            },
        })
    }

    fn export(&self, _doc: &IntermediateDocument) -> FilterResult<Vec<u8>> {
        Err(FilterError::UnsupportedFormat(
            "PPTX export is not supported (use signapps-docs presentation module)".to_string(),
        ))
    }

    fn export_mime_type(&self) -> &str {
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    }

    fn export_extension(&self) -> &str {
        "pptx"
    }
}

/// Read a file entry from a ZIP archive.
fn read_zip_entry(
    archive: &mut zip::ZipArchive<Cursor<&[u8]>>,
    name: &str,
) -> FilterResult<String> {
    let mut file = archive
        .by_name(name)
        .map_err(|e| FilterError::ImportFailed(format!("missing {name} in PPTX: {e}")))?;
    let mut content = String::new();
    file.read_to_string(&mut content)
        .map_err(|e| FilterError::ImportFailed(format!("cannot read {name}: {e}")))?;
    Ok(content)
}

/// Extract the slide number from a filename like "ppt/slides/slide3.xml".
fn extract_slide_number(name: &str) -> u32 {
    let stem = name
        .trim_start_matches("ppt/slides/slide")
        .trim_end_matches(".xml");
    stem.parse::<u32>().unwrap_or(0)
}

/// Parse a single slide's XML and extract text elements.
fn parse_slide_xml(xml: &str) -> SlideData {
    let texts = extract_text_runs(xml);

    let mut elements = Vec::new();
    let mut is_first = true;

    for text in texts {
        if text.trim().is_empty() {
            continue;
        }

        if is_first {
            elements.push(SlideElement::Title {
                text: text.to_string(),
            });
            is_first = false;
        } else {
            elements.push(SlideElement::TextBlock {
                content: vec![DocNode::Paragraph {
                    content: vec![InlineNode {
                        text: text.to_string(),
                        marks: InlineMarks::default(),
                    }],
                    style: None,
                }],
                x: 0.0,
                y: 0.0,
                width: 100.0,
                height: 50.0,
            });
        }
    }

    SlideData {
        layout: "blank".to_string(),
        elements,
        notes: None,
        transition: None,
    }
}

/// Extract all text runs (`<a:t>` tags) from the XML.
///
/// Groups text by shape/text frame — concatenates `<a:t>` within
/// the same `<a:p>` paragraph, and separates `<a:p>` blocks with newlines
/// within the same `<p:txBody>`. Different `<p:txBody>` elements become
/// separate text entries.
fn extract_text_runs(xml: &str) -> Vec<String> {
    let mut results = Vec::new();
    let mut pos = 0;

    // Find each <p:txBody> block
    while let Some(body_start) = xml[pos..].find("<p:txBody") {
        let abs_start = pos + body_start;
        if let Some(body_end) = xml[abs_start..].find("</p:txBody>") {
            let abs_end = abs_start + body_end + "</p:txBody>".len();
            let body_xml = &xml[abs_start..abs_end];

            let text = extract_paragraphs_text(body_xml);
            if !text.is_empty() {
                results.push(text);
            }
            pos = abs_end;
        } else {
            break;
        }
    }

    results
}

/// Extract text from `<a:p>` paragraphs within a `<p:txBody>`.
fn extract_paragraphs_text(body_xml: &str) -> String {
    let mut paragraphs = Vec::new();
    let mut pos = 0;

    while let Some(p_start) = body_xml[pos..].find("<a:p>").or_else(|| body_xml[pos..].find("<a:p "))
    {
        let abs_start = pos + p_start;
        if let Some(p_end) = body_xml[abs_start..].find("</a:p>") {
            let abs_end = abs_start + p_end + "</a:p>".len();
            let para_xml = &body_xml[abs_start..abs_end];

            let text = extract_a_t_tags(para_xml);
            if !text.is_empty() {
                paragraphs.push(text);
            }
            pos = abs_end;
        } else {
            break;
        }
    }

    paragraphs.join("\n")
}

/// Extract and concatenate all `<a:t>` tag contents within an XML fragment.
fn extract_a_t_tags(xml: &str) -> String {
    let mut text = String::new();
    let mut pos = 0;

    while let Some(t_start) = xml[pos..].find("<a:t>").or_else(|| xml[pos..].find("<a:t ")) {
        let abs_start = pos + t_start;
        // Find end of opening tag
        if let Some(tag_end) = xml[abs_start..].find('>') {
            let content_start = abs_start + tag_end + 1;
            if let Some(t_end) = xml[content_start..].find("</a:t>") {
                text.push_str(&xml[content_start..content_start + t_end]);
                pos = content_start + t_end + "</a:t>".len();
            } else {
                break;
            }
        } else {
            break;
        }
    }

    text
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn export_returns_unsupported() {
        let doc = IntermediateDocument {
            doc_type: DocType::Presentation,
            metadata: DocMetadata::default(),
            body: DocBody::Presentation {
                slides: Vec::new(),
                master: None,
            },
        };

        let filter = PptxFilter;
        assert!(!filter.can_export());
        let result = filter.export(&doc);
        assert!(result.is_err());
    }

    #[test]
    fn extract_slide_number_parsing() {
        assert_eq!(extract_slide_number("ppt/slides/slide1.xml"), 1);
        assert_eq!(extract_slide_number("ppt/slides/slide12.xml"), 12);
        assert_eq!(extract_slide_number("ppt/slides/slideBad.xml"), 0);
    }

    #[test]
    fn extract_a_t_tags_basic() {
        let xml = r#"<a:r><a:t>Hello</a:t></a:r><a:r><a:t> World</a:t></a:r>"#;
        assert_eq!(extract_a_t_tags(xml), "Hello World");
    }

    #[test]
    fn parse_slide_xml_creates_elements() {
        let xml = r#"
        <p:sld>
            <p:cSld>
                <p:spTree>
                    <p:sp>
                        <p:txBody>
                            <a:p><a:r><a:t>Slide Title</a:t></a:r></a:p>
                        </p:txBody>
                    </p:sp>
                    <p:sp>
                        <p:txBody>
                            <a:p><a:r><a:t>Bullet point text</a:t></a:r></a:p>
                        </p:txBody>
                    </p:sp>
                </p:spTree>
            </p:cSld>
        </p:sld>"#;

        let slide = parse_slide_xml(xml);
        assert_eq!(slide.elements.len(), 2);
        assert!(matches!(&slide.elements[0], SlideElement::Title { text } if text == "Slide Title"));
        assert!(matches!(&slide.elements[1], SlideElement::TextBlock { .. }));
    }
}
