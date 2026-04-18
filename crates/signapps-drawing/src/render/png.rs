//! PNG renderer -- rasterizes primitives via SVG → resvg/tiny-skia pipeline.
//!
//! This renderer first converts primitives to SVG (via [`SvgRenderer`]), then
//! parses the SVG with `usvg` and rasterizes it with `resvg`/`tiny-skia` to
//! produce PNG bytes.
//!
//! # Pipeline
//!
//! `DrawPrimitive[]` → SVG string → `usvg::Tree` → `tiny_skia::Pixmap` → PNG bytes
//!
//! # Feature Gate
//!
//! This module is only available when the `png` feature is enabled:
//! ```toml
//! signapps-drawing = { path = "...", features = ["png"] }
//! ```

use tiny_skia::Pixmap;
use usvg::{Options, Tree};

use crate::primitives::DrawPrimitive;
use crate::render::svg::SvgRenderer;

use super::{RenderError, RenderProcessor, RenderResult};

/// PNG format renderer with configurable DPI.
///
/// Converts primitives to SVG first, then rasterizes through the
/// `usvg` → `resvg` → `tiny-skia` pipeline.
///
/// # Examples
///
/// ```ignore
/// use signapps_drawing::render::png::PngRenderer;
/// use signapps_drawing::render::RenderProcessor;
/// use signapps_drawing::primitives::DrawPrimitive;
/// use signapps_drawing::styles::ShapeStyle;
///
/// let renderer = PngRenderer::new(96.0);
/// let prims = vec![DrawPrimitive::Rect {
///     x: 0.0, y: 0.0, width: 100.0, height: 50.0,
///     style: ShapeStyle::new().with_fill("#3b82f6"),
///     corner_radius: 4.0,
/// }];
/// let png_bytes = renderer.render(&prims, 200.0, 100.0).unwrap();
/// assert!(!png_bytes.is_empty());
/// ```
pub struct PngRenderer {
    /// Dots per inch for rasterization scaling.
    dpi: f64,
}

impl PngRenderer {
    /// Create a new PNG renderer with the given DPI.
    ///
    /// Standard screen DPI is 96.0. Use 300.0 for print-quality output.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// use signapps_drawing::render::png::PngRenderer;
    ///
    /// let renderer = PngRenderer::new(96.0);
    /// ```
    pub fn new(dpi: f64) -> Self {
        Self { dpi }
    }

    /// Create a PNG renderer with the default 96 DPI.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// use signapps_drawing::render::png::PngRenderer;
    ///
    /// let renderer = PngRenderer::default_dpi();
    /// ```
    pub fn default_dpi() -> Self {
        Self::new(96.0)
    }
}

impl RenderProcessor for PngRenderer {
    fn render(
        &self,
        primitives: &[DrawPrimitive],
        width: f64,
        height: f64,
    ) -> RenderResult<Vec<u8>> {
        // Step 1: Render to SVG via SvgRenderer
        let svg_renderer = SvgRenderer;
        let svg_bytes = svg_renderer.render(primitives, width, height)?;
        let svg_str = String::from_utf8(svg_bytes)
            .map_err(|e| RenderError::Failed(format!("SVG output is not valid UTF-8: {e}")))?;

        tracing::debug!(
            svg_len = svg_str.len(),
            dpi = self.dpi,
            "rasterizing SVG to PNG"
        );

        // Step 2: Parse SVG into usvg tree
        let opts = Options::default();
        let tree = Tree::from_str(&svg_str, &opts)
            .map_err(|e| RenderError::Failed(format!("usvg parse failed: {e}")))?;

        // Step 3: Calculate pixel dimensions from DPI
        let scale = self.dpi / 96.0;
        let pixel_width = (width * scale).ceil() as u32;
        let pixel_height = (height * scale).ceil() as u32;

        if pixel_width == 0 || pixel_height == 0 {
            return Err(RenderError::Failed(
                "PNG dimensions must be non-zero".to_string(),
            ));
        }

        // Step 4: Create pixmap and render
        let mut pixmap = Pixmap::new(pixel_width, pixel_height).ok_or_else(|| {
            RenderError::Failed(format!(
                "failed to create pixmap ({pixel_width}x{pixel_height})"
            ))
        })?;

        let transform = tiny_skia::Transform::from_scale(scale as f32, scale as f32);
        resvg::render(&tree, transform, &mut pixmap.as_mut());

        // Step 5: Encode as PNG
        let png_data = pixmap
            .encode_png()
            .map_err(|e| RenderError::Failed(format!("PNG encoding failed: {e}")))?;

        tracing::debug!(
            png_len = png_data.len(),
            pixel_width,
            pixel_height,
            "PNG rendering complete"
        );

        Ok(png_data)
    }

    fn mime_type(&self) -> &str {
        "image/png"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::styles::ShapeStyle;

    #[test]
    fn png_renderer_produces_bytes() {
        let renderer = PngRenderer::default_dpi();
        let prims = vec![DrawPrimitive::Rect {
            x: 0.0,
            y: 0.0,
            width: 100.0,
            height: 50.0,
            style: ShapeStyle::new().with_fill("#3b82f6"),
            corner_radius: 4.0,
        }];
        let bytes = renderer.render(&prims, 200.0, 100.0).expect("render PNG");
        // PNG magic bytes: 0x89 P N G
        assert!(bytes.len() > 8);
        assert_eq!(&bytes[0..4], &[0x89, 0x50, 0x4E, 0x47]);
    }

    #[test]
    fn png_renderer_high_dpi() {
        let renderer = PngRenderer::new(192.0);
        let prims = vec![DrawPrimitive::Rect {
            x: 0.0,
            y: 0.0,
            width: 50.0,
            height: 50.0,
            style: ShapeStyle::new().with_fill("#ff0000"),
            corner_radius: 0.0,
        }];
        let bytes = renderer.render(&prims, 50.0, 50.0).expect("render PNG");
        assert!(!bytes.is_empty());
    }

    #[test]
    fn png_renderer_empty_primitives() {
        let renderer = PngRenderer::default_dpi();
        let bytes = renderer
            .render(&[], 100.0, 100.0)
            .expect("render empty PNG");
        assert!(!bytes.is_empty());
    }

    #[test]
    fn png_mime_type() {
        let renderer = PngRenderer::default_dpi();
        assert_eq!(renderer.mime_type(), "image/png");
    }

    #[test]
    fn png_renderer_zero_dimensions_fails() {
        let renderer = PngRenderer::default_dpi();
        let result = renderer.render(&[], 0.0, 0.0);
        assert!(result.is_err());
    }
}
