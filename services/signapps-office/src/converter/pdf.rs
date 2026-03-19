//! PDF generation from HTML.

use super::ConversionError;
use printpdf::*;
use scraper::{Html, Selector};
use std::io::BufWriter;

/// Page dimensions in mm
const PAGE_WIDTH_MM: f32 = 210.0; // A4
const PAGE_HEIGHT_MM: f32 = 297.0;
const MARGIN_MM: f32 = 25.0;
const LINE_HEIGHT_MM: f32 = 5.0;

/// Font sizes in points
const FONT_SIZE_H1: f32 = 24.0;
const FONT_SIZE_H2: f32 = 18.0;
const FONT_SIZE_H3: f32 = 14.0;
const FONT_SIZE_NORMAL: f32 = 11.0;
const FONT_SIZE_CODE: f32 = 10.0;

/// Convert HTML to PDF
pub fn html_to_pdf(html: &str) -> Result<Vec<u8>, ConversionError> {
    let document = Html::parse_document(html);
    let body_selector = Selector::parse("body").unwrap();

    let body = document
        .select(&body_selector)
        .next()
        .ok_or_else(|| ConversionError::InvalidInput("No body element found".to_string()))?;

    // Create PDF document - printpdf 0.7 API
    let (doc, page1, layer1) =
        PdfDocument::new("Document", Mm(PAGE_WIDTH_MM), Mm(PAGE_HEIGHT_MM), "Layer 1");

    // Built-in fonts (no external font loading needed)
    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| ConversionError::ConversionFailed(format!("Failed to add font: {}", e)))?;

    let font_bold = doc
        .add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| ConversionError::ConversionFailed(format!("Failed to add font: {}", e)))?;

    let font_italic = doc
        .add_builtin_font(BuiltinFont::HelveticaOblique)
        .map_err(|e| ConversionError::ConversionFailed(format!("Failed to add font: {}", e)))?;

    let font_mono = doc
        .add_builtin_font(BuiltinFont::Courier)
        .map_err(|e| ConversionError::ConversionFailed(format!("Failed to add font: {}", e)))?;

    let mut state = PdfState {
        doc: &doc,
        current_page: page1,
        current_layer: layer1,
        font: font.clone(),
        font_bold: font_bold.clone(),
        font_italic: font_italic.clone(),
        font_mono: font_mono.clone(),
        y_position: PAGE_HEIGHT_MM - MARGIN_MM,
        page_count: 1,
    };

    // Process body content
    for child in body.children() {
        if let Some(elem) = scraper::ElementRef::wrap(child) {
            process_element_to_pdf(&mut state, &elem)?;
        }
    }

    // Save to bytes
    let mut buffer = BufWriter::new(Vec::new());
    doc.save(&mut buffer)
        .map_err(|e| ConversionError::ConversionFailed(format!("Failed to save PDF: {}", e)))?;

    buffer
        .into_inner()
        .map_err(|e| ConversionError::ConversionFailed(format!("Failed to get PDF bytes: {}", e)))
}

struct PdfState<'a> {
    doc: &'a PdfDocumentReference,
    current_page: PdfPageIndex,
    current_layer: PdfLayerIndex,
    font: IndirectFontRef,
    font_bold: IndirectFontRef,
    font_italic: IndirectFontRef,
    font_mono: IndirectFontRef,
    y_position: f32,
    page_count: usize,
}

impl<'a> PdfState<'a> {
    fn ensure_space(&mut self, height: f32) {
        if self.y_position - height < MARGIN_MM {
            self.new_page();
        }
    }

    fn new_page(&mut self) {
        let (page, layer) = self.doc.add_page(
            Mm(PAGE_WIDTH_MM),
            Mm(PAGE_HEIGHT_MM),
            format!("Layer {}", self.page_count + 1),
        );
        self.current_page = page;
        self.current_layer = layer;
        self.y_position = PAGE_HEIGHT_MM - MARGIN_MM;
        self.page_count += 1;
    }

    fn write_text(&mut self, text: &str, font_size: f32, font: &IndirectFontRef) {
        self.ensure_space(LINE_HEIGHT_MM);

        let layer = self
            .doc
            .get_page(self.current_page)
            .get_layer(self.current_layer);

        layer.use_text(text, font_size, Mm(MARGIN_MM), Mm(self.y_position), font);

        self.y_position -= LINE_HEIGHT_MM;
    }

    fn add_vertical_space(&mut self, mm: f32) {
        self.y_position -= mm;
        if self.y_position < MARGIN_MM {
            self.new_page();
        }
    }
}

fn process_element_to_pdf(
    state: &mut PdfState,
    elem: &scraper::ElementRef,
) -> Result<(), ConversionError> {
    let tag = elem.value().name();

    match tag {
        "h1" => {
            let text = extract_text(elem);
            state.add_vertical_space(LINE_HEIGHT_MM);
            state.write_text(&text, FONT_SIZE_H1, &state.font_bold.clone());
            state.add_vertical_space(LINE_HEIGHT_MM);
        },
        "h2" => {
            let text = extract_text(elem);
            state.add_vertical_space(LINE_HEIGHT_MM * 0.5);
            state.write_text(&text, FONT_SIZE_H2, &state.font_bold.clone());
            state.add_vertical_space(LINE_HEIGHT_MM * 0.5);
        },
        "h3" | "h4" | "h5" | "h6" => {
            let text = extract_text(elem);
            state.write_text(&text, FONT_SIZE_H3, &state.font_bold.clone());
            state.add_vertical_space(LINE_HEIGHT_MM * 0.25);
        },
        "p" => {
            let text = extract_text(elem);
            // Wrap text at approximately 80 characters per line
            for line in wrap_text(&text, 80) {
                state.write_text(&line, FONT_SIZE_NORMAL, &state.font.clone());
            }
            state.add_vertical_space(LINE_HEIGHT_MM * 0.5);
        },
        "ul" | "ol" => {
            let is_ordered = tag == "ol";
            let li_selector = Selector::parse("li").unwrap();
            let mut index = 1;

            for li in elem.select(&li_selector) {
                // Only direct children
                if li.parent().map(|p| p.id()) != Some(elem.id()) {
                    continue;
                }

                let text = extract_text(&li);
                let prefix = if is_ordered {
                    format!("{}. ", index)
                } else {
                    "• ".to_string()
                };

                let full_text = format!("    {}{}", prefix, text);
                for line in wrap_text(&full_text, 76) {
                    state.write_text(&line, FONT_SIZE_NORMAL, &state.font.clone());
                }
                index += 1;
            }
            state.add_vertical_space(LINE_HEIGHT_MM * 0.5);
        },
        "blockquote" => {
            let text = extract_text(elem);
            let font = state.font_italic.clone();
            for line in wrap_text(&format!("  \"{}\"", text), 76) {
                state.write_text(&line, FONT_SIZE_NORMAL, &font);
            }
            state.add_vertical_space(LINE_HEIGHT_MM * 0.5);
        },
        "pre" | "code" => {
            let text = extract_text(elem);
            let font = state.font_mono.clone();
            for line in text.lines() {
                state.write_text(line, FONT_SIZE_CODE, &font);
            }
            state.add_vertical_space(LINE_HEIGHT_MM * 0.5);
        },
        "table" => {
            // Simple table rendering
            let tr_selector = Selector::parse("tr").unwrap();
            let th_selector = Selector::parse("th").unwrap();
            let td_selector = Selector::parse("td").unwrap();

            for tr in elem.select(&tr_selector) {
                let mut row_text = String::new();

                for th in tr.select(&th_selector) {
                    row_text.push_str(&format!("[{}] ", extract_text(&th)));
                }
                for td in tr.select(&td_selector) {
                    row_text.push_str(&format!("{} | ", extract_text(&td)));
                }

                if !row_text.is_empty() {
                    state.write_text(&row_text, FONT_SIZE_NORMAL, &state.font.clone());
                }
            }
            state.add_vertical_space(LINE_HEIGHT_MM);
        },
        "hr" => {
            state.add_vertical_space(LINE_HEIGHT_MM);
            state.write_text(
                "─".repeat(50).as_str(),
                FONT_SIZE_NORMAL,
                &state.font.clone(),
            );
            state.add_vertical_space(LINE_HEIGHT_MM);
        },
        "br" => {
            state.add_vertical_space(LINE_HEIGHT_MM);
        },
        "div" => {
            for child in elem.children() {
                if let Some(child_elem) = scraper::ElementRef::wrap(child) {
                    process_element_to_pdf(state, &child_elem)?;
                }
            }
        },
        _ => {
            // Process children for unknown elements
            for child in elem.children() {
                if let Some(child_elem) = scraper::ElementRef::wrap(child) {
                    process_element_to_pdf(state, &child_elem)?;
                }
            }
        },
    }

    Ok(())
}

fn extract_text(elem: &scraper::ElementRef) -> String {
    let mut text = String::new();

    for node in elem.children() {
        match node.value() {
            scraper::Node::Text(t) => {
                text.push_str(t);
            },
            scraper::Node::Element(_) => {
                if let Some(child) = scraper::ElementRef::wrap(node) {
                    text.push_str(&extract_text(&child));
                }
            },
            _ => {},
        }
    }

    // Normalize whitespace
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn wrap_text(text: &str, max_chars: usize) -> Vec<String> {
    let mut lines = Vec::new();
    let mut current_line = String::new();

    for word in text.split_whitespace() {
        if current_line.is_empty() {
            current_line = word.to_string();
        } else if current_line.len() + 1 + word.len() <= max_chars {
            current_line.push(' ');
            current_line.push_str(word);
        } else {
            lines.push(current_line);
            current_line = word.to_string();
        }
    }

    if !current_line.is_empty() {
        lines.push(current_line);
    }

    if lines.is_empty() {
        lines.push(String::new());
    }

    lines
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_pdf() {
        let html = "<html><body><p>Hello World</p></body></html>";
        let result = html_to_pdf(html);
        assert!(result.is_ok());
        let bytes = result.unwrap();
        assert!(!bytes.is_empty());
        // Check PDF magic bytes
        assert_eq!(&bytes[0..4], b"%PDF");
    }

    #[test]
    fn test_pdf_with_headings() {
        let html = "<html><body><h1>Title</h1><h2>Subtitle</h2><p>Content</p></body></html>";
        let result = html_to_pdf(html);
        assert!(result.is_ok());
    }
}
