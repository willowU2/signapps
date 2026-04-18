//! PDF renderer -- converts drawing primitives to a PDF document.
//!
//! Uses `printpdf` to generate PDF pages. Supports basic shapes (Rect, Line, Text)
//! natively. Complex primitives (Path, Ellipse) are rendered via polygon approximation
//! or are skipped with a debug log.
//!
//! # Feature Gate
//!
//! This module is only available when the `pdf` feature is enabled:
//! ```toml
//! signapps-drawing = { path = "...", features = ["pdf"] }
//! ```

use printpdf::{BuiltinFont, Color, IndirectFontRef, Line as PdfLine, Mm, PdfDocument, Point, Rgb};

use crate::primitives::DrawPrimitive;

use super::{RenderError, RenderProcessor, RenderResult};

/// Default A4 page width in millimeters.
const A4_WIDTH_MM: f64 = 210.0;

/// Default A4 page height in millimeters.
const A4_HEIGHT_MM: f64 = 297.0;

/// PDF format renderer with configurable page dimensions.
///
/// Converts primitives to a single-page PDF document using `printpdf`.
/// Rect, Line, Text, and Ellipse primitives are rendered natively.
/// Path and Image primitives are skipped with a debug log.
///
/// # Coordinate System
///
/// The input primitives use a top-left origin (y increases downward),
/// while PDF uses a bottom-left origin (y increases upward). This renderer
/// handles the coordinate flip automatically.
///
/// # Examples
///
/// ```ignore
/// use signapps_drawing::render::pdf::PdfRenderer;
/// use signapps_drawing::render::RenderProcessor;
/// use signapps_drawing::primitives::DrawPrimitive;
/// use signapps_drawing::styles::ShapeStyle;
///
/// let renderer = PdfRenderer::a4();
/// let prims = vec![DrawPrimitive::Rect {
///     x: 10.0, y: 10.0, width: 100.0, height: 50.0,
///     style: ShapeStyle::new().with_fill("#3b82f6"),
///     corner_radius: 0.0,
/// }];
/// let pdf_bytes = renderer.render(&prims, 210.0, 297.0).unwrap();
/// assert!(!pdf_bytes.is_empty());
/// ```
pub struct PdfRenderer {
    /// Page width in millimeters.
    page_width_mm: f64,
    /// Page height in millimeters.
    page_height_mm: f64,
}

impl PdfRenderer {
    /// Create a PDF renderer with custom page dimensions in millimeters.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// use signapps_drawing::render::pdf::PdfRenderer;
    ///
    /// let renderer = PdfRenderer::new(210.0, 297.0); // A4
    /// ```
    pub fn new(page_width_mm: f64, page_height_mm: f64) -> Self {
        Self {
            page_width_mm,
            page_height_mm,
        }
    }

    /// Create a PDF renderer with A4 page dimensions (210 x 297 mm).
    ///
    /// # Examples
    ///
    /// ```ignore
    /// use signapps_drawing::render::pdf::PdfRenderer;
    ///
    /// let renderer = PdfRenderer::a4();
    /// ```
    pub fn a4() -> Self {
        Self::new(A4_WIDTH_MM, A4_HEIGHT_MM)
    }
}

/// Helper to create an `Mm` value from `f64`, casting to `f32`.
#[inline]
fn mm(val: f64) -> Mm {
    Mm(val as f32)
}

impl RenderProcessor for PdfRenderer {
    fn render(
        &self,
        primitives: &[DrawPrimitive],
        width: f64,
        height: f64,
    ) -> RenderResult<Vec<u8>> {
        let (doc, page_idx, layer_idx) = PdfDocument::new(
            "Drawing",
            mm(self.page_width_mm),
            mm(self.page_height_mm),
            "Layer 1",
        );

        // Add built-in font once, pass to renderer
        let font = doc
            .add_builtin_font(BuiltinFont::Helvetica)
            .map_err(|e| RenderError::Failed(format!("failed to add font: {e}")))?;

        let layer = doc.get_page(page_idx).get_layer(layer_idx);

        // Scale factor: map drawing coordinates to page mm
        let scale_x = self.page_width_mm / width;
        let scale_y = self.page_height_mm / height;

        for prim in primitives {
            render_primitive_to_pdf(&layer, prim, scale_x, scale_y, self.page_height_mm, &font);
        }

        tracing::debug!(
            prim_count = primitives.len(),
            page_w = self.page_width_mm,
            page_h = self.page_height_mm,
            "PDF rendering complete"
        );

        let pdf_bytes = doc
            .save_to_bytes()
            .map_err(|e| RenderError::Failed(format!("PDF save failed: {e}")))?;

        Ok(pdf_bytes)
    }

    fn mime_type(&self) -> &str {
        "application/pdf"
    }
}

/// Render a single primitive onto a PDF layer.
fn render_primitive_to_pdf(
    layer: &printpdf::PdfLayerReference,
    prim: &DrawPrimitive,
    scale_x: f64,
    scale_y: f64,
    page_height_mm: f64,
    font: &IndirectFontRef,
) {
    match prim {
        DrawPrimitive::Rect {
            x,
            y,
            width,
            height,
            style,
            ..
        } => {
            let pdf_x = x * scale_x;
            let pdf_y = page_height_mm - (y * scale_y) - (height * scale_y);
            let pdf_w = width * scale_x;
            let pdf_h = height * scale_y;

            // Build rectangle as a line polygon
            let points = vec![
                (Point::new(mm(pdf_x), mm(pdf_y)), false),
                (Point::new(mm(pdf_x + pdf_w), mm(pdf_y)), false),
                (Point::new(mm(pdf_x + pdf_w), mm(pdf_y + pdf_h)), false),
                (Point::new(mm(pdf_x), mm(pdf_y + pdf_h)), false),
            ];
            let line = PdfLine {
                points,
                is_closed: true,
            };

            if let Some(ref fill_color) = style.fill {
                if let Some(color) = parse_hex_color(fill_color) {
                    layer.set_fill_color(Color::Rgb(color));
                }
            }
            if let Some(ref stroke_color) = style.stroke {
                if let Some(color) = parse_hex_color(stroke_color) {
                    layer.set_outline_color(Color::Rgb(color));
                }
                layer.set_outline_thickness(style.stroke_width as f32);
            } else {
                layer.set_outline_thickness(0.0);
            }

            layer.add_line(line);
        },

        DrawPrimitive::Line {
            x1,
            y1,
            x2,
            y2,
            style,
        } => {
            let pdf_x1 = x1 * scale_x;
            let pdf_y1 = page_height_mm - (y1 * scale_y);
            let pdf_x2 = x2 * scale_x;
            let pdf_y2 = page_height_mm - (y2 * scale_y);

            if let Some(ref stroke_color) = style.stroke {
                if let Some(color) = parse_hex_color(stroke_color) {
                    layer.set_outline_color(Color::Rgb(color));
                }
            }
            layer.set_outline_thickness(style.stroke_width as f32);

            let points = vec![
                (Point::new(mm(pdf_x1), mm(pdf_y1)), false),
                (Point::new(mm(pdf_x2), mm(pdf_y2)), false),
            ];
            let line = PdfLine {
                points,
                is_closed: false,
            };
            layer.add_line(line);
        },

        DrawPrimitive::Text {
            x,
            y,
            text,
            font_size,
            ..
        } => {
            let pdf_x = x * scale_x;
            let pdf_y = page_height_mm - (y * scale_y);

            layer.use_text(text.as_str(), *font_size as f32, mm(pdf_x), mm(pdf_y), font);
        },

        DrawPrimitive::Ellipse {
            cx,
            cy,
            rx,
            ry,
            style,
            ..
        } => {
            // Approximate ellipse with a polygon (36 segments)
            let segments = 36;
            let points: Vec<(Point, bool)> = (0..segments)
                .map(|i| {
                    let angle = 2.0 * std::f64::consts::PI * (i as f64) / (segments as f64);
                    let px = (cx + rx * angle.cos()) * scale_x;
                    let py = page_height_mm - ((cy + ry * angle.sin()) * scale_y);
                    (Point::new(mm(px), mm(py)), false)
                })
                .collect();

            let line = PdfLine {
                points,
                is_closed: true,
            };

            if let Some(ref fill_color) = style.fill {
                if let Some(color) = parse_hex_color(fill_color) {
                    layer.set_fill_color(Color::Rgb(color));
                }
            }
            if let Some(ref stroke_color) = style.stroke {
                if let Some(color) = parse_hex_color(stroke_color) {
                    layer.set_outline_color(Color::Rgb(color));
                }
                layer.set_outline_thickness(style.stroke_width as f32);
            }

            layer.add_line(line);
        },

        DrawPrimitive::Path { .. } => {
            // Complex SVG paths require a full SVG path parser; skip silently
            tracing::debug!("Path primitive skipped in PDF (no SVG path parser)");
        },

        DrawPrimitive::Image { .. } => {
            // Image embedding requires reading the image data; skip silently
            tracing::debug!("Image primitive skipped in PDF (not yet implemented)");
        },

        DrawPrimitive::Group { children, .. } => {
            for child in children {
                render_primitive_to_pdf(layer, child, scale_x, scale_y, page_height_mm, font);
            }
        },
    }
}

/// Parse a hex color string (e.g. "#ff0000" or "#f00") to a printpdf Rgb color.
///
/// Returns `None` for invalid or non-hex color strings.
fn parse_hex_color(hex: &str) -> Option<Rgb> {
    let hex = hex.trim_start_matches('#');
    let (r, g, b) = match hex.len() {
        3 => {
            let r = u8::from_str_radix(&hex[0..1].repeat(2), 16).ok()?;
            let g = u8::from_str_radix(&hex[1..2].repeat(2), 16).ok()?;
            let b = u8::from_str_radix(&hex[2..3].repeat(2), 16).ok()?;
            (r, g, b)
        },
        6 => {
            let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
            let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
            let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
            (r, g, b)
        },
        _ => return None,
    };
    Some(Rgb::new(
        r as f32 / 255.0,
        g as f32 / 255.0,
        b as f32 / 255.0,
        None,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::styles::ShapeStyle;

    #[test]
    fn parse_hex_color_6_digit() {
        let color = parse_hex_color("#ff8000");
        assert!(color.is_some());
    }

    #[test]
    fn parse_hex_color_3_digit() {
        let color = parse_hex_color("#f80");
        assert!(color.is_some());
    }

    #[test]
    fn parse_hex_color_invalid() {
        assert!(parse_hex_color("not-a-color").is_none());
        assert!(parse_hex_color("#xyz").is_none());
    }

    #[test]
    fn pdf_renderer_produces_bytes() {
        let renderer = PdfRenderer::a4();
        let prims = vec![DrawPrimitive::Rect {
            x: 10.0,
            y: 10.0,
            width: 100.0,
            height: 50.0,
            style: ShapeStyle::new()
                .with_fill("#3b82f6")
                .with_stroke("#1e40af", 2.0),
            corner_radius: 0.0,
        }];
        let bytes = renderer.render(&prims, 400.0, 300.0).expect("render PDF");
        // PDF magic bytes: %PDF
        assert!(bytes.len() > 4);
        assert_eq!(&bytes[0..5], b"%PDF-");
    }

    #[test]
    fn pdf_renderer_empty_primitives() {
        let renderer = PdfRenderer::a4();
        let bytes = renderer
            .render(&[], 400.0, 300.0)
            .expect("render empty PDF");
        assert!(!bytes.is_empty());
        assert_eq!(&bytes[0..5], b"%PDF-");
    }

    #[test]
    fn pdf_mime_type() {
        let renderer = PdfRenderer::a4();
        assert_eq!(renderer.mime_type(), "application/pdf");
    }

    #[test]
    fn pdf_renderer_with_text() {
        let renderer = PdfRenderer::a4();
        let prims = vec![DrawPrimitive::Text {
            x: 50.0,
            y: 50.0,
            text: "Hello PDF".to_string(),
            font_size: 14.0,
            font_family: "sans-serif".to_string(),
            color: "#000000".to_string(),
            anchor: crate::styles::TextAnchor::Start,
        }];
        let bytes = renderer
            .render(&prims, 400.0, 300.0)
            .expect("render text PDF");
        assert!(!bytes.is_empty());
    }

    #[test]
    fn pdf_renderer_with_line() {
        let renderer = PdfRenderer::a4();
        let prims = vec![DrawPrimitive::Line {
            x1: 0.0,
            y1: 0.0,
            x2: 100.0,
            y2: 100.0,
            style: ShapeStyle::new().with_stroke("#000000", 2.0),
        }];
        let bytes = renderer
            .render(&prims, 400.0, 300.0)
            .expect("render line PDF");
        assert!(!bytes.is_empty());
    }

    #[test]
    fn pdf_renderer_with_ellipse() {
        let renderer = PdfRenderer::a4();
        let prims = vec![DrawPrimitive::Ellipse {
            cx: 100.0,
            cy: 100.0,
            rx: 50.0,
            ry: 30.0,
            style: ShapeStyle::new().with_fill("#10b981"),
        }];
        let bytes = renderer
            .render(&prims, 400.0, 300.0)
            .expect("render ellipse PDF");
        assert!(!bytes.is_empty());
    }
}
