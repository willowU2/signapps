//! Drawing styles -- fill, stroke, shadow, transforms.

use serde::{Deserialize, Serialize};

/// Visual style applied to shapes and primitives.
///
/// Controls fill color, stroke, opacity, and dash patterns for any drawable element.
///
/// # Examples
///
/// ```
/// use signapps_drawing::styles::ShapeStyle;
///
/// let style = ShapeStyle::new()
///     .with_fill("#3b82f6")
///     .with_stroke("#1e40af", 2.0);
/// assert_eq!(style.fill, Some("#3b82f6".to_string()));
/// assert_eq!(style.stroke_width, 2.0);
/// ```
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ShapeStyle {
    /// Fill color (CSS color string, e.g. "#3b82f6", "rgba(0,0,0,0.5)").
    pub fill: Option<String>,
    /// Stroke color.
    pub stroke: Option<String>,
    /// Stroke width in pixels.
    pub stroke_width: f64,
    /// Opacity (0.0 to 1.0).
    pub opacity: f64,
    /// Dash pattern (e.g. "5,3" for dashed lines).
    pub stroke_dasharray: Option<String>,
}

impl ShapeStyle {
    /// Create a new style with default stroke width (1.0) and full opacity (1.0).
    pub fn new() -> Self {
        Self {
            stroke_width: 1.0,
            opacity: 1.0,
            ..Default::default()
        }
    }

    /// Set the fill color.
    pub fn with_fill(mut self, color: &str) -> Self {
        self.fill = Some(color.to_string());
        self
    }

    /// Set the stroke color and width.
    pub fn with_stroke(mut self, color: &str, width: f64) -> Self {
        self.stroke = Some(color.to_string());
        self.stroke_width = width;
        self
    }
}

/// 2D affine transform applied to groups of primitives.
///
/// Supports translation, rotation, and non-uniform scaling.
///
/// # Examples
///
/// ```
/// use signapps_drawing::styles::Transform;
///
/// let t = Transform { translate_x: 10.0, translate_y: 20.0, ..Default::default() };
/// assert_eq!(t.to_svg_attr(), "translate(10,20)");
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transform {
    /// Horizontal translation in pixels.
    pub translate_x: f64,
    /// Vertical translation in pixels.
    pub translate_y: f64,
    /// Rotation angle in degrees.
    pub rotate: f64,
    /// Horizontal scale factor (1.0 = no scaling).
    pub scale_x: f64,
    /// Vertical scale factor (1.0 = no scaling).
    pub scale_y: f64,
}

impl Default for Transform {
    fn default() -> Self {
        Self {
            translate_x: 0.0,
            translate_y: 0.0,
            rotate: 0.0,
            scale_x: 1.0,
            scale_y: 1.0,
        }
    }
}

impl Transform {
    /// Convert to SVG transform attribute string.
    ///
    /// Only includes non-identity components (non-zero translate, non-zero rotate,
    /// non-unit scale).
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_drawing::styles::Transform;
    ///
    /// let t = Transform {
    ///     translate_x: 50.0, translate_y: 100.0,
    ///     rotate: 45.0,
    ///     scale_x: 2.0, scale_y: 1.0,
    /// };
    /// let attr = t.to_svg_attr();
    /// assert!(attr.contains("translate(50,100)"));
    /// assert!(attr.contains("rotate(45)"));
    /// assert!(attr.contains("scale(2,1)"));
    /// ```
    pub fn to_svg_attr(&self) -> String {
        let mut parts = Vec::new();
        if self.translate_x != 0.0 || self.translate_y != 0.0 {
            parts.push(format!("translate({},{})", self.translate_x, self.translate_y));
        }
        if self.rotate != 0.0 {
            parts.push(format!("rotate({})", self.rotate));
        }
        if self.scale_x != 1.0 || self.scale_y != 1.0 {
            parts.push(format!("scale({},{})", self.scale_x, self.scale_y));
        }
        parts.join(" ")
    }
}

/// Text anchor position for horizontal text alignment.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TextAnchor {
    /// Align text to the start (left for LTR).
    #[default]
    Start,
    /// Center text horizontally.
    Middle,
    /// Align text to the end (right for LTR).
    End,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn style_defaults() {
        let s = ShapeStyle::new();
        assert_eq!(s.stroke_width, 1.0);
        assert!((s.opacity - 1.0).abs() < f64::EPSILON);
        assert!(s.fill.is_none());
        assert!(s.stroke.is_none());
    }

    #[test]
    fn style_builder() {
        let s = ShapeStyle::new()
            .with_fill("#ff0000")
            .with_stroke("#00ff00", 3.0);
        assert_eq!(s.fill.as_deref(), Some("#ff0000"));
        assert_eq!(s.stroke.as_deref(), Some("#00ff00"));
        assert_eq!(s.stroke_width, 3.0);
    }

    #[test]
    fn transform_identity_empty() {
        let t = Transform::default();
        assert_eq!(t.to_svg_attr(), "");
    }

    #[test]
    fn transform_translate_only() {
        let t = Transform {
            translate_x: 10.0,
            translate_y: 20.0,
            ..Default::default()
        };
        assert_eq!(t.to_svg_attr(), "translate(10,20)");
    }

    #[test]
    fn transform_all_components() {
        let t = Transform {
            translate_x: 5.0,
            translate_y: 10.0,
            rotate: 90.0,
            scale_x: 2.0,
            scale_y: 0.5,
        };
        let attr = t.to_svg_attr();
        assert!(attr.contains("translate(5,10)"));
        assert!(attr.contains("rotate(90)"));
        assert!(attr.contains("scale(2,0.5)"));
    }

    #[test]
    fn text_anchor_default() {
        assert_eq!(TextAnchor::default(), TextAnchor::Start);
    }
}
