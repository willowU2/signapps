# Drawing Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a unified `signapps-drawing` crate providing primitive decomposition + multi-target rendering (SVG, PDF, PNG) for shapes embeddable in Docs, Sheets, and Slides.

**Architecture:** Shapes decompose into DrawPrimitives (rect, path, text, image, group). A RenderProcessor trait produces output for each target. The same primitives serve screen rendering (SVG/Canvas), PDF export, and thumbnail generation. tldraw stays for Whiteboard standalone.

**Tech Stack:** Rust (resvg, tiny-skia, printpdf), serde, SVG generation

---

## Task 1: Crate skeleton + primitive types

**Files:**
- Create: `crates/signapps-drawing/Cargo.toml`
- Create: `crates/signapps-drawing/src/lib.rs`
- Create: `crates/signapps-drawing/src/primitives.rs`
- Create: `crates/signapps-drawing/src/styles.rs`
- Modify: `Cargo.toml` (root workspace)

Cargo.toml deps: serde, serde_json, thiserror, tracing, uuid (all workspace), resvg, tiny-skia, printpdf.

primitives.rs: Define `DrawPrimitive` enum with variants:
- `Rect { x, y, width, height, style: ShapeStyle, corner_radius: f64 }`
- `Ellipse { cx, cy, rx, ry, style: ShapeStyle }`
- `Line { x1, y1, x2, y2, style: ShapeStyle }`
- `Path { d: String, style: ShapeStyle }` (SVG path data)
- `Text { x, y, text: String, font_size: f64, font_family: String, color: String, anchor: TextAnchor }`
- `Image { x, y, width, height, data_uri: String }`
- `Group { children: Vec<DrawPrimitive>, transform: Option<Transform> }`

styles.rs: Define `ShapeStyle` (fill, stroke, stroke_width, opacity, shadow), `Transform` (translate, rotate, scale), `TextAnchor` enum (Start, Middle, End).

lib.rs: re-exports.

---

## Task 2: Shape types + decomposition

**Files:**
- Create: `crates/signapps-drawing/src/shapes.rs`

High-level shapes that decompose into primitives:
- `Shape` enum: Rectangle, Ellipse, Arrow, Diamond, TextBox, Connector, StickyNote, CallOut
- Each variant has position (x,y,w,h), style, and shape-specific props
- `impl Shape { fn decompose(&self) -> Vec<DrawPrimitive> }` — converts to primitives

Arrow: line + triangle head. Diamond: rotated rect path. Connector: path between two points with optional label. StickyNote: rect + fold triangle. CallOut: rect + tail path.

---

## Task 3: SVG renderer

**Files:**
- Create: `crates/signapps-drawing/src/render/mod.rs`
- Create: `crates/signapps-drawing/src/render/svg.rs`

`RenderProcessor` trait: `fn render(&self, primitives: &[DrawPrimitive], width: f64, height: f64) -> Result<Vec<u8>>`

SvgRenderer: walks primitives, generates SVG XML string. Rect→`<rect>`, Ellipse→`<ellipse>`, Line→`<line>`, Path→`<path>`, Text→`<text>`, Image→`<image>`, Group→`<g>` with transform.

---

## Task 4: PNG renderer (thumbnails)

**Files:**
- Create: `crates/signapps-drawing/src/render/png.rs`

PngRenderer: SVG string → resvg/tiny-skia → PNG bytes. Uses SvgRenderer internally then rasterizes.

---

## Task 5: PDF renderer

**Files:**
- Create: `crates/signapps-drawing/src/render/pdf.rs`

PdfRenderer: walks primitives, writes to printpdf page. Rect→filled/stroked rect, Text→use_text, Line→line ops. Reuses same printpdf patterns as signapps-filters PDF filter.

---

## Task 6: Display tree + chart primitives

**Files:**
- Create: `crates/signapps-drawing/src/tree.rs`
- Create: `crates/signapps-drawing/src/charts.rs`

tree.rs: `DisplayTree { elements: Vec<DisplayElement> }` where `DisplayElement { id, primitives, z_index, visible, locked }`. Ordered by z_index for rendering.

charts.rs: `ChartDefinition { chart_type, data, options }` → `fn chart_to_primitives(def: &ChartDefinition) -> Vec<DrawPrimitive>`. Chart types: Bar, Line, Pie, Donut, Area, Scatter. Each produces primitives (rects for bars, paths for lines, arcs for pie slices, text for labels/axes).

---

## Task 7: Tests + wire into workspace

**Files:**
- Create: `crates/signapps-drawing/tests/render_tests.rs`

Tests: shape decomposition, SVG output contains expected elements, chart primitives count, display tree z-ordering.
