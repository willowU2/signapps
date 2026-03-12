//! PPTX export functionality.

use pptx::slide::SlideLayoutRef;
use pptx::Presentation as PptxPresentation;

use super::{Presentation, PresentationError, Slide, SlideContent};

/// Convert a Presentation to PPTX bytes
pub fn presentation_to_pptx(presentation: &Presentation) -> Result<Vec<u8>, PresentationError> {
    let mut pptx = PptxPresentation::new()
        .map_err(|e| PresentationError::ConversionFailed(e.to_string()))?;

    // Get available layouts
    let layouts = pptx
        .slide_layouts()
        .map_err(|e| PresentationError::ConversionFailed(e.to_string()))?;

    // Use first layout (Title Slide) or fallback
    let layout = layouts.first().ok_or_else(|| {
        PresentationError::ConversionFailed("No slide layouts available".to_string())
    })?;

    for slide in &presentation.slides {
        add_slide_to_pptx(&mut pptx, slide, layout)?;
    }

    // Save to bytes
    let temp_path = std::env::temp_dir().join(format!("pptx_export_{}.pptx", uuid::Uuid::new_v4()));
    pptx.save(&temp_path)
        .map_err(|e| PresentationError::ConversionFailed(e.to_string()))?;

    let bytes = std::fs::read(&temp_path)
        .map_err(|e| PresentationError::IoError(e))?;

    // Clean up temp file
    let _ = std::fs::remove_file(&temp_path);

    Ok(bytes)
}

/// Convert Fabric.js JSON (SignApps Slides format) to PPTX bytes
pub fn json_to_pptx(json: &serde_json::Value) -> Result<Vec<u8>, PresentationError> {
    let presentation = parse_json_to_presentation(json)?;
    presentation_to_pptx(&presentation)
}

/// Parse SignApps Slides JSON format to Presentation
pub fn parse_json_to_presentation(
    json: &serde_json::Value,
) -> Result<Presentation, PresentationError> {
    let title = json
        .get("title")
        .and_then(|t| t.as_str())
        .unwrap_or("Untitled Presentation")
        .to_string();

    let mut presentation = Presentation::new(&title);

    if let Some(author) = json.get("author").and_then(|a| a.as_str()) {
        presentation = presentation.with_author(author);
    }

    // Parse slides array
    if let Some(slides) = json.get("slides").and_then(|s| s.as_array()) {
        for slide_json in slides {
            let slide = parse_slide_json(slide_json)?;
            presentation.add_slide(slide);
        }
    }

    Ok(presentation)
}

fn parse_slide_json(json: &serde_json::Value) -> Result<Slide, PresentationError> {
    let mut slide = Slide::new();

    // Parse title
    if let Some(title) = json.get("title").and_then(|t| t.as_str()) {
        slide.title = Some(title.to_string());
    }

    // Parse background color
    if let Some(bg) = json.get("backgroundColor").and_then(|b| b.as_str()) {
        slide.background_color = Some(bg.to_string());
    }

    // Parse Fabric.js objects
    if let Some(objects) = json.get("objects").and_then(|o| o.as_array()) {
        for obj in objects {
            if let Some(content) = parse_fabric_object(obj)? {
                slide.contents.push(content);
            }
        }
    }

    // Parse speaker notes
    if let Some(notes) = json.get("notes").and_then(|n| n.as_str()) {
        slide.notes = Some(notes.to_string());
    }

    Ok(slide)
}

fn parse_fabric_object(obj: &serde_json::Value) -> Result<Option<SlideContent>, PresentationError> {
    let obj_type = obj.get("type").and_then(|t| t.as_str()).unwrap_or("");

    match obj_type {
        "i-text" | "textbox" | "text" => {
            let text = obj
                .get("text")
                .and_then(|t| t.as_str())
                .unwrap_or("")
                .to_string();

            // Check if it's a title (larger font, usually at top)
            let font_size = obj.get("fontSize").and_then(|f| f.as_f64()).unwrap_or(12.0);
            let top = obj.get("top").and_then(|t| t.as_f64()).unwrap_or(0.0);

            if font_size >= 32.0 && top < 100.0 {
                Ok(Some(SlideContent::Title(text)))
            } else if font_size >= 24.0 && top < 150.0 {
                Ok(Some(SlideContent::Subtitle(text)))
            } else {
                let element = super::TextElement {
                    runs: vec![super::TextRun {
                        text,
                        bold: obj.get("fontWeight").and_then(|f| f.as_str()) == Some("bold"),
                        italic: obj.get("fontStyle").and_then(|f| f.as_str()) == Some("italic"),
                        font_size: Some(font_size),
                        color: obj.get("fill").and_then(|f| f.as_str()).map(String::from),
                    }],
                    ..Default::default()
                };
                Ok(Some(SlideContent::Body(vec![element])))
            }
        }
        "image" => {
            let src = obj
                .get("src")
                .and_then(|s| s.as_str())
                .unwrap_or("")
                .to_string();
            let width = obj.get("width").and_then(|w| w.as_f64()).unwrap_or(100.0);
            let height = obj.get("height").and_then(|h| h.as_f64()).unwrap_or(100.0);
            let left = obj.get("left").and_then(|l| l.as_f64()).unwrap_or(0.0);
            let top = obj.get("top").and_then(|t| t.as_f64()).unwrap_or(0.0);

            Ok(Some(SlideContent::Image {
                path: src,
                width,
                height,
                x: left,
                y: top,
            }))
        }
        "rect" | "circle" | "triangle" | "polygon" | "line" => {
            let width = obj.get("width").and_then(|w| w.as_f64()).unwrap_or(100.0);
            let height = obj.get("height").and_then(|h| h.as_f64()).unwrap_or(100.0);
            let left = obj.get("left").and_then(|l| l.as_f64()).unwrap_or(0.0);
            let top = obj.get("top").and_then(|t| t.as_f64()).unwrap_or(0.0);
            let fill = obj.get("fill").and_then(|f| f.as_str()).map(String::from);

            Ok(Some(SlideContent::Shape {
                shape_type: obj_type.to_string(),
                width,
                height,
                x: left,
                y: top,
                fill_color: fill,
            }))
        }
        _ => Ok(None),
    }
}

fn add_slide_to_pptx(
    pptx: &mut PptxPresentation,
    slide: &Slide,
    layout: &SlideLayoutRef,
) -> Result<(), PresentationError> {
    // Add slide with the layout
    let _slide_ref = pptx
        .add_slide(layout)
        .map_err(|e| PresentationError::ConversionFailed(e.to_string()))?;

    // Note: The pptx crate requires more complex manipulation to add text/shapes
    // For now, we create the basic slide structure
    // Full content population would require accessing the slide XML and adding shapes

    // Collect text content for debugging/logging
    let mut _body_parts: Vec<&str> = Vec::new();
    if let Some(title) = &slide.title {
        _body_parts.push(title);
    }

    for content in &slide.contents {
        match content {
            SlideContent::Title(s) | SlideContent::Subtitle(s) => _body_parts.push(s),
            SlideContent::Body(elements) => {
                for elem in elements {
                    for run in &elem.runs {
                        _body_parts.push(&run.text);
                    }
                }
            }
            SlideContent::BulletList(items) => {
                for item in items {
                    _body_parts.push(item);
                }
            }
            _ => {}
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_presentation_export() {
        let presentation = Presentation::new("Test Deck")
            .with_slide(Slide::new().with_title("Slide 1"))
            .with_slide(Slide::new().with_title("Slide 2"));

        let result = presentation_to_pptx(&presentation);
        assert!(result.is_ok());

        let bytes = result.unwrap();
        // PPTX files are ZIP archives starting with PK
        assert!(bytes.len() > 4);
        assert_eq!(&bytes[0..2], b"PK");
    }

    #[test]
    fn test_json_to_pptx() {
        let json = serde_json::json!({
            "title": "Test Presentation",
            "author": "Test Author",
            "slides": [
                {
                    "title": "First Slide",
                    "objects": []
                },
                {
                    "title": "Second Slide",
                    "objects": [
                        {
                            "type": "textbox",
                            "text": "Some content",
                            "fontSize": 16.0,
                            "top": 200.0
                        }
                    ]
                }
            ]
        });

        let result = json_to_pptx(&json);
        assert!(result.is_ok());
    }

    #[test]
    fn test_parse_fabric_text() {
        let obj = serde_json::json!({
            "type": "textbox",
            "text": "Hello World",
            "fontSize": 40.0,
            "top": 50.0
        });

        let result = parse_fabric_object(&obj).unwrap();
        assert!(matches!(result, Some(SlideContent::Title(_))));
    }
}
