//! Multi-target rendering processors.
//!
//! This module defines the [`RenderProcessor`] trait and error types, plus concrete
//! renderer implementations. Currently only SVG is implemented; PNG and PDF renderers
//! will be added in future tasks when `resvg`/`tiny-skia`/`printpdf` dependencies land.

pub mod svg;

use crate::primitives::DrawPrimitive;
use thiserror::Error;

/// Errors that can occur during rendering.
#[derive(Error, Debug)]
pub enum RenderError {
    /// A rendering operation failed with a descriptive message.
    #[error("render failed: {0}")]
    Failed(String),

    /// An I/O error occurred (e.g. writing output to disk).
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

/// Result type alias for render operations.
pub type RenderResult<T> = Result<T, RenderError>;

/// Trait for rendering primitives to a specific output format.
///
/// Implementors convert a slice of [`DrawPrimitive`] values into bytes
/// representing the target format (SVG XML, PNG image, PDF document, etc.).
///
/// # Examples
///
/// ```
/// use signapps_drawing::render::{RenderProcessor, RenderResult};
/// use signapps_drawing::primitives::DrawPrimitive;
/// use signapps_drawing::render::svg::SvgRenderer;
///
/// let renderer = SvgRenderer;
/// assert_eq!(renderer.mime_type(), "image/svg+xml");
/// ```
pub trait RenderProcessor {
    /// Render primitives to bytes (SVG, PNG, PDF, etc.).
    ///
    /// # Errors
    ///
    /// Returns [`RenderError`] if rendering fails for any reason.
    fn render(
        &self,
        primitives: &[DrawPrimitive],
        width: f64,
        height: f64,
    ) -> RenderResult<Vec<u8>>;

    /// Output MIME type for the rendered format.
    fn mime_type(&self) -> &str;
}
