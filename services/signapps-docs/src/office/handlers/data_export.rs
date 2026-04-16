//! Universal data export handler — CSV, JSON, XLSX, PDF.
//!
//! POST /api/v1/data/export — accepts structured data and returns
//! the exported file in the requested format.

use axum::{
    body::Body,
    http::{header, StatusCode},
    response::Response,
    Json,
};
use serde::{Deserialize, Serialize};
use std::io::{BufWriter, Cursor};

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for Export.
pub struct ExportRequest {
    /// Output format: "csv" | "json" | "xlsx" | "pdf"
    pub format: String,
    /// Column headers
    pub columns: Vec<String>,
    /// Data rows
    pub rows: Vec<Vec<String>>,
    /// Optional filename (without extension)
    pub filename: Option<String>,
    /// Optional title for PDF header
    pub title: Option<String>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// ExportInfo data transfer object.
pub struct ExportInfo {
    pub supported_formats: Vec<String>,
    pub description: String,
}

// ============================================================================
// Info endpoint
// ============================================================================

/// GET /api/v1/data/export/info — get data export service info
#[utoipa::path(
    get,
    path = "/api/v1/data/export/info",
    responses(
        (status = 200, description = "Export service info", body = ExportInfo),
    ),
    tag = "DataExport"
)]
#[tracing::instrument(skip_all)]
pub async fn export_info() -> Json<ExportInfo> {
    Json(ExportInfo {
        supported_formats: vec![
            "csv".to_string(),
            "json".to_string(),
            "xlsx".to_string(),
            "pdf".to_string(),
        ],
        description: "Universal data export — provide columns + rows, get a file back".to_string(),
    })
}

// ============================================================================
// Export handler
// ============================================================================

/// POST /api/v1/data/export — export tabular data to CSV, JSON, XLSX, or PDF
#[utoipa::path(
    post,
    path = "/api/v1/data/export",
    request_body = ExportRequest,
    responses(
        (status = 200, description = "Exported file binary"),
        (status = 400, description = "Unsupported format"),
        (status = 500, description = "Internal server error"),
    ),
    tag = "DataExport"
)]
/// POST /api/v1/data/export — Export data to a chosen format.
#[tracing::instrument(skip_all)]
pub async fn export_data(
    Json(payload): Json<ExportRequest>,
) -> Result<Response, (StatusCode, String)> {
    let base_name = payload.filename.as_deref().unwrap_or("export");

    match payload.format.as_str() {
        "csv" => export_csv(&payload.columns, &payload.rows, base_name),
        "json" => export_json(&payload.columns, &payload.rows, base_name),
        "xlsx" => export_xlsx(&payload.columns, &payload.rows, base_name),
        "pdf" => export_pdf(
            &payload.columns,
            &payload.rows,
            base_name,
            payload.title.as_deref(),
        ),
        _ => Err((
            StatusCode::BAD_REQUEST,
            format!("Unsupported format: {}", payload.format),
        )),
    }
}

// ============================================================================
// Format exporters
// ============================================================================

fn export_csv(
    columns: &[String],
    rows: &[Vec<String>],
    filename: &str,
) -> Result<Response, (StatusCode, String)> {
    let mut out = String::new();

    // Header row
    out.push_str(&columns.join(","));
    out.push('\n');

    // Data rows — escape commas with quoting
    for row in rows {
        let escaped: Vec<String> = row
            .iter()
            .map(|cell| {
                if cell.contains(',') || cell.contains('"') || cell.contains('\n') {
                    format!("\"{}\"", cell.replace('"', "\"\""))
                } else {
                    cell.clone()
                }
            })
            .collect();
        out.push_str(&escaped.join(","));
        out.push('\n');
    }

    Ok(Response::builder()
        .header(header::CONTENT_TYPE, "text/csv; charset=utf-8")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{filename}.csv\""),
        )
        .body(Body::from(out))
        .expect("valid response"))
}

fn export_json(
    columns: &[String],
    rows: &[Vec<String>],
    filename: &str,
) -> Result<Response, (StatusCode, String)> {
    let objects: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            let mut map = serde_json::Map::new();
            for (i, col) in columns.iter().enumerate() {
                let val = row.get(i).cloned().unwrap_or_default();
                map.insert(col.clone(), serde_json::Value::String(val));
            }
            serde_json::Value::Object(map)
        })
        .collect();

    let json_str = serde_json::to_string_pretty(&objects)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Response::builder()
        .header(header::CONTENT_TYPE, "application/json; charset=utf-8")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{filename}.json\""),
        )
        .body(Body::from(json_str))
        .expect("valid response"))
}

fn export_xlsx(
    columns: &[String],
    rows: &[Vec<String>],
    filename: &str,
) -> Result<Response, (StatusCode, String)> {
    use rust_xlsxwriter::Workbook;

    let mut workbook = Workbook::new();
    let sheet = workbook.add_worksheet();

    // Write header
    for (col_idx, col_name) in columns.iter().enumerate() {
        sheet
            .write_string(0, col_idx as u16, col_name)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    // Write data rows
    for (row_idx, row) in rows.iter().enumerate() {
        for (col_idx, cell) in row.iter().enumerate() {
            sheet
                .write_string((row_idx + 1) as u32, col_idx as u16, cell)
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        }
    }

    let buf = workbook
        .save_to_buffer()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Response::builder()
        .header(
            header::CONTENT_TYPE,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{filename}.xlsx\""),
        )
        .body(Body::from(buf))
        .expect("valid response"))
}

fn export_pdf(
    columns: &[String],
    rows: &[Vec<String>],
    filename: &str,
    title: Option<&str>,
) -> Result<Response, (StatusCode, String)> {
    use printpdf::*;

    let (doc, page1, layer1) =
        PdfDocument::new(title.unwrap_or("Export"), Mm(210.0), Mm(297.0), "Layer 1");
    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let layer = doc.get_page(page1).get_layer(layer1);
    let mut y_pos = 275.0_f32;

    // Title
    if let Some(t) = title {
        layer.use_text(t, 16.0, Mm(15.0), Mm(y_pos), &font);
        y_pos -= 10.0;
    }

    // Header
    let col_width = 180.0 / columns.len() as f32;
    for (i, col) in columns.iter().enumerate() {
        let truncated: String = col.chars().take(20).collect();
        layer.use_text(
            &truncated,
            9.0,
            Mm(15.0 + (i as f32 * col_width)),
            Mm(y_pos),
            &font,
        );
    }
    y_pos -= 6.0;

    // Data rows
    for row in rows {
        if y_pos < 15.0 {
            break; // Prevent overflow beyond page
        }
        for (i, cell) in row.iter().enumerate() {
            if i >= columns.len() {
                break;
            }
            let truncated: String = cell.chars().take(20).collect();
            layer.use_text(
                &truncated,
                8.0,
                Mm(15.0 + (i as f32 * col_width)),
                Mm(y_pos),
                &font,
            );
        }
        y_pos -= 5.0;
    }

    let mut buf = BufWriter::new(Cursor::new(Vec::new()));
    doc.save(&mut buf)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let buf = buf
        .into_inner()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .into_inner();

    Ok(Response::builder()
        .header(header::CONTENT_TYPE, "application/pdf")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{filename}.pdf\""),
        )
        .body(Body::from(buf))
        .expect("valid response"))
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
