//! Drawing primitives -- the atomic visual elements produced by shape decomposition.
//!
//! Primitives are the lowest-level drawable elements. High-level shapes decompose into
//! one or more primitives, which are then consumed by renderers (SVG, PNG, PDF).

use serde::{Deserialize, Serialize};

use crate::styles::{ShapeStyle, TextAnchor, Transform};

/// A drawing primitive -- atomic visual element.
///
/// Each variant maps directly to an SVG element or equivalent in other renderers.
/// Primitives carry their own styling and positioning.
///
/// # Examples
///
/// ```
/// use signapps_drawing::primitives::DrawPrimitive;
/// use signapps_drawing::styles::ShapeStyle;
///
/// let rect = DrawPrimitive::Rect {
///     x: 0.0, y: 0.0, width: 100.0, height: 50.0,
///     style: ShapeStyle::new().with_fill("#3b82f6"),
///     corner_radius: 4.0,
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DrawPrimitive {
    /// A rectangle with optional rounded corners.
    Rect {
        /// X coordinate of the top-left corner.
        x: f64,
        /// Y coordinate of the top-left corner.
        y: f64,
        /// Width of the rectangle.
        width: f64,
        /// Height of the rectangle.
        height: f64,
        /// Visual style (fill, stroke, opacity).
        style: ShapeStyle,
        /// Corner radius for rounded rectangles.
        corner_radius: f64,
    },
    /// An ellipse defined by center and radii.
    Ellipse {
        /// X coordinate of the center.
        cx: f64,
        /// Y coordinate of the center.
        cy: f64,
        /// Horizontal radius.
        rx: f64,
        /// Vertical radius.
        ry: f64,
        /// Visual style (fill, stroke, opacity).
        style: ShapeStyle,
    },
    /// A straight line between two points.
    Line {
        /// X coordinate of the start point.
        x1: f64,
        /// Y coordinate of the start point.
        y1: f64,
        /// X coordinate of the end point.
        x2: f64,
        /// Y coordinate of the end point.
        y2: f64,
        /// Visual style (stroke, stroke-width).
        style: ShapeStyle,
    },
    /// An arbitrary SVG path.
    Path {
        /// SVG path data string (e.g. "M 0 0 L 100 100").
        d: String,
        /// Visual style (fill, stroke, opacity).
        style: ShapeStyle,
    },
    /// A text element.
    Text {
        /// X coordinate of the text anchor.
        x: f64,
        /// Y coordinate of the text baseline.
        y: f64,
        /// Text content to render.
        text: String,
        /// Font size in pixels.
        font_size: f64,
        /// Font family name.
        font_family: String,
        /// Text color (CSS color string).
        color: String,
        /// Horizontal text anchor position.
        anchor: TextAnchor,
    },
    /// An embedded image.
    Image {
        /// X coordinate of the top-left corner.
        x: f64,
        /// Y coordinate of the top-left corner.
        y: f64,
        /// Width of the image.
        width: f64,
        /// Height of the image.
        height: f64,
        /// Image source URL or data URI.
        href: String,
    },
    /// A group of primitives with an optional transform.
    Group {
        /// Child primitives contained in this group.
        children: Vec<DrawPrimitive>,
        /// Optional 2D affine transform applied to the group.
        transform: Option<Transform>,
    },
}
