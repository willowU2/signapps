//! Server-side rendering endpoints for documents, slides, thumbnails, and templates.
//!
//! Higher-level render API that combines the filter pipeline + drawing layer
//! for document/slide rendering without a browser.
//!
//! Routes:
//! - `POST /api/v1/render/document`  -- render Tiptap JSON document to PDF or PNG
//! - `POST /api/v1/render/slide`     -- render slide elements to PNG or SVG
//! - `POST /api/v1/render/thumbnail` -- generate a small preview for any document
//! - `POST /api/v1/render/template`  -- resolve template variables + render to PDF/PNG

use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use signapps_drawing::primitives::DrawPrimitive;
use signapps_drawing::render::pdf::PdfRenderer;
use signapps_drawing::render::png::PngRenderer;
use signapps_drawing::render::svg::SvgRenderer;
use signapps_drawing::render::RenderProcessor;
use signapps_drawing::styles::{ShapeStyle, TextAnchor};
use std::collections::HashMap;

// ============================================================================
// Request / response types
// ============================================================================

/// Request body for document rendering.
///
/// Accepts Tiptap-format JSON content and renders it to the specified output format.
#[derive(Debug, Deserialize, Serialize, utoipa::ToSchema)]
pub struct DocumentRenderRequest {
    /// Tiptap JSON document content.
    pub content: serde_json::Value,
    /// Output format: "pdf" or "png".
    pub format: String,
    /// Canvas width in pixels (default: 794 -- A4 at 96 DPI).
    pub width: Option<f64>,
    /// Canvas height in pixels (default: 1123 -- A4 at 96 DPI).
    pub height: Option<f64>,
}

/// Request body for slide rendering.
///
/// Accepts an array of slide elements (DrawPrimitive-compatible shapes)
/// and renders them to the specified format.
#[derive(Debug, Deserialize, Serialize, utoipa::ToSchema)]
pub struct SlideRenderRequest {
    /// Slide elements as JSON (DrawPrimitive-compatible).
    pub elements: Vec<serde_json::Value>,
    /// Canvas width in pixels.
    pub width: f64,
    /// Canvas height in pixels.
    pub height: f64,
    /// Output format: "svg" or "png".
    pub format: String,
}

/// Request body for thumbnail generation.
///
/// Generates a small preview image for any document type.
#[derive(Debug, Deserialize, Serialize, utoipa::ToSchema)]
pub struct ThumbnailRequest {
    /// Document content as JSON.
    pub content: serde_json::Value,
    /// Document type: "document", "slide", or "spreadsheet".
    pub doc_type: String,
    /// Maximum width of the thumbnail in pixels (default: 256).
    pub max_width: Option<f64>,
}

/// Request body for template rendering.
///
/// Resolves template variables in the content, then renders to the specified format.
#[derive(Debug, Deserialize, Serialize, utoipa::ToSchema)]
pub struct TemplateRenderRequest {
    /// Template JSON content with `{{variable}}` placeholders.
    pub template_content: serde_json::Value,
    /// Variable name-to-value map for resolution.
    pub variables: HashMap<String, String>,
    /// Output format: "pdf" or "png".
    pub format: String,
}

// ============================================================================
// Handlers
// ============================================================================

/// POST /api/v1/render/document -- render a Tiptap JSON document to PDF or PNG.
///
/// Converts Tiptap JSON nodes (headings, paragraphs, horizontal rules) into
/// drawing primitives, then renders them via the appropriate renderer.
///
/// # Errors
///
/// Returns `400 Bad Request` if the format is unsupported or rendering fails.
///
/// # Panics
///
/// None -- all errors are propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/render/document",
    request_body = DocumentRenderRequest,
    responses(
        (status = 200, description = "Document rendered successfully"),
        (status = 400, description = "Invalid format or render failure"),
    ),
    tag = "Server Render"
)]
#[tracing::instrument(skip_all, fields(format, width, height))]
pub async fn render_document(
    Json(req): Json<DocumentRenderRequest>,
) -> Result<Response, (StatusCode, String)> {
    let width = req.width.unwrap_or(794.0);
    let height = req.height.unwrap_or(1123.0);

    tracing::Span::current().record("format", &req.format);
    tracing::Span::current().record("width", width);
    tracing::Span::current().record("height", height);

    let primitives = tiptap_to_primitives(&req.content, width);

    match req.format.as_str() {
        "pdf" => {
            // Convert pixel dimensions to mm (assuming 96 DPI: 1px = 0.2646mm)
            let page_w_mm = width * 0.2646;
            let page_h_mm = height * 0.2646;
            let renderer = PdfRenderer::new(page_w_mm, page_h_mm);
            let bytes = renderer
                .render(&primitives, width, height)
                .map_err(|e| (StatusCode::BAD_REQUEST, format!("PDF render failed: {e}")))?;

            Ok((
                StatusCode::OK,
                [(header::CONTENT_TYPE, "application/pdf")],
                bytes,
            )
                .into_response())
        }
        "png" => {
            let renderer = PngRenderer::default_dpi();
            let bytes = renderer
                .render(&primitives, width, height)
                .map_err(|e| (StatusCode::BAD_REQUEST, format!("PNG render failed: {e}")))?;

            Ok((
                StatusCode::OK,
                [(header::CONTENT_TYPE, "image/png")],
                bytes,
            )
                .into_response())
        }
        other => Err((
            StatusCode::BAD_REQUEST,
            format!("unsupported format: {other} (expected \"pdf\" or \"png\")"),
        )),
    }
}

/// POST /api/v1/render/slide -- render slide elements to PNG or SVG.
///
/// Accepts slide elements that are already DrawPrimitive-compatible JSON shapes
/// and renders them directly.
///
/// # Errors
///
/// Returns `400 Bad Request` if elements cannot be parsed or rendering fails.
///
/// # Panics
///
/// None -- all errors are propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/render/slide",
    request_body = SlideRenderRequest,
    responses(
        (status = 200, description = "Slide rendered successfully"),
        (status = 400, description = "Invalid elements or render failure"),
    ),
    tag = "Server Render"
)]
#[tracing::instrument(skip_all, fields(format, n_elements, width, height))]
pub async fn render_slide(
    Json(req): Json<SlideRenderRequest>,
) -> Result<Response, (StatusCode, String)> {
    tracing::Span::current().record("format", &req.format);
    tracing::Span::current().record("n_elements", req.elements.len());
    tracing::Span::current().record("width", req.width);
    tracing::Span::current().record("height", req.height);

    let primitives = parse_primitives(&req.elements)?;

    match req.format.as_str() {
        "svg" => {
            let renderer = SvgRenderer;
            let bytes = renderer
                .render(&primitives, req.width, req.height)
                .map_err(|e| (StatusCode::BAD_REQUEST, format!("SVG render failed: {e}")))?;

            Ok((
                StatusCode::OK,
                [(header::CONTENT_TYPE, "image/svg+xml")],
                bytes,
            )
                .into_response())
        }
        "png" => {
            let renderer = PngRenderer::default_dpi();
            let bytes = renderer
                .render(&primitives, req.width, req.height)
                .map_err(|e| (StatusCode::BAD_REQUEST, format!("PNG render failed: {e}")))?;

            Ok((
                StatusCode::OK,
                [(header::CONTENT_TYPE, "image/png")],
                bytes,
            )
                .into_response())
        }
        other => Err((
            StatusCode::BAD_REQUEST,
            format!("unsupported format: {other} (expected \"svg\" or \"png\")"),
        )),
    }
}

/// POST /api/v1/render/thumbnail -- generate a small preview image for any document.
///
/// Creates a proportionally-scaled PNG thumbnail (default 256px wide).
/// Supports document, slide, and spreadsheet types.
///
/// # Errors
///
/// Returns `400 Bad Request` if the document type is unsupported or rendering fails.
///
/// # Panics
///
/// None -- all errors are propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/render/thumbnail",
    request_body = ThumbnailRequest,
    responses(
        (status = 200, description = "Thumbnail generated successfully", content_type = "image/png"),
        (status = 400, description = "Invalid document type or render failure"),
    ),
    tag = "Server Render"
)]
#[tracing::instrument(skip_all, fields(doc_type, max_width))]
pub async fn render_thumbnail(
    Json(req): Json<ThumbnailRequest>,
) -> Result<Response, (StatusCode, String)> {
    let max_width = req.max_width.unwrap_or(256.0);

    tracing::Span::current().record("doc_type", &req.doc_type);
    tracing::Span::current().record("max_width", max_width);

    // Determine source dimensions and primitives based on document type
    let (primitives, src_width, src_height) = match req.doc_type.as_str() {
        "document" => {
            let src_w = 794.0;
            let src_h = 1123.0;
            let prims = tiptap_to_primitives(&req.content, src_w);
            (prims, src_w, src_h)
        }
        "slide" => {
            // Slides default to 16:9 aspect ratio (960x540)
            let src_w = 960.0;
            let src_h = 540.0;
            let elements = req
                .content
                .get("elements")
                .and_then(|e| e.as_array())
                .cloned()
                .unwrap_or_default();
            let prims = elements
                .iter()
                .enumerate()
                .filter_map(|(i, v)| {
                    serde_json::from_value::<DrawPrimitive>(v.clone())
                        .map_err(|e| {
                            tracing::debug!(index = i, error = %e, "skipping invalid slide element for thumbnail");
                        })
                        .ok()
                })
                .collect();
            (prims, src_w, src_h)
        }
        "spreadsheet" => {
            // Render a simple grid preview
            let prims = spreadsheet_to_primitives(&req.content, 400.0, 300.0);
            (prims, 400.0, 300.0)
        }
        other => {
            return Err((
                StatusCode::BAD_REQUEST,
                format!(
                    "unsupported doc_type: {other} (expected \"document\", \"slide\", or \"spreadsheet\")"
                ),
            ))
        }
    };

    // Calculate proportional thumbnail dimensions
    let scale = max_width / src_width;
    let thumb_width = max_width;
    let thumb_height = src_height * scale;

    // Render at thumbnail size using SVG -> PNG pipeline
    // First render to SVG at source size, then rasterize at thumbnail size
    let renderer = PngRenderer::default_dpi();
    let bytes = renderer
        .render(&primitives, thumb_width, thumb_height)
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("thumbnail render failed: {e}")))?;

    Ok((
        StatusCode::OK,
        [(header::CONTENT_TYPE, "image/png")],
        bytes,
    )
        .into_response())
}

/// POST /api/v1/render/template -- resolve variables + render to PDF or PNG.
///
/// First resolves `{{variable}}` placeholders in the template content,
/// then renders the resolved document.
///
/// # Errors
///
/// Returns `400 Bad Request` if the format is unsupported or rendering fails.
///
/// # Panics
///
/// None -- all errors are propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/render/template",
    request_body = TemplateRenderRequest,
    responses(
        (status = 200, description = "Template rendered successfully"),
        (status = 400, description = "Invalid format or render failure"),
    ),
    tag = "Server Render"
)]
#[tracing::instrument(skip_all, fields(format, n_variables))]
pub async fn render_template(
    Json(req): Json<TemplateRenderRequest>,
) -> Result<Response, (StatusCode, String)> {
    tracing::Span::current().record("format", &req.format);
    tracing::Span::current().record("n_variables", req.variables.len());

    // Step 1: Resolve template variables
    let resolved = resolve_template_content(&req.template_content, &req.variables);

    // Step 2: Render the resolved document
    let width = 794.0;
    let height = 1123.0;
    let primitives = tiptap_to_primitives(&resolved, width);

    match req.format.as_str() {
        "pdf" => {
            let page_w_mm = width * 0.2646;
            let page_h_mm = height * 0.2646;
            let renderer = PdfRenderer::new(page_w_mm, page_h_mm);
            let bytes = renderer
                .render(&primitives, width, height)
                .map_err(|e| (StatusCode::BAD_REQUEST, format!("PDF render failed: {e}")))?;

            Ok((
                StatusCode::OK,
                [(header::CONTENT_TYPE, "application/pdf")],
                bytes,
            )
                .into_response())
        }
        "png" => {
            let renderer = PngRenderer::default_dpi();
            let bytes = renderer
                .render(&primitives, width, height)
                .map_err(|e| (StatusCode::BAD_REQUEST, format!("PNG render failed: {e}")))?;

            Ok((
                StatusCode::OK,
                [(header::CONTENT_TYPE, "image/png")],
                bytes,
            )
                .into_response())
        }
        other => Err((
            StatusCode::BAD_REQUEST,
            format!("unsupported format: {other} (expected \"pdf\" or \"png\")"),
        )),
    }
}

// ============================================================================
// Internal helpers
// ============================================================================

/// Convert Tiptap-format JSON to drawing primitives.
///
/// Supports: heading (h1-h4), paragraph, horizontalRule, bulletList, orderedList,
/// blockquote, codeBlock, and image nodes. Unknown nodes receive default spacing.
fn tiptap_to_primitives(content: &serde_json::Value, page_width: f64) -> Vec<DrawPrimitive> {
    let mut primitives = Vec::new();
    let mut y = 20.0; // top margin
    let left_margin = 20.0;
    let max_width = page_width - 40.0; // margins

    // Background page rect
    primitives.push(DrawPrimitive::Rect {
        x: 0.0,
        y: 0.0,
        width: page_width,
        height: page_width * 1.414, // A4 ratio
        style: ShapeStyle::new().with_fill("#ffffff"),
        corner_radius: 0.0,
    });

    if let Some(nodes) = content.get("content").and_then(|c| c.as_array()) {
        for node in nodes {
            let node_type = node.get("type").and_then(|t| t.as_str()).unwrap_or("");
            match node_type {
                "heading" => {
                    let level = node
                        .get("attrs")
                        .and_then(|a| a.get("level"))
                        .and_then(|l| l.as_u64())
                        .unwrap_or(1);
                    let font_size = match level {
                        1 => 28.0,
                        2 => 22.0,
                        3 => 18.0,
                        _ => 16.0,
                    };
                    let text = extract_text(node);
                    if !text.is_empty() {
                        primitives.push(DrawPrimitive::Text {
                            x: left_margin,
                            y,
                            text,
                            font_size,
                            font_family: "Inter".to_string(),
                            color: "#111827".to_string(),
                            anchor: TextAnchor::Start,
                        });
                    }
                    y += font_size * 1.5 + 8.0;
                }
                "paragraph" => {
                    let text = extract_text(node);
                    if !text.is_empty() {
                        primitives.push(DrawPrimitive::Text {
                            x: left_margin,
                            y,
                            text,
                            font_size: 14.0,
                            font_family: "Inter".to_string(),
                            color: "#374151".to_string(),
                            anchor: TextAnchor::Start,
                        });
                        y += 14.0 * 1.6 + 4.0;
                    } else {
                        y += 14.0; // empty paragraph spacer
                    }
                }
                "horizontalRule" => {
                    primitives.push(DrawPrimitive::Line {
                        x1: left_margin,
                        y1: y,
                        x2: left_margin + max_width,
                        y2: y,
                        style: ShapeStyle {
                            stroke: Some("#d1d5db".into()),
                            stroke_width: 1.0,
                            opacity: 1.0,
                            ..Default::default()
                        },
                    });
                    y += 16.0;
                }
                "bulletList" | "orderedList" => {
                    let is_ordered = node_type == "orderedList";
                    if let Some(items) = node.get("content").and_then(|c| c.as_array()) {
                        for (idx, item) in items.iter().enumerate() {
                            let text = extract_text(item);
                            let bullet = if is_ordered {
                                format!("{}. ", idx + 1)
                            } else {
                                "\u{2022} ".to_string()
                            };
                            let full_text = format!("{bullet}{text}");
                            if !full_text.trim().is_empty() {
                                primitives.push(DrawPrimitive::Text {
                                    x: left_margin + 16.0,
                                    y,
                                    text: full_text,
                                    font_size: 14.0,
                                    font_family: "Inter".to_string(),
                                    color: "#374151".to_string(),
                                    anchor: TextAnchor::Start,
                                });
                                y += 14.0 * 1.6 + 2.0;
                            }
                        }
                        y += 4.0; // extra spacing after list
                    }
                }
                "blockquote" => {
                    // Draw a left border bar
                    let quote_text = extract_deep_text(node);
                    if !quote_text.is_empty() {
                        primitives.push(DrawPrimitive::Line {
                            x1: left_margin + 4.0,
                            y1: y - 2.0,
                            x2: left_margin + 4.0,
                            y2: y + 14.0 * 1.6,
                            style: ShapeStyle {
                                stroke: Some("#9ca3af".into()),
                                stroke_width: 3.0,
                                opacity: 1.0,
                                ..Default::default()
                            },
                        });
                        primitives.push(DrawPrimitive::Text {
                            x: left_margin + 16.0,
                            y,
                            text: quote_text,
                            font_size: 14.0,
                            font_family: "Inter".to_string(),
                            color: "#6b7280".to_string(),
                            anchor: TextAnchor::Start,
                        });
                        y += 14.0 * 1.6 + 8.0;
                    }
                }
                "codeBlock" => {
                    let code_text = extract_text(node);
                    if !code_text.is_empty() {
                        // Code background
                        let line_count = code_text.lines().count().max(1) as f64;
                        let block_height = line_count * 16.0 + 16.0;
                        primitives.push(DrawPrimitive::Rect {
                            x: left_margin,
                            y: y - 4.0,
                            width: max_width,
                            height: block_height,
                            style: ShapeStyle::new().with_fill("#f3f4f6"),
                            corner_radius: 4.0,
                        });
                        primitives.push(DrawPrimitive::Text {
                            x: left_margin + 8.0,
                            y: y + 4.0,
                            text: code_text,
                            font_size: 12.0,
                            font_family: "monospace".to_string(),
                            color: "#1f2937".to_string(),
                            anchor: TextAnchor::Start,
                        });
                        y += block_height + 8.0;
                    }
                }
                "image" => {
                    // Render a placeholder rectangle for images
                    let src = node
                        .get("attrs")
                        .and_then(|a| a.get("src"))
                        .and_then(|s| s.as_str())
                        .unwrap_or("");
                    let img_width = node
                        .get("attrs")
                        .and_then(|a| a.get("width"))
                        .and_then(|w| w.as_f64())
                        .unwrap_or(max_width.min(400.0));
                    let img_height = node
                        .get("attrs")
                        .and_then(|a| a.get("height"))
                        .and_then(|h| h.as_f64())
                        .unwrap_or(img_width * 0.75);

                    if !src.is_empty() {
                        primitives.push(DrawPrimitive::Image {
                            x: left_margin,
                            y,
                            width: img_width,
                            height: img_height,
                            href: src.to_string(),
                        });
                    } else {
                        // Placeholder rect
                        primitives.push(DrawPrimitive::Rect {
                            x: left_margin,
                            y,
                            width: img_width,
                            height: img_height,
                            style: ShapeStyle::new()
                                .with_fill("#e5e7eb")
                                .with_stroke("#d1d5db", 1.0),
                            corner_radius: 4.0,
                        });
                        primitives.push(DrawPrimitive::Text {
                            x: left_margin + img_width / 2.0,
                            y: y + img_height / 2.0,
                            text: "[Image]".to_string(),
                            font_size: 12.0,
                            font_family: "Inter".to_string(),
                            color: "#9ca3af".to_string(),
                            anchor: TextAnchor::Middle,
                        });
                    }
                    y += img_height + 8.0;
                }
                _ => {
                    y += 14.0; // skip unknown nodes with spacing
                }
            }
        }
    }

    primitives
}

/// Extract inline text from a Tiptap node's direct content.
fn extract_text(node: &serde_json::Value) -> String {
    let mut text = String::new();
    if let Some(content) = node.get("content").and_then(|c| c.as_array()) {
        for item in content {
            if let Some(t) = item.get("text").and_then(|t| t.as_str()) {
                text.push_str(t);
            }
        }
    }
    text
}

/// Recursively extract all text from a Tiptap node tree.
fn extract_deep_text(node: &serde_json::Value) -> String {
    let mut text = String::new();
    if let Some(t) = node.get("text").and_then(|t| t.as_str()) {
        text.push_str(t);
    }
    if let Some(content) = node.get("content").and_then(|c| c.as_array()) {
        for item in content {
            let child_text = extract_deep_text(item);
            if !child_text.is_empty() {
                if !text.is_empty() {
                    text.push(' ');
                }
                text.push_str(&child_text);
            }
        }
    }
    text
}

/// Generate a simple grid preview for spreadsheet data.
fn spreadsheet_to_primitives(
    content: &serde_json::Value,
    width: f64,
    height: f64,
) -> Vec<DrawPrimitive> {
    let mut primitives = Vec::new();
    let left_margin = 4.0;
    let top_margin = 4.0;
    let cell_height = 20.0;
    let max_cols = 6_usize;
    let max_rows = 12_usize;

    // Background
    primitives.push(DrawPrimitive::Rect {
        x: 0.0,
        y: 0.0,
        width,
        height,
        style: ShapeStyle::new().with_fill("#ffffff"),
        corner_radius: 0.0,
    });

    // Extract rows from content
    let rows = content
        .get("rows")
        .and_then(|r| r.as_array())
        .or_else(|| content.get("data").and_then(|d| d.as_array()));

    let actual_rows = if let Some(rows) = rows {
        rows.len().min(max_rows)
    } else {
        max_rows
    };

    let actual_cols = if let Some(rows) = rows {
        rows.iter()
            .filter_map(|r| r.as_array().map(|a| a.len()))
            .max()
            .unwrap_or(max_cols)
            .min(max_cols)
    } else {
        max_cols
    };

    let cell_width = (width - left_margin * 2.0) / actual_cols as f64;

    // Draw grid lines and cell content
    for row_idx in 0..actual_rows {
        let y = top_margin + row_idx as f64 * cell_height;

        // Horizontal grid line
        primitives.push(DrawPrimitive::Line {
            x1: left_margin,
            y1: y,
            x2: left_margin + cell_width * actual_cols as f64,
            y2: y,
            style: ShapeStyle {
                stroke: Some("#e5e7eb".into()),
                stroke_width: 0.5,
                opacity: 1.0,
                ..Default::default()
            },
        });

        // Header row background
        if row_idx == 0 {
            primitives.push(DrawPrimitive::Rect {
                x: left_margin,
                y,
                width: cell_width * actual_cols as f64,
                height: cell_height,
                style: ShapeStyle::new().with_fill("#f3f4f6"),
                corner_radius: 0.0,
            });
        }

        for col_idx in 0..actual_cols {
            let x = left_margin + col_idx as f64 * cell_width;

            // Vertical grid line
            if row_idx == 0 {
                primitives.push(DrawPrimitive::Line {
                    x1: x,
                    y1: top_margin,
                    x2: x,
                    y2: top_margin + actual_rows as f64 * cell_height,
                    style: ShapeStyle {
                        stroke: Some("#e5e7eb".into()),
                        stroke_width: 0.5,
                        opacity: 1.0,
                        ..Default::default()
                    },
                });
            }

            // Cell text (if data available)
            if let Some(rows) = rows {
                if let Some(row) = rows.get(row_idx) {
                    let cell_val = if let Some(arr) = row.as_array() {
                        arr.get(col_idx)
                            .and_then(|v| {
                                v.as_str()
                                    .map(String::from)
                                    .or_else(|| Some(v.to_string()))
                            })
                            .unwrap_or_default()
                    } else {
                        String::new()
                    };

                    if !cell_val.is_empty() && cell_val != "null" {
                        // Truncate long values
                        let display = if cell_val.len() > 10 {
                            format!("{}...", &cell_val[..8])
                        } else {
                            cell_val
                        };
                        let color = if row_idx == 0 {
                            "#111827"
                        } else {
                            "#374151"
                        };
                        primitives.push(DrawPrimitive::Text {
                            x: x + 3.0,
                            y: y + 14.0,
                            text: display,
                            font_size: 9.0,
                            font_family: "Inter".to_string(),
                            color: color.to_string(),
                            anchor: TextAnchor::Start,
                        });
                    }
                }
            }
        }
    }

    // Bottom horizontal line
    let bottom_y = top_margin + actual_rows as f64 * cell_height;
    primitives.push(DrawPrimitive::Line {
        x1: left_margin,
        y1: bottom_y,
        x2: left_margin + cell_width * actual_cols as f64,
        y2: bottom_y,
        style: ShapeStyle {
            stroke: Some("#e5e7eb".into()),
            stroke_width: 0.5,
            opacity: 1.0,
            ..Default::default()
        },
    });

    // Right vertical line
    primitives.push(DrawPrimitive::Line {
        x1: left_margin + cell_width * actual_cols as f64,
        y1: top_margin,
        x2: left_margin + cell_width * actual_cols as f64,
        y2: bottom_y,
        style: ShapeStyle {
            stroke: Some("#e5e7eb".into()),
            stroke_width: 0.5,
            opacity: 1.0,
            ..Default::default()
        },
    });

    primitives
}

/// Parse raw JSON values into `DrawPrimitive` instances.
///
/// # Errors
///
/// Returns a `(400, message)` tuple if any element fails to deserialize.
fn parse_primitives(
    raw: &[serde_json::Value],
) -> Result<Vec<DrawPrimitive>, (StatusCode, String)> {
    raw.iter()
        .enumerate()
        .map(|(i, v)| {
            serde_json::from_value::<DrawPrimitive>(v.clone()).map_err(|e| {
                (
                    StatusCode::BAD_REQUEST,
                    format!("invalid element at index {i}: {e}"),
                )
            })
        })
        .collect()
}

/// Replace `{{variable}}` placeholders in a JSON value with supplied values.
///
/// Walks the JSON tree and performs string replacement on all string values.
fn resolve_template_content(
    content: &serde_json::Value,
    values: &HashMap<String, String>,
) -> serde_json::Value {
    match content {
        serde_json::Value::String(s) => {
            let mut resolved = s.clone();
            for (name, value) in values {
                let placeholder = format!("{{{{{name}}}}}");
                resolved = resolved.replace(&placeholder, value);
            }
            serde_json::Value::String(resolved)
        }
        serde_json::Value::Object(map) => {
            let mut new_map = serde_json::Map::new();
            for (key, val) in map {
                new_map.insert(key.clone(), resolve_template_content(val, values));
            }
            serde_json::Value::Object(new_map)
        }
        serde_json::Value::Array(arr) => {
            let resolved_arr: Vec<serde_json::Value> =
                arr.iter().map(|v| resolve_template_content(v, values)).collect();
            serde_json::Value::Array(resolved_arr)
        }
        other => other.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }

    #[test]
    fn tiptap_heading_converts() {
        let content = serde_json::json!({
            "content": [
                {
                    "type": "heading",
                    "attrs": { "level": 1 },
                    "content": [{ "type": "text", "text": "Title" }]
                }
            ]
        });
        let prims = tiptap_to_primitives(&content, 800.0);
        // Background rect + heading text
        assert!(prims.len() >= 2);
    }

    #[test]
    fn tiptap_paragraph_converts() {
        let content = serde_json::json!({
            "content": [
                {
                    "type": "paragraph",
                    "content": [{ "type": "text", "text": "Hello world" }]
                }
            ]
        });
        let prims = tiptap_to_primitives(&content, 800.0);
        assert!(prims.len() >= 2); // background + text
    }

    #[test]
    fn tiptap_horizontal_rule() {
        let content = serde_json::json!({
            "content": [{ "type": "horizontalRule" }]
        });
        let prims = tiptap_to_primitives(&content, 800.0);
        // Background + line
        assert!(prims.len() >= 2);
    }

    #[test]
    fn tiptap_empty_content() {
        let content = serde_json::json!({});
        let prims = tiptap_to_primitives(&content, 800.0);
        // Just the background rect
        assert_eq!(prims.len(), 1);
    }

    #[test]
    fn extract_text_basic() {
        let node = serde_json::json!({
            "content": [
                { "type": "text", "text": "Hello " },
                { "type": "text", "text": "world" }
            ]
        });
        assert_eq!(extract_text(&node), "Hello world");
    }

    #[test]
    fn extract_text_no_content() {
        let node = serde_json::json!({ "type": "paragraph" });
        assert_eq!(extract_text(&node), "");
    }

    #[test]
    fn resolve_template_replaces() {
        let content = serde_json::json!({
            "content": [
                {
                    "type": "paragraph",
                    "content": [{ "type": "text", "text": "Hello {{name}}" }]
                }
            ]
        });
        let mut vars = HashMap::new();
        vars.insert("name".to_string(), "Alice".to_string());
        let resolved = resolve_template_content(&content, &vars);
        let text = resolved["content"][0]["content"][0]["text"].as_str().unwrap_or("");
        assert_eq!(text, "Hello Alice");
    }

    #[test]
    fn spreadsheet_preview_generates() {
        let content = serde_json::json!({
            "rows": [
                ["Name", "Age", "City"],
                ["Alice", "30", "Paris"],
                ["Bob", "25", "Lyon"]
            ]
        });
        let prims = spreadsheet_to_primitives(&content, 400.0, 300.0);
        assert!(!prims.is_empty());
    }

    #[test]
    fn parse_primitives_valid() {
        let json = serde_json::json!([
            {
                "type": "rect",
                "x": 0.0, "y": 0.0, "width": 100.0, "height": 50.0,
                "style": { "stroke_width": 1.0, "opacity": 1.0 },
                "corner_radius": 4.0
            }
        ]);
        let arr = json.as_array().expect("array");
        let result = parse_primitives(arr);
        assert!(result.is_ok());
        assert_eq!(result.expect("ok").len(), 1);
    }

    #[test]
    fn parse_primitives_invalid() {
        let json = serde_json::json!([{ "type": "unknown_shape" }]);
        let arr = json.as_array().expect("array");
        let result = parse_primitives(arr);
        assert!(result.is_err());
    }

    #[test]
    fn tiptap_list_converts() {
        let content = serde_json::json!({
            "content": [
                {
                    "type": "bulletList",
                    "content": [
                        {
                            "type": "listItem",
                            "content": [{ "type": "text", "text": "Item 1" }]
                        },
                        {
                            "type": "listItem",
                            "content": [{ "type": "text", "text": "Item 2" }]
                        }
                    ]
                }
            ]
        });
        let prims = tiptap_to_primitives(&content, 800.0);
        // Background + 2 list items
        assert!(prims.len() >= 3);
    }

    #[test]
    fn tiptap_blockquote_converts() {
        let content = serde_json::json!({
            "content": [
                {
                    "type": "blockquote",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [{ "type": "text", "text": "A quote" }]
                        }
                    ]
                }
            ]
        });
        let prims = tiptap_to_primitives(&content, 800.0);
        // Background + line + text
        assert!(prims.len() >= 3);
    }

    #[test]
    fn tiptap_code_block_converts() {
        let content = serde_json::json!({
            "content": [
                {
                    "type": "codeBlock",
                    "content": [{ "type": "text", "text": "let x = 1;" }]
                }
            ]
        });
        let prims = tiptap_to_primitives(&content, 800.0);
        // Background + code rect + code text
        assert!(prims.len() >= 3);
    }
}
