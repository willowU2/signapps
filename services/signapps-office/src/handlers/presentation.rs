//! Presentation (PPTX) export HTTP handlers.

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};

use crate::presentation::json_to_pptx;

/// Export presentation JSON data to PPTX
pub async fn export_pptx(Json(payload): Json<serde_json::Value>) -> Response {
    match json_to_pptx(&payload) {
        Ok(data) => {
            let filename = payload
                .get("filename")
                .and_then(|f| f.as_str())
                .unwrap_or("presentation.pptx");

            (
                StatusCode::OK,
                [
                    (
                        "Content-Type",
                        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                    ),
                    (
                        "Content-Disposition",
                        &format!("attachment; filename=\"{}\"", filename),
                    ),
                ],
                data,
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("PPTX export error: {}", e);
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Export failed",
                    "message": e.to_string()
                })),
            )
                .into_response()
        }
    }
}

/// Get presentation format information
pub async fn presentation_info() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "service": "SignApps Office - Presentations",
        "version": "1.0.0",
        "supported_formats": {
            "export": ["pptx"]
        },
        "input_format": "Fabric.js JSON",
        "endpoints": {
            "export": "POST /api/v1/presentation/export",
            "info": "GET /api/v1/presentation/info"
        }
    }))
}
