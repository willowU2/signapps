//! PDF operations: merge, split, text extraction, thumbnails.

#![allow(dead_code)]

use super::PdfError;
use crate::presentation::{Presentation, SlideContent};
use ::lopdf::{Dictionary, Document, Object, ObjectId};
use printpdf::{BuiltinFont, Color, Mm, PdfDocument, Rect, Rgb};
use std::collections::BTreeMap;
use std::io::Cursor;

/// Extract text content from a PDF
pub fn extract_text(pdf_data: &[u8]) -> Result<String, PdfError> {
    let doc = Document::load_mem(pdf_data)
        .map_err(|e| PdfError::ParseError(format!("Failed to load PDF: {}", e)))?;

    let mut text = String::new();
    let pages = doc.get_pages();

    for (page_num, _) in pages {
        match doc.extract_text(&[page_num]) {
            Ok(page_text) => {
                if !text.is_empty() {
                    text.push_str("\n\n--- Page ");
                    text.push_str(&page_num.to_string());
                    text.push_str(" ---\n\n");
                }
                text.push_str(&page_text);
            },
            Err(e) => {
                tracing::warn!("Failed to extract text from page {}: {}", page_num, e);
            },
        }
    }

    Ok(text)
}

/// Merge multiple PDF documents into one
/// Uses a simplified approach - concatenates page contents
pub fn merge_pdfs(pdf_files: &[&[u8]]) -> Result<Vec<u8>, PdfError> {
    if pdf_files.is_empty() {
        return Err(PdfError::InvalidInput("No PDF files provided".to_string()));
    }

    if pdf_files.len() == 1 {
        return Ok(pdf_files[0].to_vec());
    }

    // Load all documents first
    let mut documents: Vec<Document> = Vec::new();
    for (idx, pdf_data) in pdf_files.iter().enumerate() {
        let doc = Document::load_mem(pdf_data)
            .map_err(|e| PdfError::ParseError(format!("Failed to load PDF {}: {}", idx + 1, e)))?;
        documents.push(doc);
    }

    // Start with first document as base
    let mut merged_doc = documents.remove(0);
    let mut max_id = merged_doc.max_id;

    // Get the root catalog and pages reference from the first document
    let root_id = merged_doc
        .trailer
        .get(b"Root")
        .ok()
        .and_then(|r| {
            if let Object::Reference(id) = r {
                Some(*id)
            } else {
                None
            }
        })
        .ok_or_else(|| PdfError::ParseError("No Root in trailer".to_string()))?;

    let pages_ref = merged_doc
        .get_object(root_id)
        .ok()
        .and_then(|obj| {
            if let Object::Dictionary(dict) = obj {
                dict.get(b"Pages").ok().and_then(|p| {
                    if let Object::Reference(id) = p {
                        Some(*id)
                    } else {
                        None
                    }
                })
            } else {
                None
            }
        })
        .ok_or_else(|| PdfError::ParseError("No Pages in Root".to_string()))?;

    // Process each additional document
    for doc in documents {
        // Build a mapping from old object IDs to new ones
        let mut id_mapping: BTreeMap<ObjectId, ObjectId> = BTreeMap::new();

        // Clone all objects with new IDs
        for (old_id, object) in doc.objects.iter() {
            let new_id = (max_id + old_id.0, old_id.1);
            id_mapping.insert(*old_id, new_id);
            merged_doc.objects.insert(new_id, object.clone());
        }

        // Update max_id
        max_id += doc.max_id;

        // Update all references in the cloned objects
        for new_id in id_mapping.values() {
            if let Some(object) = merged_doc.objects.get_mut(new_id) {
                update_object_references(object, &id_mapping);
            }
        }

        // Get pages from source document and add to merged pages
        let source_pages = doc.get_pages();
        for (_, page_id) in source_pages {
            if let Some(new_page_id) = id_mapping.get(&page_id) {
                // Update the page's parent reference to point to merged pages
                if let Some(Object::Dictionary(ref mut page_dict)) =
                    merged_doc.objects.get_mut(new_page_id)
                {
                    page_dict.set("Parent", Object::Reference(pages_ref));
                }

                // Add the page to the merged pages Kids array
                if let Some(Object::Dictionary(ref mut pages_dict)) =
                    merged_doc.objects.get_mut(&pages_ref)
                {
                    if let Ok(Object::Array(ref mut kids)) = pages_dict.get_mut(b"Kids") {
                        kids.push(Object::Reference(*new_page_id));
                    }
                    // Update count
                    if let Ok(Object::Integer(ref mut count)) = pages_dict.get_mut(b"Count") {
                        *count += 1;
                    }
                }
            }
        }
    }

    merged_doc.max_id = max_id;

    // Save to bytes
    let mut buffer = Vec::new();
    merged_doc
        .save_to(&mut Cursor::new(&mut buffer))
        .map_err(|e| PdfError::OperationFailed(format!("Failed to save merged PDF: {}", e)))?;

    Ok(buffer)
}

/// Update object references in an object using the ID mapping
fn update_object_references(object: &mut Object, mapping: &BTreeMap<ObjectId, ObjectId>) {
    match object {
        Object::Reference(ref mut id) => {
            if let Some(new_id) = mapping.get(id) {
                *id = *new_id;
            }
        },
        Object::Array(ref mut arr) => {
            for item in arr.iter_mut() {
                update_object_references(item, mapping);
            }
        },
        Object::Dictionary(ref mut dict) => {
            for (_, value) in dict.iter_mut() {
                update_object_references(value, mapping);
            }
        },
        Object::Stream(ref mut stream) => {
            for (_, value) in stream.dict.iter_mut() {
                update_object_references(value, mapping);
            }
        },
        _ => {},
    }
}

/// Split a PDF into multiple documents by page ranges
pub fn split_pdf(pdf_data: &[u8], ranges: &[(u32, u32)]) -> Result<Vec<Vec<u8>>, PdfError> {
    let doc = Document::load_mem(pdf_data)
        .map_err(|e| PdfError::ParseError(format!("Failed to load PDF: {}", e)))?;

    let pages = doc.get_pages();
    let page_count = pages.len() as u32;

    // Validate ranges
    for (start, end) in ranges {
        if *start == 0 || *end == 0 {
            return Err(PdfError::InvalidInput(
                "Page numbers must be 1-based".to_string(),
            ));
        }
        if *start > page_count || *end > page_count {
            return Err(PdfError::InvalidInput(format!(
                "Page range ({}, {}) exceeds document page count {}",
                start, end, page_count
            )));
        }
        if *start > *end {
            return Err(PdfError::InvalidInput(format!(
                "Invalid range: start {} is greater than end {}",
                start, end
            )));
        }
    }

    let mut results = Vec::new();

    for (start, end) in ranges {
        let page_numbers: Vec<u32> = (*start..=*end).collect();
        let mut new_doc = doc.clone();

        // Delete pages not in the range
        let pages_to_keep: std::collections::HashSet<u32> = page_numbers.iter().cloned().collect();
        let all_pages: Vec<u32> = (1..=page_count).collect();

        for page_num in all_pages.iter().rev() {
            if !pages_to_keep.contains(page_num) {
                new_doc.delete_pages(&[*page_num]);
            }
        }

        // Save to bytes
        let mut buffer = Vec::new();
        new_doc
            .save_to(&mut Cursor::new(&mut buffer))
            .map_err(|e| PdfError::OperationFailed(format!("Failed to save split PDF: {}", e)))?;

        results.push(buffer);
    }

    Ok(results)
}

/// Extract a single page as a new PDF
pub fn extract_page(pdf_data: &[u8], page_num: u32) -> Result<Vec<u8>, PdfError> {
    split_pdf(pdf_data, &[(page_num, page_num)]).map(|mut v| {
        v.pop()
            .ok_or(PdfError::OperationFailed("No page extracted".to_string()))
    })?
}

/// Get PDF document information
#[derive(Debug, Clone, serde::Serialize)]
pub struct PdfInfo {
    pub page_count: usize,
    pub title: Option<String>,
    pub author: Option<String>,
    pub subject: Option<String>,
    pub keywords: Option<String>,
    pub creator: Option<String>,
    pub producer: Option<String>,
    pub version: String,
}

/// Get information about a PDF document
pub fn get_pdf_info(pdf_data: &[u8]) -> Result<PdfInfo, PdfError> {
    let doc = Document::load_mem(pdf_data)
        .map_err(|e| PdfError::ParseError(format!("Failed to load PDF: {}", e)))?;

    let pages = doc.get_pages();
    let page_count = pages.len();

    // Extract metadata from document info dictionary if present
    let mut title = None;
    let mut author = None;
    let mut subject = None;
    let mut keywords = None;
    let mut creator = None;
    let mut producer = None;

    // Try to get the Info dictionary
    if let Ok(Object::Reference(info_ref)) = doc.trailer.get(b"Info") {
        if let Ok(Object::Dictionary(info_dict)) = doc.get_object(*info_ref) {
            title = extract_string_from_dict(info_dict, b"Title");
            author = extract_string_from_dict(info_dict, b"Author");
            subject = extract_string_from_dict(info_dict, b"Subject");
            keywords = extract_string_from_dict(info_dict, b"Keywords");
            creator = extract_string_from_dict(info_dict, b"Creator");
            producer = extract_string_from_dict(info_dict, b"Producer");
        }
    }

    Ok(PdfInfo {
        page_count,
        title,
        author,
        subject,
        keywords,
        creator,
        producer,
        version: doc.version.to_string(),
    })
}

/// Extract a string value from a PDF dictionary
fn extract_string_from_dict(dict: &Dictionary, key: &[u8]) -> Option<String> {
    dict.get(key).ok().and_then(|obj| match obj {
        Object::String(bytes, _) => String::from_utf8(bytes.clone()).ok(),
        _ => None,
    })
}

/// Generate thumbnail data for each page (returns page dimensions and bounding boxes)
/// Note: Actual image rendering requires additional libraries (e.g., pdf-render, pdfium)
/// This function returns page metadata that can be used for thumbnail generation on the frontend
#[derive(Debug, Clone, serde::Serialize)]
pub struct PageInfo {
    pub page_number: u32,
    pub width: f32,
    pub height: f32,
}

/// Get page dimensions for all pages in a PDF
pub fn get_page_dimensions(pdf_data: &[u8]) -> Result<Vec<PageInfo>, PdfError> {
    let doc = Document::load_mem(pdf_data)
        .map_err(|e| PdfError::ParseError(format!("Failed to load PDF: {}", e)))?;

    let pages = doc.get_pages();
    let mut page_infos = Vec::new();

    for (page_num, page_id) in pages {
        let mut width = 612.0; // Default letter width in points
        let mut height = 792.0; // Default letter height in points

        // Try to get the MediaBox for page dimensions
        if let Ok(Object::Dictionary(page_dict)) = doc.get_object(page_id) {
            if let Ok(Object::Array(media_box)) = page_dict.get(b"MediaBox") {
                if media_box.len() >= 4 {
                    if let (Some(w), Some(h)) =
                        (get_number(&media_box[2]), get_number(&media_box[3]))
                    {
                        width = w;
                        height = h;
                    }
                }
            }
        }

        page_infos.push(PageInfo {
            page_number: page_num,
            width,
            height,
        });
    }

    Ok(page_infos)
}

/// Extract a number from a PDF object
fn get_number(obj: &Object) -> Option<f32> {
    match obj {
        Object::Integer(i) => Some(*i as f32),
        Object::Real(r) => Some(*r),
        _ => None,
    }
}

/// Generate PDF from presentation slides
pub fn generate_slides_pdf(presentation: &Presentation) -> Result<Vec<u8>, PdfError> {
    // Create PDF document (landscape A4: 297mm x 210mm)
    let (doc, page1, layer1) =
        PdfDocument::new(&presentation.title, Mm(297.0), Mm(210.0), "Layer 1");

    // Add built-in font
    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| PdfError::OperationFailed(e.to_string()))?;
    let font_bold = doc
        .add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| PdfError::OperationFailed(e.to_string()))?;

    let mut current_layer = doc.get_page(page1).get_layer(layer1);
    let mut is_first_page = true;

    for slide in &presentation.slides {
        if !is_first_page {
            // Add new page for each slide after the first
            let (page, layer) = doc.add_page(Mm(297.0), Mm(210.0), "Layer 1");
            current_layer = doc.get_page(page).get_layer(layer);
        }
        is_first_page = false;

        // Set background color if specified
        if let Some(bg_color) = &slide.background_color {
            if let Some(color) = parse_hex_color(bg_color) {
                current_layer.set_fill_color(color);
                current_layer.add_rect(Rect::new(Mm(0.0), Mm(0.0), Mm(297.0), Mm(210.0)));
            }
        }

        let mut y_position = 180.0; // Start from top (210 - 30 margin)

        // Render slide title if present
        if let Some(title) = &slide.title {
            current_layer.set_fill_color(Color::Rgb(Rgb::new(0.0, 0.0, 0.0, None)));
            current_layer.use_text(title, 28.0, Mm(20.0), Mm(y_position), &font_bold);
            y_position -= 15.0;
        }

        // Render slide contents
        for content in &slide.contents {
            match content {
                SlideContent::Title(text) => {
                    current_layer.set_fill_color(Color::Rgb(Rgb::new(0.0, 0.0, 0.0, None)));
                    current_layer.use_text(text, 28.0, Mm(20.0), Mm(y_position), &font_bold);
                    y_position -= 15.0;
                },
                SlideContent::Subtitle(text) => {
                    current_layer.set_fill_color(Color::Rgb(Rgb::new(0.3, 0.3, 0.3, None)));
                    current_layer.use_text(text, 20.0, Mm(20.0), Mm(y_position), &font);
                    y_position -= 12.0;
                },
                SlideContent::Body(elements) => {
                    for element in elements {
                        for run in &element.runs {
                            let font_to_use = if run.bold { &font_bold } else { &font };
                            let font_size = run.font_size.unwrap_or(14.0) as f32;

                            if let Some(color) = &run.color {
                                if let Some(c) = parse_hex_color(color) {
                                    current_layer.set_fill_color(c);
                                }
                            } else {
                                current_layer
                                    .set_fill_color(Color::Rgb(Rgb::new(0.0, 0.0, 0.0, None)));
                            }

                            current_layer.use_text(
                                &run.text,
                                font_size,
                                Mm(20.0),
                                Mm(y_position),
                                font_to_use,
                            );
                            y_position -= font_size / 2.0 + 4.0;
                        }
                    }
                },
                SlideContent::BulletList(items) => {
                    current_layer.set_fill_color(Color::Rgb(Rgb::new(0.0, 0.0, 0.0, None)));
                    for item in items {
                        let bullet_text = format!("• {}", item);
                        current_layer.use_text(&bullet_text, 14.0, Mm(25.0), Mm(y_position), &font);
                        y_position -= 8.0;
                    }
                },
                SlideContent::Shape {
                    shape_type: _,
                    width,
                    height,
                    x,
                    y,
                    fill_color,
                } => {
                    // Convert fabric coordinates to PDF coordinates
                    let pdf_x = Mm(20.0 + (*x as f32 / 10.0));
                    let pdf_y = Mm(y_position - (*y as f32 / 10.0));
                    let pdf_w = Mm(*width as f32 / 10.0);
                    let pdf_h = Mm(*height as f32 / 10.0);

                    if let Some(color) = fill_color {
                        if let Some(c) = parse_hex_color(color) {
                            current_layer.set_fill_color(c);
                        }
                    } else {
                        current_layer.set_fill_color(Color::Rgb(Rgb::new(0.2, 0.4, 0.8, None)));
                    }

                    let rect = Rect::new(pdf_x, pdf_y, pdf_x + pdf_w, pdf_y + pdf_h);
                    current_layer.add_rect(rect);
                },
                SlideContent::Image { .. } => {
                    // Image embedding requires loading the image file
                    // For now, we add a placeholder text
                    current_layer.set_fill_color(Color::Rgb(Rgb::new(0.5, 0.5, 0.5, None)));
                    current_layer.use_text("[Image]", 12.0, Mm(20.0), Mm(y_position), &font);
                    y_position -= 8.0;
                },
            }
        }

        // Add speaker notes at the bottom if present
        if let Some(notes) = &slide.notes {
            current_layer.set_fill_color(Color::Rgb(Rgb::new(0.5, 0.5, 0.5, None)));
            current_layer.use_text("Speaker Notes:", 10.0, Mm(20.0), Mm(25.0), &font_bold);
            current_layer.use_text(notes, 9.0, Mm(20.0), Mm(18.0), &font);
        }
    }

    // Save PDF to bytes
    let mut buffer = Vec::new();
    doc.save(&mut std::io::BufWriter::new(&mut buffer))
        .map_err(|e| PdfError::OperationFailed(format!("Failed to save PDF: {}", e)))?;

    Ok(buffer)
}

/// Parse hex color string to PDF color
fn parse_hex_color(hex: &str) -> Option<Color> {
    let hex = hex.trim_start_matches('#');
    if hex.len() < 6 {
        return None;
    }

    let r = u8::from_str_radix(&hex[0..2], 16).ok()? as f32 / 255.0;
    let g = u8::from_str_radix(&hex[2..4], 16).ok()? as f32 / 255.0;
    let b = u8::from_str_radix(&hex[4..6], 16).ok()? as f32 / 255.0;

    Some(Color::Rgb(Rgb::new(r, g, b, None)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::dictionary;

    // Create a minimal valid PDF for testing
    fn create_test_pdf() -> Vec<u8> {
        let mut doc = Document::new();
        doc.version = "1.4".to_string();

        // Create a minimal page
        let pages_id = doc.add_object(dictionary! {
            "Type" => "Pages",
            "Kids" => vec![],
            "Count" => 0,
        });

        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });

        doc.trailer.set("Root", Object::Reference(catalog_id));

        let mut buffer = Vec::new();
        doc.save_to(&mut Cursor::new(&mut buffer)).expect("PDF serialization should succeed");
        buffer
    }

    #[test]
    fn test_get_pdf_info() {
        let pdf = create_test_pdf();
        let result = get_pdf_info(&pdf);
        assert!(result.is_ok());
        let info = result.expect("get_pdf_info should succeed");
        assert_eq!(info.version, "1.4");
    }

    #[test]
    fn test_extract_text_empty_pdf() {
        let pdf = create_test_pdf();
        let result = extract_text(&pdf);
        assert!(result.is_ok());
    }

    #[test]
    fn test_merge_single_pdf() {
        let pdf = create_test_pdf();
        let result = merge_pdfs(&[&pdf]);
        assert!(result.is_ok());
    }

    #[test]
    fn test_merge_empty_list() {
        let result = merge_pdfs(&[]);
        assert!(result.is_err());
    }
}
