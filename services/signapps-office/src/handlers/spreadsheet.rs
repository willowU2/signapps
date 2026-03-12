//! Spreadsheet import/export HTTP handlers.

use axum::{
    extract::Multipart,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};

use crate::spreadsheet::{json_to_xlsx, xlsx_to_json};

/// Export spreadsheet JSON data to XLSX
pub async fn export_xlsx(Json(payload): Json<serde_json::Value>) -> Response {
    match json_to_xlsx(&payload) {
        Ok(data) => {
            let filename = payload
                .get("filename")
                .and_then(|f| f.as_str())
                .unwrap_or("spreadsheet.xlsx");

            (
                StatusCode::OK,
                [
                    (
                        "Content-Type",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
            tracing::error!("XLSX export error: {}", e);
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

/// Import XLSX file to JSON
pub async fn import_xlsx(mut multipart: Multipart) -> Response {
    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();

        if name == "file" {
            let filename = field.file_name().unwrap_or("upload.xlsx").to_string();

            match field.bytes().await {
                Ok(data) => {
                    // Verify it's an XLSX file
                    if !filename.ends_with(".xlsx") && !filename.ends_with(".xls") {
                        return (
                            StatusCode::BAD_REQUEST,
                            Json(serde_json::json!({
                                "error": "Invalid file type",
                                "message": "Only .xlsx and .xls files are supported"
                            })),
                        )
                            .into_response();
                    }

                    match xlsx_to_json(&data) {
                        Ok(json) => {
                            return (
                                StatusCode::OK,
                                Json(serde_json::json!({
                                    "success": true,
                                    "filename": filename,
                                    "spreadsheet": json
                                })),
                            )
                                .into_response();
                        }
                        Err(e) => {
                            tracing::error!("XLSX import error: {}", e);
                            return (
                                StatusCode::BAD_REQUEST,
                                Json(serde_json::json!({
                                    "error": "Import failed",
                                    "message": e.to_string()
                                })),
                            )
                                .into_response();
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to read upload: {}", e);
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(serde_json::json!({
                            "error": "Upload failed",
                            "message": e.to_string()
                        })),
                    )
                        .into_response();
                }
            }
        }
    }

    (
        StatusCode::BAD_REQUEST,
        Json(serde_json::json!({
            "error": "No file provided",
            "message": "Please provide a file with field name 'file'"
        })),
    )
        .into_response()
}

/// Get spreadsheet format information
pub async fn spreadsheet_info() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "service": "SignApps Office - Spreadsheet",
        "version": "1.0.0",
        "supported_formats": {
            "import": ["xlsx", "xls"],
            "export": ["xlsx"]
        },
        "endpoints": {
            "export": "POST /api/v1/spreadsheet/export",
            "import": "POST /api/v1/spreadsheet/import"
        }
    }))
}
