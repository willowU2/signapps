//! Chart generation -- converts data to drawing primitives.
//!
//! Supports six chart types: Bar, Line, Pie, Donut, Area, and Scatter.
//! Each chart definition is converted to a vector of [`DrawPrimitive`]s that
//! can be rendered by any renderer (SVG, PNG, PDF).
//!
//! # Layout
//!
//! Charts use a consistent layout with 40px margins, title at top, and
//! axes at bottom/left where applicable.
//!
//! # Examples
//!
//! ```
//! use signapps_drawing::charts::{ChartDefinition, ChartType, DataSeries, chart_to_primitives};
//!
//! let def = ChartDefinition {
//!     chart_type: ChartType::Bar,
//!     title: Some("Sales".to_string()),
//!     categories: vec!["Q1".into(), "Q2".into(), "Q3".into()],
//!     series: vec![DataSeries {
//!         label: "Revenue".into(),
//!         values: vec![100.0, 150.0, 120.0],
//!         color: "#3b82f6".into(),
//!     }],
//!     width: 400.0,
//!     height: 300.0,
//! };
//!
//! let primitives = chart_to_primitives(&def);
//! assert!(!primitives.is_empty());
//! ```

use serde::{Deserialize, Serialize};

use crate::primitives::DrawPrimitive;
use crate::styles::{ShapeStyle, TextAnchor};

/// Chart margin in pixels (applied to all sides).
const MARGIN: f64 = 40.0;

/// Height reserved for the title area.
const TITLE_HEIGHT: f64 = 24.0;

/// Chart type discriminant.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ChartType {
    /// Vertical bar chart.
    Bar,
    /// Line chart with connected data points.
    Line,
    /// Pie chart with arc segments.
    Pie,
    /// Donut chart (pie with inner cutout).
    Donut,
    /// Area chart (line with filled region below).
    Area,
    /// Scatter plot with individual data points.
    Scatter,
}

/// A data series for charting.
///
/// Each series has a label, numeric values, and a color for rendering.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataSeries {
    /// Human-readable label for the series.
    pub label: String,
    /// Numeric values (one per category/data point).
    pub values: Vec<f64>,
    /// Color for this series (CSS hex string).
    pub color: String,
}

/// Chart definition with data and layout.
///
/// Contains all the information needed to generate chart primitives:
/// the chart type, optional title, category labels, data series,
/// and overall dimensions.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartDefinition {
    /// Type of chart to render.
    pub chart_type: ChartType,
    /// Optional chart title displayed at the top.
    pub title: Option<String>,
    /// Category labels for the x-axis (bar, line, area) or segment labels (pie, donut).
    pub categories: Vec<String>,
    /// Data series to plot.
    pub series: Vec<DataSeries>,
    /// Total chart width in pixels.
    pub width: f64,
    /// Total chart height in pixels.
    pub height: f64,
}

/// Convert a chart definition to drawing primitives.
///
/// Dispatches to the appropriate chart-type-specific function.
///
/// # Examples
///
/// ```
/// use signapps_drawing::charts::{ChartDefinition, ChartType, DataSeries, chart_to_primitives};
///
/// let def = ChartDefinition {
///     chart_type: ChartType::Scatter,
///     title: None,
///     categories: vec![],
///     series: vec![DataSeries {
///         label: "Points".into(),
///         values: vec![10.0, 20.0, 30.0, 25.0],
///         color: "#ef4444".into(),
///     }],
///     width: 300.0,
///     height: 200.0,
/// };
/// let prims = chart_to_primitives(&def);
/// assert!(!prims.is_empty());
/// ```
pub fn chart_to_primitives(def: &ChartDefinition) -> Vec<DrawPrimitive> {
    match def.chart_type {
        ChartType::Bar => bar_chart(def),
        ChartType::Line => line_chart(def),
        ChartType::Pie => pie_chart(def),
        ChartType::Donut => donut_chart(def),
        ChartType::Scatter => scatter_chart(def),
        ChartType::Area => area_chart(def),
    }
}

/// Compute the chart area bounds after margins and title.
fn chart_area(def: &ChartDefinition) -> (f64, f64, f64, f64) {
    let top = MARGIN
        + if def.title.is_some() {
            TITLE_HEIGHT
        } else {
            0.0
        };
    let left = MARGIN;
    let right = def.width - MARGIN;
    let bottom = def.height - MARGIN;
    (left, top, right, bottom)
}

/// Create the background rect and optional title text primitives.
fn chart_background_and_title(def: &ChartDefinition) -> Vec<DrawPrimitive> {
    let mut prims = Vec::new();

    // Background rect
    prims.push(DrawPrimitive::Rect {
        x: 0.0,
        y: 0.0,
        width: def.width,
        height: def.height,
        style: ShapeStyle::new().with_fill("#ffffff"),
        corner_radius: 0.0,
    });

    // Title
    if let Some(ref title) = def.title {
        prims.push(DrawPrimitive::Text {
            x: def.width / 2.0,
            y: MARGIN / 2.0 + 8.0,
            text: title.clone(),
            font_size: 16.0,
            font_family: "sans-serif".to_string(),
            color: "#1f2937".to_string(),
            anchor: TextAnchor::Middle,
        });
    }

    prims
}

/// Find the maximum value across all series, returning at least 1.0 to avoid division by zero.
fn max_value(def: &ChartDefinition) -> f64 {
    def.series
        .iter()
        .flat_map(|s| s.values.iter().copied())
        .fold(f64::NEG_INFINITY, f64::max)
        .max(1.0)
}

/// Render x-axis category labels below the chart area.
fn x_axis_labels(
    def: &ChartDefinition,
    left: f64,
    chart_width: f64,
    bottom: f64,
) -> Vec<DrawPrimitive> {
    let mut prims = Vec::new();
    let n = def.categories.len();
    if n == 0 {
        return prims;
    }

    let step = chart_width / n as f64;
    for (i, cat) in def.categories.iter().enumerate() {
        prims.push(DrawPrimitive::Text {
            x: left + step * i as f64 + step / 2.0,
            y: bottom + 16.0,
            text: cat.clone(),
            font_size: 11.0,
            font_family: "sans-serif".to_string(),
            color: "#6b7280".to_string(),
            anchor: TextAnchor::Middle,
        });
    }

    prims
}

/// Draw x and y axis lines.
fn axis_lines(left: f64, top: f64, right: f64, bottom: f64) -> Vec<DrawPrimitive> {
    let axis_style = ShapeStyle::new().with_stroke("#d1d5db", 1.0);
    vec![
        // Y axis
        DrawPrimitive::Line {
            x1: left,
            y1: top,
            x2: left,
            y2: bottom,
            style: axis_style.clone(),
        },
        // X axis
        DrawPrimitive::Line {
            x1: left,
            y1: bottom,
            x2: right,
            y2: bottom,
            style: axis_style,
        },
    ]
}

/// Generate a vertical bar chart.
fn bar_chart(def: &ChartDefinition) -> Vec<DrawPrimitive> {
    let mut prims = chart_background_and_title(def);
    let (left, top, right, bottom) = chart_area(def);
    let chart_width = right - left;
    let chart_height = bottom - top;

    prims.extend(axis_lines(left, top, right, bottom));

    let max_val = max_value(def);
    let n_categories = def.categories.len().max(1);
    let n_series = def.series.len().max(1);
    let group_width = chart_width / n_categories as f64;
    let bar_width = (group_width * 0.8) / n_series as f64;
    let group_padding = group_width * 0.1;

    for (si, series) in def.series.iter().enumerate() {
        for (ci, &val) in series.values.iter().enumerate() {
            if ci >= n_categories {
                break;
            }
            let bar_height = (val / max_val) * chart_height;
            let bar_x = left + group_width * ci as f64 + group_padding + bar_width * si as f64;
            let bar_y = bottom - bar_height;

            prims.push(DrawPrimitive::Rect {
                x: bar_x,
                y: bar_y,
                width: bar_width,
                height: bar_height,
                style: ShapeStyle::new().with_fill(&series.color),
                corner_radius: 2.0,
            });
        }
    }

    prims.extend(x_axis_labels(def, left, chart_width, bottom));
    prims
}

/// Generate a line chart with connected data points.
fn line_chart(def: &ChartDefinition) -> Vec<DrawPrimitive> {
    let mut prims = chart_background_and_title(def);
    let (left, top, right, bottom) = chart_area(def);
    let chart_width = right - left;
    let chart_height = bottom - top;

    prims.extend(axis_lines(left, top, right, bottom));

    let max_val = max_value(def);
    let n_points = def.series.iter().map(|s| s.values.len()).max().unwrap_or(0);
    if n_points == 0 {
        return prims;
    }

    let step_x = if n_points > 1 {
        chart_width / (n_points - 1) as f64
    } else {
        chart_width
    };

    for series in &def.series {
        // Build polyline path
        let mut path_d = String::new();
        for (i, &val) in series.values.iter().enumerate() {
            let px = left + step_x * i as f64;
            let py = bottom - (val / max_val) * chart_height;
            if i == 0 {
                path_d.push_str(&format!("M {px},{py}"));
            } else {
                path_d.push_str(&format!(" L {px},{py}"));
            }
        }

        // Line path
        prims.push(DrawPrimitive::Path {
            d: path_d,
            style: ShapeStyle {
                fill: None,
                stroke: Some(series.color.clone()),
                stroke_width: 2.0,
                opacity: 1.0,
                stroke_dasharray: None,
            },
        });

        // Data point dots
        for (i, &val) in series.values.iter().enumerate() {
            let px = left + step_x * i as f64;
            let py = bottom - (val / max_val) * chart_height;
            prims.push(DrawPrimitive::Ellipse {
                cx: px,
                cy: py,
                rx: 3.0,
                ry: 3.0,
                style: ShapeStyle::new().with_fill(&series.color),
            });
        }
    }

    prims.extend(x_axis_labels(def, left, chart_width, bottom));
    prims
}

/// Generate a pie chart with arc segments.
fn pie_chart(def: &ChartDefinition) -> Vec<DrawPrimitive> {
    let mut prims = chart_background_and_title(def);
    let (left, top, right, bottom) = chart_area(def);

    let cx = (left + right) / 2.0;
    let cy = (top + bottom) / 2.0;
    let radius = ((right - left).min(bottom - top)) / 2.0 * 0.9;

    build_pie_segments(&mut prims, def, cx, cy, radius, 0.0);
    prims
}

/// Generate a donut chart (pie with inner cutout).
fn donut_chart(def: &ChartDefinition) -> Vec<DrawPrimitive> {
    let mut prims = chart_background_and_title(def);
    let (left, top, right, bottom) = chart_area(def);

    let cx = (left + right) / 2.0;
    let cy = (top + bottom) / 2.0;
    let radius = ((right - left).min(bottom - top)) / 2.0 * 0.9;
    let inner_radius = radius * 0.55;

    build_pie_segments(&mut prims, def, cx, cy, radius, inner_radius);

    // Inner circle (white) to create the donut hole
    prims.push(DrawPrimitive::Ellipse {
        cx,
        cy,
        rx: inner_radius,
        ry: inner_radius,
        style: ShapeStyle::new().with_fill("#ffffff"),
    });

    prims
}

/// Build pie/donut arc segments from the first values of each series.
fn build_pie_segments(
    prims: &mut Vec<DrawPrimitive>,
    def: &ChartDefinition,
    cx: f64,
    cy: f64,
    radius: f64,
    _inner_radius: f64,
) {
    // Collect values: one per series (first value) or one per category from first series
    let values: Vec<(f64, &str)> = if def.series.len() > 1 {
        // Multiple series: use first value of each series
        def.series
            .iter()
            .map(|s| (*s.values.first().unwrap_or(&0.0), s.color.as_str()))
            .collect()
    } else if let Some(series) = def.series.first() {
        // Single series: use all values with same color variants
        series
            .values
            .iter()
            .enumerate()
            .map(|(i, &v)| (v, color_for_index(i)))
            .collect()
    } else {
        return;
    };

    let total: f64 = values.iter().map(|(v, _)| v).sum();
    if total <= 0.0 {
        return;
    }

    let mut start_angle: f64 = -std::f64::consts::FRAC_PI_2; // Start at top (12 o'clock)

    for (i, (val, color)) in values.iter().enumerate() {
        let sweep = (val / total) * std::f64::consts::TAU;
        let end_angle = start_angle + sweep;

        // SVG arc path for the segment
        let x1 = cx + radius * start_angle.cos();
        let y1 = cy + radius * start_angle.sin();
        let x2 = cx + radius * end_angle.cos();
        let y2 = cy + radius * end_angle.sin();
        let large_arc = if sweep > std::f64::consts::PI { 1 } else { 0 };

        let d = format!("M {cx},{cy} L {x1},{y1} A {radius},{radius} 0 {large_arc},1 {x2},{y2} Z");

        prims.push(DrawPrimitive::Path {
            d,
            style: ShapeStyle::new()
                .with_fill(color)
                .with_stroke("#ffffff", 1.0),
        });

        // Label at midpoint of arc
        let mid_angle = start_angle + sweep / 2.0;
        let label_r = radius * 0.65;
        let label_x = cx + label_r * mid_angle.cos();
        let label_y = cy + label_r * mid_angle.sin();

        let label_text = if i < def.categories.len() {
            def.categories[i].clone()
        } else {
            format!("{:.0}", val)
        };

        prims.push(DrawPrimitive::Text {
            x: label_x,
            y: label_y,
            text: label_text,
            font_size: 10.0,
            font_family: "sans-serif".to_string(),
            color: "#ffffff".to_string(),
            anchor: TextAnchor::Middle,
        });

        start_angle = end_angle;
    }
}

/// Generate a scatter plot.
fn scatter_chart(def: &ChartDefinition) -> Vec<DrawPrimitive> {
    let mut prims = chart_background_and_title(def);
    let (left, top, right, bottom) = chart_area(def);
    let chart_width = right - left;
    let chart_height = bottom - top;

    prims.extend(axis_lines(left, top, right, bottom));

    let max_val = max_value(def);
    let n_points = def.series.iter().map(|s| s.values.len()).max().unwrap_or(0);
    if n_points == 0 {
        return prims;
    }

    let step_x = if n_points > 1 {
        chart_width / (n_points - 1) as f64
    } else {
        chart_width / 2.0
    };

    for series in &def.series {
        for (i, &val) in series.values.iter().enumerate() {
            let px = if n_points > 1 {
                left + step_x * i as f64
            } else {
                left + chart_width / 2.0
            };
            let py = bottom - (val / max_val) * chart_height;

            prims.push(DrawPrimitive::Ellipse {
                cx: px,
                cy: py,
                rx: 4.0,
                ry: 4.0,
                style: ShapeStyle::new().with_fill(&series.color),
            });
        }
    }

    prims.extend(x_axis_labels(def, left, chart_width, bottom));
    prims
}

/// Generate an area chart (line with filled region below).
fn area_chart(def: &ChartDefinition) -> Vec<DrawPrimitive> {
    let mut prims = chart_background_and_title(def);
    let (left, top, right, bottom) = chart_area(def);
    let chart_width = right - left;
    let chart_height = bottom - top;

    prims.extend(axis_lines(left, top, right, bottom));

    let max_val = max_value(def);
    let n_points = def.series.iter().map(|s| s.values.len()).max().unwrap_or(0);
    if n_points == 0 {
        return prims;
    }

    let step_x = if n_points > 1 {
        chart_width / (n_points - 1) as f64
    } else {
        chart_width
    };

    for series in &def.series {
        // Build filled area path: line across top, then back along bottom
        let mut area_d = String::new();
        let mut line_d = String::new();

        for (i, &val) in series.values.iter().enumerate() {
            let px = left + step_x * i as f64;
            let py = bottom - (val / max_val) * chart_height;
            if i == 0 {
                area_d.push_str(&format!("M {px},{py}"));
                line_d.push_str(&format!("M {px},{py}"));
            } else {
                area_d.push_str(&format!(" L {px},{py}"));
                line_d.push_str(&format!(" L {px},{py}"));
            }
        }

        // Close the area path by going to bottom-right, bottom-left
        if let Some(&last_val) = series.values.last() {
            let last_x = left + step_x * (series.values.len() - 1) as f64;
            let _ = last_val; // used for the last point above
            area_d.push_str(&format!(" L {last_x},{bottom} L {left},{bottom} Z"));
        }

        // Filled area (semi-transparent)
        prims.push(DrawPrimitive::Path {
            d: area_d,
            style: ShapeStyle {
                fill: Some(series.color.clone()),
                stroke: None,
                stroke_width: 0.0,
                opacity: 0.3,
                stroke_dasharray: None,
            },
        });

        // Line on top
        prims.push(DrawPrimitive::Path {
            d: line_d,
            style: ShapeStyle {
                fill: None,
                stroke: Some(series.color.clone()),
                stroke_width: 2.0,
                opacity: 1.0,
                stroke_dasharray: None,
            },
        });
    }

    prims.extend(x_axis_labels(def, left, chart_width, bottom));
    prims
}

/// Palette of colors for pie/donut segments when using a single series.
const PALETTE: &[&str] = &[
    "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
    "#f97316", "#6366f1",
];

/// Get a color from the palette by index, cycling if needed.
fn color_for_index(i: usize) -> &'static str {
    PALETTE[i % PALETTE.len()]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_bar_def() -> ChartDefinition {
        ChartDefinition {
            chart_type: ChartType::Bar,
            title: Some("Sales by Quarter".to_string()),
            categories: vec!["Q1".into(), "Q2".into(), "Q3".into(), "Q4".into()],
            series: vec![DataSeries {
                label: "Revenue".into(),
                values: vec![100.0, 150.0, 120.0, 180.0],
                color: "#3b82f6".into(),
            }],
            width: 400.0,
            height: 300.0,
        }
    }

    fn sample_multi_series_def(chart_type: ChartType) -> ChartDefinition {
        ChartDefinition {
            chart_type,
            title: Some("Comparison".to_string()),
            categories: vec!["A".into(), "B".into(), "C".into()],
            series: vec![
                DataSeries {
                    label: "Series 1".into(),
                    values: vec![10.0, 20.0, 30.0],
                    color: "#3b82f6".into(),
                },
                DataSeries {
                    label: "Series 2".into(),
                    values: vec![15.0, 25.0, 20.0],
                    color: "#ef4444".into(),
                },
            ],
            width: 400.0,
            height: 300.0,
        }
    }

    #[test]
    fn bar_chart_produces_primitives() {
        let prims = chart_to_primitives(&sample_bar_def());
        assert!(!prims.is_empty());
        // Should have background + title + axes + bars + labels
        assert!(prims.len() >= 6);
    }

    #[test]
    fn bar_chart_multi_series() {
        let prims = chart_to_primitives(&sample_multi_series_def(ChartType::Bar));
        assert!(!prims.is_empty());
    }

    #[test]
    fn line_chart_produces_primitives() {
        let mut def = sample_bar_def();
        def.chart_type = ChartType::Line;
        let prims = chart_to_primitives(&def);
        assert!(!prims.is_empty());
        // Should have path (polyline) + dots
        let has_path = prims
            .iter()
            .any(|p| matches!(p, DrawPrimitive::Path { .. }));
        let has_dots = prims
            .iter()
            .any(|p| matches!(p, DrawPrimitive::Ellipse { .. }));
        assert!(has_path, "line chart should have a path");
        assert!(has_dots, "line chart should have dots");
    }

    #[test]
    fn pie_chart_produces_primitives() {
        let def = ChartDefinition {
            chart_type: ChartType::Pie,
            title: Some("Market Share".to_string()),
            categories: vec!["A".into(), "B".into(), "C".into()],
            series: vec![DataSeries {
                label: "Share".into(),
                values: vec![40.0, 35.0, 25.0],
                color: "#3b82f6".into(),
            }],
            width: 300.0,
            height: 300.0,
        };
        let prims = chart_to_primitives(&def);
        assert!(!prims.is_empty());
        // Should have arc paths
        let path_count = prims
            .iter()
            .filter(|p| matches!(p, DrawPrimitive::Path { .. }))
            .count();
        assert!(path_count >= 3, "pie chart should have at least 3 segments");
    }

    #[test]
    fn donut_chart_produces_primitives() {
        let def = ChartDefinition {
            chart_type: ChartType::Donut,
            title: None,
            categories: vec!["X".into(), "Y".into()],
            series: vec![DataSeries {
                label: "Data".into(),
                values: vec![60.0, 40.0],
                color: "#10b981".into(),
            }],
            width: 300.0,
            height: 300.0,
        };
        let prims = chart_to_primitives(&def);
        assert!(!prims.is_empty());
        // Donut should have an inner white ellipse
        let has_white_ellipse = prims.iter().any(|p| {
            matches!(p, DrawPrimitive::Ellipse { style, .. }
                if style.fill.as_deref() == Some("#ffffff"))
        });
        assert!(has_white_ellipse, "donut should have inner white circle");
    }

    #[test]
    fn scatter_chart_produces_primitives() {
        let def = ChartDefinition {
            chart_type: ChartType::Scatter,
            title: Some("Distribution".to_string()),
            categories: vec![],
            series: vec![DataSeries {
                label: "Points".into(),
                values: vec![10.0, 30.0, 20.0, 50.0, 40.0],
                color: "#ef4444".into(),
            }],
            width: 400.0,
            height: 300.0,
        };
        let prims = chart_to_primitives(&def);
        assert!(!prims.is_empty());
        let dot_count = prims
            .iter()
            .filter(|p| matches!(p, DrawPrimitive::Ellipse { .. }))
            .count();
        assert_eq!(dot_count, 5, "scatter should have 5 dots");
    }

    #[test]
    fn area_chart_produces_primitives() {
        let mut def = sample_bar_def();
        def.chart_type = ChartType::Area;
        let prims = chart_to_primitives(&def);
        assert!(!prims.is_empty());
        // Should have filled area path + line path
        let path_count = prims
            .iter()
            .filter(|p| matches!(p, DrawPrimitive::Path { .. }))
            .count();
        assert!(
            path_count >= 2,
            "area chart should have filled area + line path"
        );
    }

    #[test]
    fn chart_with_no_data() {
        let def = ChartDefinition {
            chart_type: ChartType::Bar,
            title: None,
            categories: vec![],
            series: vec![],
            width: 200.0,
            height: 200.0,
        };
        let prims = chart_to_primitives(&def);
        // Should still produce at least background + axes
        assert!(!prims.is_empty());
    }

    #[test]
    fn chart_with_title() {
        let def = sample_bar_def();
        let prims = chart_to_primitives(&def);
        let has_title = prims
            .iter()
            .any(|p| matches!(p, DrawPrimitive::Text { text, .. } if text == "Sales by Quarter"));
        assert!(has_title, "chart should include title text");
    }

    #[test]
    fn chart_without_title() {
        let mut def = sample_bar_def();
        def.title = None;
        let prims = chart_to_primitives(&def);
        let has_title = prims
            .iter()
            .any(|p| matches!(p, DrawPrimitive::Text { text, .. } if text == "Sales by Quarter"));
        assert!(!has_title, "chart without title should not have title text");
    }

    #[test]
    fn chart_serialization_roundtrip() {
        let def = sample_bar_def();
        let json = serde_json::to_string(&def).expect("serialize");
        let deserialized: ChartDefinition = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(deserialized.categories.len(), 4);
        assert_eq!(deserialized.series.len(), 1);
    }

    #[test]
    fn all_chart_types_produce_nonempty() {
        let types = [
            ChartType::Bar,
            ChartType::Line,
            ChartType::Pie,
            ChartType::Donut,
            ChartType::Scatter,
            ChartType::Area,
        ];
        for ct in types {
            let def = ChartDefinition {
                chart_type: ct,
                title: Some("Test".to_string()),
                categories: vec!["A".into(), "B".into()],
                series: vec![DataSeries {
                    label: "S".into(),
                    values: vec![10.0, 20.0],
                    color: "#3b82f6".into(),
                }],
                width: 300.0,
                height: 200.0,
            };
            let prims = chart_to_primitives(&def);
            assert!(
                !prims.is_empty(),
                "chart type {:?} should produce non-empty primitives",
                ct
            );
        }
    }
}
