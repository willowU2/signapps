//! PPTX export functionality.
//!
//! Converts Presentation structure to PPTX (PowerPoint) format.

use super::{Presentation, PresentationError, Slide, SlideContent};

/// Convert a Presentation to PPTX bytes
pub fn presentation_to_pptx(presentation: &Presentation) -> Result<Vec<u8>, PresentationError> {
    super::pptx::generate_pptx(presentation)
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

    // Parse layout
    if let Some(layout) = json.get("layout").and_then(|l| l.as_str()) {
        slide.layout = super::SlideLayout::from_str(layout);
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
        },
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
        },
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
        },
        _ => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_presentation_export_success() {
        let presentation =
            Presentation::new("Test Deck").with_slide(Slide::new().with_title("Slide 1"));

        let result = presentation_to_pptx(&presentation);
        assert!(result.is_ok());

        let bytes = result.expect("presentation_to_pptx should succeed");
        // PPTX files are ZIP archives starting with PK
        assert!(bytes.len() > 4);
        assert_eq!(&bytes[0..2], b"PK");
    }

    #[test]
    fn test_parse_json_to_presentation() {
        let json = serde_json::json!({
            "title": "Test Presentation",
            "author": "Test Author",
            "slides": [
                {
                    "title": "First Slide",
                    "objects": []
                }
            ]
        });

        let result = parse_json_to_presentation(&json);
        assert!(result.is_ok());

        let presentation = result.expect("parse_json_to_presentation should succeed");
        assert_eq!(presentation.title, "Test Presentation");
        assert_eq!(presentation.slides.len(), 1);
    }

    #[test]
    fn test_parse_fabric_text() {
        let obj = serde_json::json!({
            "type": "textbox",
            "text": "Hello World",
            "fontSize": 40.0,
            "top": 50.0
        });

        let result = parse_fabric_object(&obj).expect("parse_fabric_object should succeed");
        assert!(matches!(result, Some(SlideContent::Title(_))));
    }
}
