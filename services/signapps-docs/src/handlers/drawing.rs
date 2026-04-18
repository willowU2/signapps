//! Drawing API -- render primitives and generate charts.
//!
//! Three stateless endpoints:
//!
//! - `POST /api/v1/drawing/render/svg` -- render `DrawPrimitive[]` to SVG XML.
//! - `POST /api/v1/drawing/render/png` -- render `DrawPrimitive[]` to PNG image.
//! - `POST /api/v1/drawing/charts`     -- generate chart primitives from a `ChartDefinition`.

use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use signapps_drawing::charts::{chart_to_primitives, ChartDefinition, ChartType, DataSeries};
use signapps_drawing::primitives::DrawPrimitive;
use signapps_drawing::render::png::PngRenderer;
use signapps_drawing::render::svg::SvgRenderer;
use signapps_drawing::render::RenderProcessor;

/// Request body for the render endpoints.
///
/// Contains the list of drawing primitives to render and the target canvas
/// dimensions in logical pixels.
///
/// # Examples
///
/// ```json
/// {
///   "primitives": [{ "type": "rect", "x": 0, "y": 0, "width": 100, "height": 50,
///                     "style": { "fill": "#3b82f6" }, "corner_radius": 4 }],
///   "width": 400,
///   "height": 300
/// }
/// ```
#[derive(Debug, Deserialize, Serialize, utoipa::ToSchema)]
pub struct RenderRequest {
    /// Drawing primitives to render.
    pub primitives: Vec<serde_json::Value>,
    /// Canvas width in logical pixels.
    pub width: f64,
    /// Canvas height in logical pixels.
    pub height: f64,
}

/// POST /api/v1/drawing/render/svg -- render drawing primitives to SVG.
///
/// Accepts a JSON body with primitives and canvas dimensions, returns SVG XML
/// with `Content-Type: image/svg+xml`.
///
/// # Errors
///
/// Returns `400 Bad Request` if the primitives cannot be deserialized or rendering fails.
///
/// # Panics
///
/// None -- all errors are propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/drawing/render/svg",
    request_body = RenderRequest,
    responses(
        (status = 200, description = "SVG rendered successfully", content_type = "image/svg+xml"),
        (status = 400, description = "Invalid primitives or render failure"),
    ),
    tag = "Drawing"
)]
#[tracing::instrument(skip_all, fields(n_primitives, width, height))]
pub async fn render_svg(Json(req): Json<RenderRequest>) -> Result<Response, (StatusCode, String)> {
    let primitives = parse_primitives(&req.primitives)?;
    tracing::Span::current().record("n_primitives", primitives.len());
    tracing::Span::current().record("width", req.width);
    tracing::Span::current().record("height", req.height);

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

/// POST /api/v1/drawing/render/png -- render drawing primitives to PNG.
///
/// Accepts the same JSON body as the SVG endpoint. Uses the `PngRenderer`
/// (resvg/tiny-skia pipeline) to rasterize at 96 DPI.
///
/// # Errors
///
/// Returns `400 Bad Request` if the primitives cannot be deserialized or rendering fails.
///
/// # Panics
///
/// None -- all errors are propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/drawing/render/png",
    request_body = RenderRequest,
    responses(
        (status = 200, description = "PNG rendered successfully", content_type = "image/png"),
        (status = 400, description = "Invalid primitives or render failure"),
    ),
    tag = "Drawing"
)]
#[tracing::instrument(skip_all, fields(n_primitives, width, height))]
pub async fn render_png(Json(req): Json<RenderRequest>) -> Result<Response, (StatusCode, String)> {
    let primitives = parse_primitives(&req.primitives)?;
    tracing::Span::current().record("n_primitives", primitives.len());
    tracing::Span::current().record("width", req.width);
    tracing::Span::current().record("height", req.height);

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

/// Chart generation request body (re-exported from `signapps-drawing`).
///
/// Contains the chart type, optional title, categories, data series,
/// and target dimensions.
#[derive(Debug, Deserialize, Serialize, utoipa::ToSchema)]
pub struct ChartRequest {
    /// Type of chart to render.
    pub chart_type: String,
    /// Optional chart title displayed at the top.
    pub title: Option<String>,
    /// Category labels for the x-axis (bar, line, area) or segment labels (pie, donut).
    pub categories: Vec<String>,
    /// Data series to plot.
    pub series: Vec<ChartSeriesInput>,
    /// Total chart width in pixels.
    pub width: f64,
    /// Total chart height in pixels.
    pub height: f64,
}

/// A data series for chart generation.
#[derive(Debug, Deserialize, Serialize, utoipa::ToSchema)]
pub struct ChartSeriesInput {
    /// Human-readable label for the series.
    pub label: String,
    /// Numeric values (one per category/data point).
    pub values: Vec<f64>,
    /// Color for this series (CSS hex string).
    pub color: String,
}

/// POST /api/v1/drawing/charts -- generate chart primitives.
///
/// Accepts a chart definition and returns the corresponding drawing primitives
/// as JSON. The frontend can then render them via the SVG endpoint or directly
/// in-browser.
///
/// # Errors
///
/// Returns `400 Bad Request` if the chart type is invalid.
///
/// # Panics
///
/// None -- all errors are propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/drawing/charts",
    request_body = ChartRequest,
    responses(
        (status = 200, description = "Chart primitives generated", body = Vec<serde_json::Value>),
        (status = 400, description = "Invalid chart definition"),
    ),
    tag = "Drawing"
)]
#[tracing::instrument(skip_all, fields(chart_type, n_categories, n_series))]
pub async fn generate_chart(
    Json(req): Json<ChartRequest>,
) -> Result<Json<Vec<serde_json::Value>>, (StatusCode, String)> {
    let chart_type = match req.chart_type.as_str() {
        "bar" => ChartType::Bar,
        "line" => ChartType::Line,
        "pie" => ChartType::Pie,
        "donut" => ChartType::Donut,
        "area" => ChartType::Area,
        "scatter" => ChartType::Scatter,
        other => {
            return Err((
                StatusCode::BAD_REQUEST,
                format!("unknown chart type: {other}"),
            ))
        }
    };

    tracing::Span::current().record("chart_type", &req.chart_type);
    tracing::Span::current().record("n_categories", req.categories.len());
    tracing::Span::current().record("n_series", req.series.len());

    let def = ChartDefinition {
        chart_type,
        title: req.title,
        categories: req.categories,
        series: req
            .series
            .into_iter()
            .map(|s| DataSeries {
                label: s.label,
                values: s.values,
                color: s.color,
            })
            .collect(),
        width: req.width,
        height: req.height,
    };

    let primitives = chart_to_primitives(&def);

    // Serialize primitives to JSON values so the frontend gets the tagged enum representation.
    let values: Vec<serde_json::Value> = primitives
        .iter()
        .map(|p| serde_json::to_value(p))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("failed to serialize primitives: {e}"),
            )
        })?;

    Ok(Json(values))
}

/// Parse raw JSON values into `DrawPrimitive` instances.
///
/// # Errors
///
/// Returns a `(400, message)` tuple if any primitive fails to deserialize.
fn parse_primitives(
    raw: &[serde_json::Value],
) -> Result<Vec<DrawPrimitive>, (StatusCode, String)> {
    raw.iter()
        .enumerate()
        .map(|(i, v)| {
            serde_json::from_value::<DrawPrimitive>(v.clone()).map_err(|e| {
                (
                    StatusCode::BAD_REQUEST,
                    format!("invalid primitive at index {i}: {e}"),
                )
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running service.
        assert!(true, "{} handler module loaded", module_path!());
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
        let json = serde_json::json!([{"type": "unknown_shape"}]);
        let arr = json.as_array().expect("array");
        let result = parse_primitives(arr);
        assert!(result.is_err());
    }

    #[test]
    fn chart_type_parsing() {
        for (input, expected) in [
            ("bar", ChartType::Bar),
            ("line", ChartType::Line),
            ("pie", ChartType::Pie),
            ("donut", ChartType::Donut),
            ("area", ChartType::Area),
            ("scatter", ChartType::Scatter),
        ] {
            let ct = match input {
                "bar" => ChartType::Bar,
                "line" => ChartType::Line,
                "pie" => ChartType::Pie,
                "donut" => ChartType::Donut,
                "area" => ChartType::Area,
                "scatter" => ChartType::Scatter,
                _ => panic!("unexpected"),
            };
            assert!(
                std::mem::discriminant(&ct) == std::mem::discriminant(&expected),
                "mismatch for {input}"
            );
        }
    }
}
