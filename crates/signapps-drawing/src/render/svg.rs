//! SVG renderer -- walks the primitive tree and generates SVG XML.
//!
//! Produces standalone SVG documents with proper namespace and viewBox.

use std::fmt::Write;

use crate::primitives::DrawPrimitive;
use crate::styles::{ShapeStyle, TextAnchor};

use super::{RenderProcessor, RenderResult};

/// SVG format renderer.
///
/// Converts a slice of [`DrawPrimitive`] into a complete SVG XML document.
///
/// # Examples
///
/// ```
/// use signapps_drawing::render::svg::SvgRenderer;
/// use signapps_drawing::render::RenderProcessor;
/// use signapps_drawing::primitives::DrawPrimitive;
/// use signapps_drawing::styles::ShapeStyle;
///
/// let prims = vec![DrawPrimitive::Rect {
///     x: 0.0, y: 0.0, width: 100.0, height: 50.0,
///     style: ShapeStyle::new().with_fill("#3b82f6"),
///     corner_radius: 4.0,
/// }];
/// let svg = SvgRenderer.render(&prims, 200.0, 100.0).unwrap();
/// let s = String::from_utf8(svg).unwrap();
/// assert!(s.contains("<rect"));
/// assert!(s.contains("viewBox"));
/// ```
pub struct SvgRenderer;

impl RenderProcessor for SvgRenderer {
    fn render(
        &self,
        primitives: &[DrawPrimitive],
        width: f64,
        height: f64,
    ) -> RenderResult<Vec<u8>> {
        let mut buf = String::with_capacity(4096);

        // SVG header
        let _ = write!(
            buf,
            r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {} {}" width="{}" height="{}">"#,
            width, height, width, height,
        );

        for prim in primitives {
            render_primitive(&mut buf, prim);
        }

        buf.push_str("</svg>");

        Ok(buf.into_bytes())
    }

    fn mime_type(&self) -> &str {
        "image/svg+xml"
    }
}

/// Render a single primitive into the SVG buffer.
fn render_primitive(buf: &mut String, prim: &DrawPrimitive) {
    match prim {
        DrawPrimitive::Rect {
            x,
            y,
            width,
            height,
            style,
            corner_radius,
        } => {
            let _ = write!(buf, r#"<rect x="{x}" y="{y}" width="{width}" height="{height}""#);
            if *corner_radius > 0.0 {
                let _ = write!(buf, r#" rx="{corner_radius}""#);
            }
            write_style_attrs(buf, style);
            buf.push_str("/>");
        }

        DrawPrimitive::Ellipse {
            cx,
            cy,
            rx,
            ry,
            style,
        } => {
            let _ = write!(buf, r#"<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}""#);
            write_style_attrs(buf, style);
            buf.push_str("/>");
        }

        DrawPrimitive::Line {
            x1,
            y1,
            x2,
            y2,
            style,
        } => {
            let _ = write!(buf, r#"<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}""#);
            write_style_attrs(buf, style);
            buf.push_str("/>");
        }

        DrawPrimitive::Path { d, style } => {
            let _ = write!(buf, r#"<path d="{d}""#);
            write_style_attrs(buf, style);
            buf.push_str("/>");
        }

        DrawPrimitive::Text {
            x,
            y,
            text,
            font_size,
            font_family,
            color,
            anchor,
        } => {
            let anchor_str = match anchor {
                TextAnchor::Start => "start",
                TextAnchor::Middle => "middle",
                TextAnchor::End => "end",
            };
            let _ = write!(
                buf,
                r#"<text x="{x}" y="{y}" font-size="{font_size}" font-family="{font_family}" fill="{color}" text-anchor="{anchor_str}">"#,
            );
            // Escape XML special characters in text content
            push_xml_escaped(buf, text);
            buf.push_str("</text>");
        }

        DrawPrimitive::Image {
            x,
            y,
            width,
            height,
            href,
        } => {
            let _ = write!(
                buf,
                r#"<image x="{x}" y="{y}" width="{width}" height="{height}" href="{href}"/>"#,
            );
        }

        DrawPrimitive::Group {
            children,
            transform,
        } => {
            buf.push_str("<g");
            if let Some(t) = transform {
                let attr = t.to_svg_attr();
                if !attr.is_empty() {
                    let _ = write!(buf, r#" transform="{attr}""#);
                }
            }
            buf.push('>');
            for child in children {
                render_primitive(buf, child);
            }
            buf.push_str("</g>");
        }
    }
}

/// Write common SVG style attributes (fill, stroke, stroke-width, opacity, stroke-dasharray).
fn write_style_attrs(buf: &mut String, style: &ShapeStyle) {
    if let Some(ref fill) = style.fill {
        let _ = write!(buf, r#" fill="{fill}""#);
    } else {
        buf.push_str(r#" fill="none""#);
    }
    if let Some(ref stroke) = style.stroke {
        let _ = write!(buf, r#" stroke="{stroke}""#);
    }
    if style.stroke_width > 0.0 && style.stroke.is_some() {
        let _ = write!(buf, r#" stroke-width="{}""#, style.stroke_width);
    }
    if style.opacity < 1.0 {
        let _ = write!(buf, r#" opacity="{}""#, style.opacity);
    }
    if let Some(ref dash) = style.stroke_dasharray {
        let _ = write!(buf, r#" stroke-dasharray="{dash}""#);
    }
}

/// Escape XML special characters in text content.
fn push_xml_escaped(buf: &mut String, text: &str) {
    for ch in text.chars() {
        match ch {
            '<' => buf.push_str("&lt;"),
            '>' => buf.push_str("&gt;"),
            '&' => buf.push_str("&amp;"),
            '"' => buf.push_str("&quot;"),
            '\'' => buf.push_str("&apos;"),
            other => buf.push(other),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::styles::Transform;

    fn render_to_string(primitives: &[DrawPrimitive]) -> String {
        let renderer = SvgRenderer;
        let bytes = renderer.render(primitives, 400.0, 300.0).expect("render");
        String::from_utf8(bytes).expect("valid utf8")
    }

    #[test]
    fn svg_wraps_in_svg_element() {
        let svg = render_to_string(&[]);
        assert!(svg.starts_with("<svg"));
        assert!(svg.contains(r#"xmlns="http://www.w3.org/2000/svg""#));
        assert!(svg.contains(r#"viewBox="0 0 400 300""#));
        assert!(svg.ends_with("</svg>"));
    }

    #[test]
    fn svg_renders_rect() {
        let prims = vec![DrawPrimitive::Rect {
            x: 10.0,
            y: 20.0,
            width: 100.0,
            height: 50.0,
            style: ShapeStyle::new().with_fill("#ff0000").with_stroke("#000", 2.0),
            corner_radius: 0.0,
        }];
        let svg = render_to_string(&prims);
        assert!(svg.contains("<rect"));
        assert!(svg.contains(r#"x="10""#));
        assert!(svg.contains(r#"y="20""#));
        assert!(svg.contains(r#"width="100""#));
        assert!(svg.contains(r#"height="50""#));
        assert!(svg.contains(r##"fill="#ff0000""##));
        assert!(svg.contains(r##"stroke="#000""##));
        // No rx attribute when corner_radius is 0
        assert!(!svg.contains("rx="));
    }

    #[test]
    fn svg_renders_rect_with_corner_radius() {
        let prims = vec![DrawPrimitive::Rect {
            x: 0.0,
            y: 0.0,
            width: 50.0,
            height: 30.0,
            style: ShapeStyle::new().with_fill("#eee"),
            corner_radius: 8.0,
        }];
        let svg = render_to_string(&prims);
        assert!(svg.contains(r#"rx="8""#));
    }

    #[test]
    fn svg_renders_ellipse() {
        let prims = vec![DrawPrimitive::Ellipse {
            cx: 50.0,
            cy: 40.0,
            rx: 30.0,
            ry: 20.0,
            style: ShapeStyle::new().with_fill("#0f0"),
        }];
        let svg = render_to_string(&prims);
        assert!(svg.contains("<ellipse"));
        assert!(svg.contains(r#"cx="50""#));
        assert!(svg.contains(r#"cy="40""#));
        assert!(svg.contains(r#"rx="30""#));
        assert!(svg.contains(r#"ry="20""#));
    }

    #[test]
    fn svg_renders_line() {
        let prims = vec![DrawPrimitive::Line {
            x1: 0.0,
            y1: 0.0,
            x2: 100.0,
            y2: 100.0,
            style: ShapeStyle::new().with_stroke("#333", 3.0),
        }];
        let svg = render_to_string(&prims);
        assert!(svg.contains("<line"));
        assert!(svg.contains(r#"x1="0""#));
        assert!(svg.contains(r#"x2="100""#));
        assert!(svg.contains(r##"stroke="#333""##));
        assert!(svg.contains(r#"stroke-width="3""#));
    }

    #[test]
    fn svg_renders_path() {
        let prims = vec![DrawPrimitive::Path {
            d: "M 0,0 L 50,50 L 100,0 Z".to_string(),
            style: ShapeStyle::new().with_fill("#00f"),
        }];
        let svg = render_to_string(&prims);
        assert!(svg.contains("<path"));
        assert!(svg.contains(r#"d="M 0,0 L 50,50 L 100,0 Z""#));
    }

    #[test]
    fn svg_renders_text() {
        let prims = vec![DrawPrimitive::Text {
            x: 10.0,
            y: 30.0,
            text: "Hello".to_string(),
            font_size: 16.0,
            font_family: "Arial".to_string(),
            color: "#000".to_string(),
            anchor: TextAnchor::Middle,
        }];
        let svg = render_to_string(&prims);
        assert!(svg.contains("<text"));
        assert!(svg.contains(r#"font-size="16""#));
        assert!(svg.contains(r#"font-family="Arial""#));
        assert!(svg.contains(r#"text-anchor="middle""#));
        assert!(svg.contains(">Hello</text>"));
    }

    #[test]
    fn svg_escapes_text_content() {
        let prims = vec![DrawPrimitive::Text {
            x: 0.0,
            y: 0.0,
            text: "a < b & c > d".to_string(),
            font_size: 12.0,
            font_family: "serif".to_string(),
            color: "#000".to_string(),
            anchor: TextAnchor::Start,
        }];
        let svg = render_to_string(&prims);
        assert!(svg.contains("a &lt; b &amp; c &gt; d"));
    }

    #[test]
    fn svg_renders_image() {
        let prims = vec![DrawPrimitive::Image {
            x: 5.0,
            y: 5.0,
            width: 200.0,
            height: 150.0,
            href: "https://example.com/img.png".to_string(),
        }];
        let svg = render_to_string(&prims);
        assert!(svg.contains("<image"));
        assert!(svg.contains(r#"href="https://example.com/img.png""#));
    }

    #[test]
    fn svg_renders_group_with_transform() {
        let prims = vec![DrawPrimitive::Group {
            children: vec![DrawPrimitive::Rect {
                x: 0.0,
                y: 0.0,
                width: 50.0,
                height: 50.0,
                style: ShapeStyle::new().with_fill("#abc"),
                corner_radius: 0.0,
            }],
            transform: Some(Transform {
                translate_x: 100.0,
                translate_y: 50.0,
                rotate: 0.0,
                scale_x: 1.0,
                scale_y: 1.0,
            }),
        }];
        let svg = render_to_string(&prims);
        assert!(svg.contains("<g"));
        assert!(svg.contains(r#"transform="translate(100,50)""#));
        assert!(svg.contains("<rect"));
        assert!(svg.contains("</g>"));
    }

    #[test]
    fn svg_renders_group_without_transform() {
        let prims = vec![DrawPrimitive::Group {
            children: vec![],
            transform: None,
        }];
        let svg = render_to_string(&prims);
        assert!(svg.contains("<g>"));
        assert!(svg.contains("</g>"));
        assert!(!svg.contains("transform"));
    }

    #[test]
    fn svg_renders_opacity() {
        let style = ShapeStyle {
            fill: Some("#f00".to_string()),
            stroke: None,
            stroke_width: 1.0,
            opacity: 0.5,
            stroke_dasharray: None,
        };
        let prims = vec![DrawPrimitive::Rect {
            x: 0.0,
            y: 0.0,
            width: 10.0,
            height: 10.0,
            style,
            corner_radius: 0.0,
        }];
        let svg = render_to_string(&prims);
        assert!(svg.contains(r#"opacity="0.5""#));
    }

    #[test]
    fn svg_renders_dasharray() {
        let style = ShapeStyle {
            fill: None,
            stroke: Some("#000".to_string()),
            stroke_width: 1.0,
            opacity: 1.0,
            stroke_dasharray: Some("5,3".to_string()),
        };
        let prims = vec![DrawPrimitive::Line {
            x1: 0.0,
            y1: 0.0,
            x2: 100.0,
            y2: 0.0,
            style,
        }];
        let svg = render_to_string(&prims);
        assert!(svg.contains(r#"stroke-dasharray="5,3""#));
    }

    #[test]
    fn svg_no_fill_writes_none() {
        let prims = vec![DrawPrimitive::Rect {
            x: 0.0,
            y: 0.0,
            width: 10.0,
            height: 10.0,
            style: ShapeStyle::new(),
            corner_radius: 0.0,
        }];
        let svg = render_to_string(&prims);
        assert!(svg.contains(r#"fill="none""#));
    }

    #[test]
    fn mime_type_is_svg() {
        let renderer = SvgRenderer;
        assert_eq!(renderer.mime_type(), "image/svg+xml");
    }

    #[test]
    fn full_shape_to_svg_integration() {
        use crate::shapes::{Shape, ShapeType};

        let shapes = vec![
            Shape {
                x: 10.0,
                y: 10.0,
                width: 120.0,
                height: 80.0,
                shape_type: ShapeType::Rectangle,
                style: ShapeStyle::new().with_fill("#3b82f6").with_stroke("#1e40af", 2.0),
                text: None,
            },
            Shape {
                x: 150.0,
                y: 20.0,
                width: 100.0,
                height: 60.0,
                shape_type: ShapeType::StickyNote,
                style: ShapeStyle::new(),
                text: Some("Note!".to_string()),
            },
        ];

        let mut all_prims = Vec::new();
        for shape in &shapes {
            all_prims.extend(shape.decompose());
        }

        let renderer = SvgRenderer;
        let bytes = renderer.render(&all_prims, 400.0, 300.0).expect("render");
        let svg = String::from_utf8(bytes).expect("valid utf8");

        assert!(svg.contains("<rect"));
        assert!(svg.contains("<path"));
        assert!(svg.contains(">Note!</text>"));
        assert!(svg.starts_with("<svg"));
        assert!(svg.ends_with("</svg>"));
    }
}
