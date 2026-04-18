//! High-level shapes that decompose into drawing primitives.
//!
//! Shapes represent the user-facing drawing objects (rectangle, ellipse, arrow, etc.).
//! Each shape knows how to decompose itself into one or more [`DrawPrimitive`] instances,
//! which can then be fed to any renderer.
//!
//! # Examples
//!
//! ```
//! use signapps_drawing::shapes::{Shape, ShapeType};
//! use signapps_drawing::styles::ShapeStyle;
//!
//! let rect = Shape {
//!     x: 0.0, y: 0.0, width: 100.0, height: 50.0,
//!     shape_type: ShapeType::Rectangle,
//!     style: ShapeStyle::new().with_fill("#3b82f6"),
//!     text: None,
//! };
//! let primitives = rect.decompose();
//! assert_eq!(primitives.len(), 1);
//! ```

use serde::{Deserialize, Serialize};

use crate::primitives::DrawPrimitive;
use crate::styles::{ShapeStyle, TextAnchor};

/// A high-level shape with position, size, and type-specific properties.
///
/// Shapes are the primary building blocks of a drawing canvas. They carry
/// position, dimensions, visual style, optional text content, and a
/// [`ShapeType`] discriminant that determines decomposition behavior.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Shape {
    /// X coordinate of the top-left corner.
    pub x: f64,
    /// Y coordinate of the top-left corner.
    pub y: f64,
    /// Width of the bounding box.
    pub width: f64,
    /// Height of the bounding box.
    pub height: f64,
    /// Type-specific shape data.
    pub shape_type: ShapeType,
    /// Visual style (fill, stroke, opacity).
    pub style: ShapeStyle,
    /// Optional text content rendered inside or alongside the shape.
    pub text: Option<String>,
}

/// Discriminant for the type of shape and any type-specific parameters.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ShapeType {
    /// A rectangle (decomposes to a single Rect primitive).
    Rectangle,
    /// An ellipse inscribed in the bounding box (decomposes to a single Ellipse primitive).
    Ellipse,
    /// A diamond / rhombus (decomposes to a 4-point Path polygon rotated 45 degrees).
    Diamond,
    /// An arrow from shape origin to the given endpoint (decomposes to Line + Path triangle head).
    Arrow {
        /// X coordinate of the arrow endpoint.
        end_x: f64,
        /// Y coordinate of the arrow endpoint.
        end_y: f64,
    },
    /// A text box with background (decomposes to Rect + Text).
    TextBox,
    /// A sticky note with folded corner (decomposes to Rect body + Path fold triangle).
    StickyNote,
    /// A connector line between two points with optional label.
    Connector {
        /// X coordinate of the connector endpoint.
        end_x: f64,
        /// Y coordinate of the connector endpoint.
        end_y: f64,
        /// Optional text label positioned at the midpoint.
        label: Option<String>,
    },
}

impl Shape {
    /// Decompose this shape into drawing primitives.
    ///
    /// Each shape type produces a different set of primitives that, when rendered
    /// together, form the visual representation of the shape.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_drawing::shapes::{Shape, ShapeType};
    /// use signapps_drawing::styles::ShapeStyle;
    /// use signapps_drawing::primitives::DrawPrimitive;
    ///
    /// let ellipse = Shape {
    ///     x: 10.0, y: 10.0, width: 80.0, height: 60.0,
    ///     shape_type: ShapeType::Ellipse,
    ///     style: ShapeStyle::new().with_fill("#f59e0b"),
    ///     text: None,
    /// };
    /// let prims = ellipse.decompose();
    /// assert_eq!(prims.len(), 1);
    /// ```
    pub fn decompose(&self) -> Vec<DrawPrimitive> {
        match &self.shape_type {
            ShapeType::Rectangle => self.decompose_rectangle(),
            ShapeType::Ellipse => self.decompose_ellipse(),
            ShapeType::Diamond => self.decompose_diamond(),
            ShapeType::Arrow { end_x, end_y } => self.decompose_arrow(*end_x, *end_y),
            ShapeType::TextBox => self.decompose_textbox(),
            ShapeType::StickyNote => self.decompose_sticky_note(),
            ShapeType::Connector {
                end_x,
                end_y,
                label,
            } => self.decompose_connector(*end_x, *end_y, label.as_deref()),
        }
    }

    /// Decompose a rectangle into a single Rect primitive.
    fn decompose_rectangle(&self) -> Vec<DrawPrimitive> {
        vec![DrawPrimitive::Rect {
            x: self.x,
            y: self.y,
            width: self.width,
            height: self.height,
            style: self.style.clone(),
            corner_radius: 0.0,
        }]
    }

    /// Decompose an ellipse into a single Ellipse primitive inscribed in the bounding box.
    fn decompose_ellipse(&self) -> Vec<DrawPrimitive> {
        vec![DrawPrimitive::Ellipse {
            cx: self.x + self.width / 2.0,
            cy: self.y + self.height / 2.0,
            rx: self.width / 2.0,
            ry: self.height / 2.0,
            style: self.style.clone(),
        }]
    }

    /// Decompose a diamond into a 4-point polygon Path.
    fn decompose_diamond(&self) -> Vec<DrawPrimitive> {
        let mid_x = self.x + self.width / 2.0;
        let mid_y = self.y + self.height / 2.0;
        let top = (mid_x, self.y);
        let right = (self.x + self.width, mid_y);
        let bottom = (mid_x, self.y + self.height);
        let left = (self.x, mid_y);

        let d = format!(
            "M {},{} L {},{} L {},{} L {},{} Z",
            top.0, top.1, right.0, right.1, bottom.0, bottom.1, left.0, left.1,
        );

        vec![DrawPrimitive::Path {
            d,
            style: self.style.clone(),
        }]
    }

    /// Decompose an arrow into a Line (shaft) + Path (triangle arrowhead).
    fn decompose_arrow(&self, end_x: f64, end_y: f64) -> Vec<DrawPrimitive> {
        let start_x = self.x;
        let start_y = self.y;

        // Line shaft
        let line = DrawPrimitive::Line {
            x1: start_x,
            y1: start_y,
            x2: end_x,
            y2: end_y,
            style: self.style.clone(),
        };

        // Arrowhead triangle -- size proportional to stroke width
        let head_size = self.style.stroke_width.max(1.0) * 5.0;
        let dx = end_x - start_x;
        let dy = end_y - start_y;
        let len = (dx * dx + dy * dy).sqrt();

        // Avoid division by zero for zero-length arrows
        let (ux, uy) = if len > f64::EPSILON {
            (dx / len, dy / len)
        } else {
            (1.0, 0.0)
        };

        // Perpendicular vector
        let px = -uy;
        let py = ux;

        // Triangle points: tip at end, two base points behind
        let base_x = end_x - ux * head_size;
        let base_y = end_y - uy * head_size;
        let p1_x = base_x + px * head_size * 0.4;
        let p1_y = base_y + py * head_size * 0.4;
        let p2_x = base_x - px * head_size * 0.4;
        let p2_y = base_y - py * head_size * 0.4;

        let head_d = format!("M {end_x},{end_y} L {p1_x},{p1_y} L {p2_x},{p2_y} Z");
        let head_style = ShapeStyle {
            fill: self
                .style
                .stroke
                .clone()
                .or_else(|| Some("#000000".to_string())),
            stroke: None,
            stroke_width: 0.0,
            opacity: self.style.opacity,
            stroke_dasharray: None,
        };

        let head = DrawPrimitive::Path {
            d: head_d,
            style: head_style,
        };

        vec![line, head]
    }

    /// Decompose a text box into a Rect background + Text content.
    fn decompose_textbox(&self) -> Vec<DrawPrimitive> {
        let mut primitives = vec![DrawPrimitive::Rect {
            x: self.x,
            y: self.y,
            width: self.width,
            height: self.height,
            style: self.style.clone(),
            corner_radius: 4.0,
        }];

        if let Some(ref text) = self.text {
            primitives.push(DrawPrimitive::Text {
                x: self.x + self.width / 2.0,
                y: self.y + self.height / 2.0,
                text: text.clone(),
                font_size: 14.0,
                font_family: "sans-serif".to_string(),
                color: "#000000".to_string(),
                anchor: TextAnchor::Middle,
            });
        }

        primitives
    }

    /// Decompose a sticky note into a Rect body (yellow) + Path folded corner triangle.
    fn decompose_sticky_note(&self) -> Vec<DrawPrimitive> {
        let fold_size = self.width.min(self.height) * 0.15;

        // Yellow body rectangle
        let mut body_style = self.style.clone();
        if body_style.fill.is_none() {
            body_style.fill = Some("#fef08a".to_string()); // yellow-200
        }

        let body = DrawPrimitive::Rect {
            x: self.x,
            y: self.y,
            width: self.width,
            height: self.height,
            style: body_style,
            corner_radius: 0.0,
        };

        // Folded corner triangle at top-right
        let fold_x = self.x + self.width - fold_size;
        let fold_y = self.y;
        let fold_d = format!(
            "M {},{} L {},{} L {},{} Z",
            fold_x,
            fold_y,
            self.x + self.width,
            fold_y + fold_size,
            fold_x,
            fold_y + fold_size,
        );
        let fold = DrawPrimitive::Path {
            d: fold_d,
            style: ShapeStyle {
                fill: Some("#fde047".to_string()), // yellow-300 (slightly darker)
                stroke: None,
                stroke_width: 0.0,
                opacity: self.style.opacity,
                stroke_dasharray: None,
            },
        };

        let mut primitives = vec![body, fold];

        // Optional text content
        if let Some(ref text) = self.text {
            primitives.push(DrawPrimitive::Text {
                x: self.x + 8.0,
                y: self.y + fold_size + 16.0,
                text: text.clone(),
                font_size: 13.0,
                font_family: "sans-serif".to_string(),
                color: "#713f12".to_string(), // yellow-900
                anchor: TextAnchor::Start,
            });
        }

        primitives
    }

    /// Decompose a connector into a Path line + optional Text label at midpoint.
    fn decompose_connector(
        &self,
        end_x: f64,
        end_y: f64,
        label: Option<&str>,
    ) -> Vec<DrawPrimitive> {
        let start_x = self.x;
        let start_y = self.y;

        let d = format!("M {start_x},{start_y} L {end_x},{end_y}");
        let line = DrawPrimitive::Path {
            d,
            style: self.style.clone(),
        };

        let mut primitives = vec![line];

        if let Some(label_text) = label {
            let mid_x = (start_x + end_x) / 2.0;
            let mid_y = (start_y + end_y) / 2.0;
            primitives.push(DrawPrimitive::Text {
                x: mid_x,
                y: mid_y - 4.0, // slightly above the line
                text: label_text.to_string(),
                font_size: 12.0,
                font_family: "sans-serif".to_string(),
                color: "#374151".to_string(), // gray-700
                anchor: TextAnchor::Middle,
            });
        }

        primitives
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn default_shape(shape_type: ShapeType) -> Shape {
        Shape {
            x: 10.0,
            y: 20.0,
            width: 100.0,
            height: 80.0,
            shape_type,
            style: ShapeStyle::new()
                .with_fill("#3b82f6")
                .with_stroke("#1e40af", 2.0),
            text: None,
        }
    }

    #[test]
    fn rectangle_decomposes_to_single_rect() {
        let shape = default_shape(ShapeType::Rectangle);
        let prims = shape.decompose();
        assert_eq!(prims.len(), 1);
        match &prims[0] {
            DrawPrimitive::Rect {
                x,
                y,
                width,
                height,
                corner_radius,
                ..
            } => {
                assert_eq!(*x, 10.0);
                assert_eq!(*y, 20.0);
                assert_eq!(*width, 100.0);
                assert_eq!(*height, 80.0);
                assert_eq!(*corner_radius, 0.0);
            },
            other => panic!("expected Rect, got {other:?}"),
        }
    }

    #[test]
    fn ellipse_decomposes_to_single_ellipse() {
        let shape = default_shape(ShapeType::Ellipse);
        let prims = shape.decompose();
        assert_eq!(prims.len(), 1);
        match &prims[0] {
            DrawPrimitive::Ellipse { cx, cy, rx, ry, .. } => {
                assert_eq!(*cx, 60.0); // 10 + 100/2
                assert_eq!(*cy, 60.0); // 20 + 80/2
                assert_eq!(*rx, 50.0); // 100/2
                assert_eq!(*ry, 40.0); // 80/2
            },
            other => panic!("expected Ellipse, got {other:?}"),
        }
    }

    #[test]
    fn diamond_decomposes_to_path() {
        let shape = default_shape(ShapeType::Diamond);
        let prims = shape.decompose();
        assert_eq!(prims.len(), 1);
        match &prims[0] {
            DrawPrimitive::Path { d, .. } => {
                assert!(d.starts_with('M'));
                assert!(d.contains('L'));
                assert!(d.ends_with('Z'));
                // Should contain 4 points (top, right, bottom, left)
                let l_count = d.matches('L').count();
                assert_eq!(l_count, 3);
            },
            other => panic!("expected Path, got {other:?}"),
        }
    }

    #[test]
    fn arrow_decomposes_to_line_and_head() {
        let shape = default_shape(ShapeType::Arrow {
            end_x: 200.0,
            end_y: 100.0,
        });
        let prims = shape.decompose();
        assert_eq!(prims.len(), 2);
        assert!(matches!(&prims[0], DrawPrimitive::Line { .. }));
        assert!(matches!(&prims[1], DrawPrimitive::Path { .. }));
    }

    #[test]
    fn arrow_zero_length_does_not_panic() {
        let shape = Shape {
            x: 50.0,
            y: 50.0,
            width: 0.0,
            height: 0.0,
            shape_type: ShapeType::Arrow {
                end_x: 50.0,
                end_y: 50.0,
            },
            style: ShapeStyle::new(),
            text: None,
        };
        // Should not panic on zero-length arrow
        let prims = shape.decompose();
        assert_eq!(prims.len(), 2);
    }

    #[test]
    fn textbox_without_text() {
        let shape = default_shape(ShapeType::TextBox);
        let prims = shape.decompose();
        assert_eq!(prims.len(), 1);
        match &prims[0] {
            DrawPrimitive::Rect { corner_radius, .. } => {
                assert_eq!(*corner_radius, 4.0);
            },
            other => panic!("expected Rect, got {other:?}"),
        }
    }

    #[test]
    fn textbox_with_text() {
        let mut shape = default_shape(ShapeType::TextBox);
        shape.text = Some("Hello world".to_string());
        let prims = shape.decompose();
        assert_eq!(prims.len(), 2);
        assert!(matches!(&prims[0], DrawPrimitive::Rect { .. }));
        match &prims[1] {
            DrawPrimitive::Text { text, anchor, .. } => {
                assert_eq!(text, "Hello world");
                assert_eq!(*anchor, TextAnchor::Middle);
            },
            other => panic!("expected Text, got {other:?}"),
        }
    }

    #[test]
    fn sticky_note_has_body_and_fold() {
        let shape = default_shape(ShapeType::StickyNote);
        let prims = shape.decompose();
        assert!(prims.len() >= 2);
        assert!(matches!(&prims[0], DrawPrimitive::Rect { .. }));
        assert!(matches!(&prims[1], DrawPrimitive::Path { .. }));
    }

    #[test]
    fn sticky_note_default_fill_is_yellow() {
        let mut shape = default_shape(ShapeType::StickyNote);
        shape.style.fill = None; // no explicit fill
        let prims = shape.decompose();
        match &prims[0] {
            DrawPrimitive::Rect { style, .. } => {
                assert_eq!(style.fill.as_deref(), Some("#fef08a"));
            },
            other => panic!("expected Rect, got {other:?}"),
        }
    }

    #[test]
    fn sticky_note_with_text() {
        let mut shape = default_shape(ShapeType::StickyNote);
        shape.text = Some("Remember!".to_string());
        let prims = shape.decompose();
        assert_eq!(prims.len(), 3);
        assert!(matches!(&prims[2], DrawPrimitive::Text { .. }));
    }

    #[test]
    fn connector_without_label() {
        let shape = default_shape(ShapeType::Connector {
            end_x: 300.0,
            end_y: 200.0,
            label: None,
        });
        let prims = shape.decompose();
        assert_eq!(prims.len(), 1);
        assert!(matches!(&prims[0], DrawPrimitive::Path { .. }));
    }

    #[test]
    fn connector_with_label() {
        let shape = default_shape(ShapeType::Connector {
            end_x: 300.0,
            end_y: 200.0,
            label: Some("connects".to_string()),
        });
        let prims = shape.decompose();
        assert_eq!(prims.len(), 2);
        assert!(matches!(&prims[0], DrawPrimitive::Path { .. }));
        match &prims[1] {
            DrawPrimitive::Text { text, anchor, .. } => {
                assert_eq!(text, "connects");
                assert_eq!(*anchor, TextAnchor::Middle);
            },
            other => panic!("expected Text, got {other:?}"),
        }
    }

    #[test]
    fn shape_serialization_roundtrip() {
        let shape = Shape {
            x: 10.0,
            y: 20.0,
            width: 100.0,
            height: 80.0,
            shape_type: ShapeType::Arrow {
                end_x: 200.0,
                end_y: 150.0,
            },
            style: ShapeStyle::new().with_fill("#ff0000"),
            text: Some("test".to_string()),
        };
        let json = serde_json::to_string(&shape).expect("serialize shape");
        let deserialized: Shape = serde_json::from_str(&json).expect("deserialize shape");
        assert_eq!(deserialized.x, 10.0);
        assert_eq!(deserialized.text.as_deref(), Some("test"));
    }
}
