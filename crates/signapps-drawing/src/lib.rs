//! Unified drawing layer with primitive decomposition and multi-target rendering.
//!
//! This crate provides a shape-based drawing API that decomposes high-level shapes
//! (rectangles, ellipses, arrows, sticky notes, etc.) into atomic drawing primitives,
//! then renders them to various output formats (SVG, PNG, PDF).
//!
//! # Architecture
//!
//! 1. **Shapes** (`shapes`) -- high-level drawing objects with position, size, and style.
//! 2. **Primitives** (`primitives`) -- atomic visual elements (rect, ellipse, line, path, text, image, group).
//! 3. **Styles** (`styles`) -- fill, stroke, opacity, transforms, text anchoring.
//! 4. **Render** (`render`) -- multi-target rendering processors (SVG implemented, PNG/PDF planned).
//!
//! # Example
//!
//! ```
//! use signapps_drawing::shapes::{Shape, ShapeType};
//! use signapps_drawing::styles::ShapeStyle;
//! use signapps_drawing::render::svg::SvgRenderer;
//! use signapps_drawing::render::RenderProcessor;
//!
//! let shape = Shape {
//!     x: 10.0, y: 10.0, width: 200.0, height: 100.0,
//!     shape_type: ShapeType::Rectangle,
//!     style: ShapeStyle::new().with_fill("#3b82f6").with_stroke("#1e40af", 2.0),
//!     text: None,
//! };
//!
//! let primitives = shape.decompose();
//! let renderer = SvgRenderer;
//! let svg_bytes = renderer.render(&primitives, 300.0, 200.0).unwrap();
//! let svg_str = String::from_utf8(svg_bytes).unwrap();
//! assert!(svg_str.contains("<rect"));
//! ```

pub mod primitives;
pub mod render;
pub mod shapes;
pub mod styles;
