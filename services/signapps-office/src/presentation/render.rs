//! Slide rendering to SVG and PNG.
//!
//! Converts slide content to SVG format for vector output,
//! and can rasterize to PNG using resvg.

use super::{Presentation, PresentationError, Slide, SlideContent};

/// Slide dimensions (16:9 aspect ratio in pixels)
const SLIDE_WIDTH: f64 = 1920.0;
const SLIDE_HEIGHT: f64 = 1080.0;

/// Render a single slide to SVG string
pub fn slide_to_svg(slide: &Slide, slide_num: usize) -> Result<String, PresentationError> {
    let mut svg = String::new();

    // SVG header
    svg.push_str(&format!(
        r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="{}" height="{}"
     viewBox="0 0 {} {}">
"##,
        SLIDE_WIDTH, SLIDE_HEIGHT, SLIDE_WIDTH, SLIDE_HEIGHT
    ));

    // Background
    let bg_color = slide.background_color.as_deref().unwrap_or("#ffffff");
    svg.push_str(&format!(
        r##"  <rect width="100%" height="100%" fill="{}"/>
"##,
        escape_xml_attr(bg_color)
    ));

    // Content group
    svg.push_str("  <g>\n");

    let mut y_offset = 100.0;

    // Slide title
    if let Some(title) = &slide.title {
        svg.push_str(&format!(
            r##"    <text x="100" y="{}" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="#000000">{}</text>
"##,
            y_offset,
            escape_xml(title)
        ));
        y_offset += 100.0;
    }

    // Render slide contents
    for content in &slide.contents {
        match content {
            SlideContent::Title(text) => {
                svg.push_str(&format!(
                    r##"    <text x="100" y="{}" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="#000000">{}</text>
"##,
                    y_offset,
                    escape_xml(text)
                ));
                y_offset += 100.0;
            }
            SlideContent::Subtitle(text) => {
                svg.push_str(&format!(
                    r##"    <text x="100" y="{}" font-family="Arial, sans-serif" font-size="48" fill="#666666">{}</text>
"##,
                    y_offset,
                    escape_xml(text)
                ));
                y_offset += 70.0;
            }
            SlideContent::Body(elements) => {
                for element in elements {
                    for run in &element.runs {
                        let font_size = run.font_size.unwrap_or(36.0);
                        let fill_color = run.color.as_deref().unwrap_or("#000000");
                        let font_weight = if run.bold { "bold" } else { "normal" };
                        let font_style = if run.italic { "italic" } else { "normal" };

                        svg.push_str(&format!(
                            r##"    <text x="100" y="{}" font-family="Arial, sans-serif" font-size="{}" font-weight="{}" font-style="{}" fill="{}">{}</text>
"##,
                            y_offset,
                            font_size * 2.0, // Scale up for HD
                            font_weight,
                            font_style,
                            escape_xml_attr(fill_color),
                            escape_xml(&run.text)
                        ));
                        y_offset += font_size * 2.0 + 10.0;
                    }
                }
            }
            SlideContent::BulletList(items) => {
                for item in items {
                    svg.push_str(&format!(
                        r##"    <text x="100" y="{}" font-family="Arial, sans-serif" font-size="36" fill="#000000">• {}</text>
"##,
                        y_offset,
                        escape_xml(item)
                    ));
                    y_offset += 50.0;
                }
            }
            SlideContent::Shape {
                shape_type,
                width,
                height,
                x,
                y,
                fill_color,
            } => {
                let fill = fill_color.as_deref().unwrap_or("#3366cc");
                let (px, py) = scale_coords(*x, *y);
                let (pw, ph) = scale_size(*width, *height);

                match shape_type.as_str() {
                    "rect" => {
                        svg.push_str(&format!(
                            r##"    <rect x="{}" y="{}" width="{}" height="{}" fill="{}" stroke="#000000" stroke-width="2"/>
"##,
                            px, py, pw, ph, escape_xml_attr(fill)
                        ));
                    }
                    "circle" => {
                        let cx = px + pw / 2.0;
                        let cy = py + ph / 2.0;
                        let r = pw.min(ph) / 2.0;
                        svg.push_str(&format!(
                            r##"    <circle cx="{}" cy="{}" r="{}" fill="{}" stroke="#000000" stroke-width="2"/>
"##,
                            cx, cy, r, escape_xml_attr(fill)
                        ));
                    }
                    "triangle" => {
                        let p1 = format!("{},{}", px + pw / 2.0, py);
                        let p2 = format!("{},{}", px, py + ph);
                        let p3 = format!("{},{}", px + pw, py + ph);
                        svg.push_str(&format!(
                            r##"    <polygon points="{} {} {}" fill="{}" stroke="#000000" stroke-width="2"/>
"##,
                            p1, p2, p3, escape_xml_attr(fill)
                        ));
                    }
                    "line" => {
                        svg.push_str(&format!(
                            r##"    <line x1="{}" y1="{}" x2="{}" y2="{}" stroke="{}" stroke-width="3"/>
"##,
                            px,
                            py,
                            px + pw,
                            py + ph,
                            escape_xml_attr(fill)
                        ));
                    }
                    _ => {
                        // Default to rectangle for unknown shapes
                        svg.push_str(&format!(
                            r##"    <rect x="{}" y="{}" width="{}" height="{}" fill="{}" stroke="#000000" stroke-width="2"/>
"##,
                            px, py, pw, ph, escape_xml_attr(fill)
                        ));
                    }
                }
            }
            SlideContent::Image { path, width, height, x, y } => {
                let (px, py) = scale_coords(*x, *y);
                let (pw, ph) = scale_size(*width, *height);

                // If it's a data URL or HTTP URL, embed directly
                if path.starts_with("data:") || path.starts_with("http") {
                    svg.push_str(&format!(
                        r##"    <image x="{}" y="{}" width="{}" height="{}" href="{}"/>
"##,
                        px, py, pw, ph, escape_xml_attr(path)
                    ));
                } else {
                    // Placeholder for file paths
                    svg.push_str(&format!(
                        r##"    <rect x="{}" y="{}" width="{}" height="{}" fill="#cccccc" stroke="#666666" stroke-width="2"/>
    <text x="{}" y="{}" font-family="Arial" font-size="24" fill="#666666" text-anchor="middle">[Image]</text>
"##,
                        px,
                        py,
                        pw,
                        ph,
                        px + pw / 2.0,
                        py + ph / 2.0
                    ));
                }
            }
        }
    }

    // Add slide number
    svg.push_str(&format!(
        r##"    <text x="{}" y="{}" font-family="Arial, sans-serif" font-size="24" fill="#999999" text-anchor="end">{}</text>
"##,
        SLIDE_WIDTH - 50.0,
        SLIDE_HEIGHT - 30.0,
        slide_num
    ));

    svg.push_str("  </g>\n");
    svg.push_str("</svg>\n");

    Ok(svg)
}

/// Render a single slide to PNG bytes
pub fn slide_to_png(slide: &Slide, slide_num: usize) -> Result<Vec<u8>, PresentationError> {
    let svg_string = slide_to_svg(slide, slide_num)?;

    // Parse SVG
    let opt = usvg::Options::default();
    let tree = usvg::Tree::from_str(&svg_string, &opt)
        .map_err(|e| PresentationError::ConversionFailed(format!("SVG parse error: {}", e)))?;

    // Create pixmap
    let pixmap_size = tree.size().to_int_size();
    let mut pixmap = tiny_skia::Pixmap::new(pixmap_size.width(), pixmap_size.height())
        .ok_or_else(|| PresentationError::ConversionFailed("Failed to create pixmap".to_string()))?;

    // Fill with white background
    pixmap.fill(tiny_skia::Color::WHITE);

    // Render SVG
    resvg::render(&tree, tiny_skia::Transform::default(), &mut pixmap.as_mut());

    // Encode to PNG
    let png_data = pixmap.encode_png()
        .map_err(|e| PresentationError::ConversionFailed(format!("PNG encode error: {}", e)))?;

    Ok(png_data)
}

/// Export all slides as SVG strings
pub fn presentation_to_svgs(presentation: &Presentation) -> Result<Vec<String>, PresentationError> {
    presentation
        .slides
        .iter()
        .enumerate()
        .map(|(i, slide)| slide_to_svg(slide, i + 1))
        .collect()
}

/// Export all slides as PNG bytes
pub fn presentation_to_pngs(presentation: &Presentation) -> Result<Vec<Vec<u8>>, PresentationError> {
    presentation
        .slides
        .iter()
        .enumerate()
        .map(|(i, slide)| slide_to_png(slide, i + 1))
        .collect()
}

/// Scale fabric.js coordinates to SVG coordinates
fn scale_coords(x: f64, y: f64) -> (f64, f64) {
    // Fabric.js uses canvas pixels, scale to HD resolution
    // Assuming 960x540 fabric canvas → 1920x1080 SVG
    (x * 2.0, y * 2.0)
}

/// Scale fabric.js dimensions to SVG dimensions
fn scale_size(w: f64, h: f64) -> (f64, f64) {
    (w * 2.0, h * 2.0)
}

/// Escape XML text content
fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

/// Escape XML attribute value
fn escape_xml_attr(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_slide_to_svg() {
        let slide = Slide {
            title: Some("Test Slide".to_string()),
            contents: vec![
                SlideContent::Body(vec![]),
            ],
            notes: None,
            background_color: Some("#f0f0f0".to_string()),
            layout: SlideLayout::TitleAndContent,
        };

        let result = slide_to_svg(&slide, 1);
        assert!(result.is_ok());

        let svg = result.unwrap();
        assert!(svg.contains("Test Slide"));
        assert!(svg.contains("#f0f0f0"));
        assert!(svg.contains("1920"));
    }

    #[test]
    fn test_slide_to_png() {
        let slide = Slide {
            title: Some("PNG Test".to_string()),
            contents: vec![],
            notes: None,
            background_color: None,
            layout: SlideLayout::TitleAndContent,
        };

        let result = slide_to_png(&slide, 1);
        assert!(result.is_ok());

        let png = result.unwrap();
        // PNG magic bytes
        assert!(png.len() > 8);
        assert_eq!(&png[0..8], &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    }
}
