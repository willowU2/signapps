//! PDF report generation handler — AQ-RPGEN.
//!
//! POST /api/v1/reports/generate — generates PDF reports for activity,
//! users, and storage from provided structured data.

use axum::{
    body::Body,
    http::{header, StatusCode},
    response::Response,
    Json,
};
use printpdf::*;
use serde::{Deserialize, Serialize};
use std::io::{BufWriter, Cursor};

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct ReportRequest {
    /// Report template: "activity" | "users" | "storage"
    pub template: String,
    /// Report title (defaults to template name)
    pub title: Option<String>,
    /// Sections of the report
    pub sections: Vec<ReportSection>,
    /// Optional filename without extension
    pub filename: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReportSection {
    pub heading: String,
    pub rows: Vec<Vec<String>>,
    pub columns: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct ReportInfo {
    pub supported_templates: Vec<String>,
    pub description: String,
}

// ============================================================================
// Info endpoint
// ============================================================================

pub async fn report_info() -> Json<ReportInfo> {
    Json(ReportInfo {
        supported_templates: vec![
            "activity".to_string(),
            "users".to_string(),
            "storage".to_string(),
            "custom".to_string(),
        ],
        description: "PDF report generation — structured multi-section reports".to_string(),
    })
}

// ============================================================================
// Generate handler
// ============================================================================

pub async fn generate_report(
    Json(payload): Json<ReportRequest>,
) -> Result<Response, (StatusCode, String)> {
    let title = payload
        .title
        .as_deref()
        .unwrap_or(match payload.template.as_str() {
            "activity" => "Rapport d'Activité",
            "users" => "Rapport Utilisateurs",
            "storage" => "Rapport Stockage",
            _ => "Rapport",
        });

    let base_name = payload.filename.as_deref().unwrap_or("report");
    let pdf_bytes =
        build_pdf(title, &payload.sections).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    Ok(Response::builder()
        .header(header::CONTENT_TYPE, "application/pdf")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{base_name}.pdf\""),
        )
        .body(Body::from(pdf_bytes))
        .expect("valid response"))
}

// ============================================================================
// PDF builder
// ============================================================================

fn build_pdf(title: &str, sections: &[ReportSection]) -> Result<Vec<u8>, String> {
    let (doc, page1, layer1) = PdfDocument::new(title, Mm(210.0), Mm(297.0), "Layer 1");
    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| e.to_string())?;
    let font_bold = doc
        .add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| e.to_string())?;

    let layer = doc.get_page(page1).get_layer(layer1);
    let mut y: f32 = 275.0;

    // Report title
    layer.use_text(title, 18.0, Mm(15.0), Mm(y), &font_bold);
    y -= 8.0;

    // Date line
    let date_str = chrono::Utc::now().format("%d/%m/%Y").to_string();
    layer.use_text(
        format!("Généré le {date_str}").as_str(),
        9.0,
        Mm(15.0),
        Mm(y),
        &font,
    );
    y -= 12.0;

    for section in sections {
        if y < 30.0 {
            break; // Avoid going off-page (multi-page not supported here)
        }

        // Section heading
        layer.use_text(&section.heading, 12.0, Mm(15.0), Mm(y), &font_bold);
        y -= 7.0;

        if section.columns.is_empty() {
            continue;
        }

        let col_count = section.columns.len().max(1);
        let col_width = 180.0 / col_count as f32;

        // Column headers
        for (i, col) in section.columns.iter().enumerate() {
            let label: String = col.chars().take(22).collect();
            layer.use_text(
                &label,
                8.0,
                Mm(15.0 + i as f32 * col_width),
                Mm(y),
                &font_bold,
            );
        }
        y -= 5.0;

        // Data rows
        for row in &section.rows {
            if y < 20.0 {
                break;
            }
            for (i, cell) in row.iter().enumerate() {
                if i >= col_count {
                    break;
                }
                let val: String = cell.chars().take(22).collect();
                layer.use_text(&val, 8.0, Mm(15.0 + i as f32 * col_width), Mm(y), &font);
            }
            y -= 5.0;
        }

        y -= 4.0; // Space between sections
    }

    let mut buf = BufWriter::new(Cursor::new(Vec::new()));
    doc.save(&mut buf).map_err(|e| e.to_string())?;
    Ok(buf.into_inner().map_err(|e| e.to_string())?.into_inner())
}
