//! PDF operations: merge, split, text extraction, thumbnails.

use super::PdfError;
use printpdf::lopdf::{dictionary, Document, Object, ObjectId, Dictionary};
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
            }
            Err(e) => {
                tracing::warn!("Failed to extract text from page {}: {}", page_num, e);
            }
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
        let doc = Document::load_mem(pdf_data).map_err(|e| {
            PdfError::ParseError(format!("Failed to load PDF {}: {}", idx + 1, e))
        })?;
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
        }
        Object::Array(ref mut arr) => {
            for item in arr.iter_mut() {
                update_object_references(item, mapping);
            }
        }
        Object::Dictionary(ref mut dict) => {
            for (_, value) in dict.iter_mut() {
                update_object_references(value, mapping);
            }
        }
        Object::Stream(ref mut stream) => {
            for (_, value) in stream.dict.iter_mut() {
                update_object_references(value, mapping);
            }
        }
        _ => {}
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
                let _ = new_doc.delete_pages(&[*page_num]);
            }
        }

        // Save to bytes
        let mut buffer = Vec::new();
        new_doc.save_to(&mut Cursor::new(&mut buffer)).map_err(|e| {
            PdfError::OperationFailed(format!("Failed to save split PDF: {}", e))
        })?;

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
    if let Ok(trailer) = doc.trailer.get(b"Info") {
        if let Object::Reference(info_ref) = trailer {
            if let Ok(Object::Dictionary(info_dict)) = doc.get_object(*info_ref) {
                title = extract_string_from_dict(info_dict, b"Title");
                author = extract_string_from_dict(info_dict, b"Author");
                subject = extract_string_from_dict(info_dict, b"Subject");
                keywords = extract_string_from_dict(info_dict, b"Keywords");
                creator = extract_string_from_dict(info_dict, b"Creator");
                producer = extract_string_from_dict(info_dict, b"Producer");
            }
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
                    if let (Some(w), Some(h)) = (get_number(&media_box[2]), get_number(&media_box[3]))
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

#[cfg(test)]
mod tests {
    use super::*;

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
        doc.save_to(&mut Cursor::new(&mut buffer)).unwrap();
        buffer
    }

    #[test]
    fn test_get_pdf_info() {
        let pdf = create_test_pdf();
        let result = get_pdf_info(&pdf);
        assert!(result.is_ok());
        let info = result.unwrap();
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
