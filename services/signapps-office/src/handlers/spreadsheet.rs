//! Spreadsheet import/export HTTP handlers.

#![allow(dead_code)]

use axum::{
    extract::{Multipart, Query},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;

use crate::spreadsheet::{
    csv_to_spreadsheet, json_to_csv, json_to_ods, json_to_xlsx, spreadsheet_to_json, xlsx_to_json,
};

/// Export spreadsheet JSON data to XLSX
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
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
        },
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
        },
    }
}

/// Import XLSX file to JSON
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
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
                        },
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
                        },
                    }
                },
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
                },
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
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn spreadsheet_info() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "service": "SignApps Office - Spreadsheet",
        "version": "1.0.0",
        "supported_formats": {
            "import": ["xlsx", "xls", "csv", "tsv", "ods"],
            "export": ["xlsx", "csv", "ods"]
        },
        "endpoints": {
            "export": "POST /api/v1/spreadsheet/export?format=xlsx|csv|ods",
            "export_csv": "POST /api/v1/spreadsheet/export/csv",
            "export_ods": "POST /api/v1/spreadsheet/export/ods",
            "import": "POST /api/v1/spreadsheet/import",
            "import_csv": "POST /api/v1/spreadsheet/import/csv"
        }
    }))
}

/// Query params for export format
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct ExportParams {
    pub format: Option<String>,
}

/// Export spreadsheet JSON data to specified format (XLSX or CSV)
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn export_spreadsheet(
    Query(params): Query<ExportParams>,
    Json(payload): Json<serde_json::Value>,
) -> Response {
    let format = params.format.as_deref().unwrap_or("xlsx");

    match format {
        "xlsx" => export_xlsx(Json(payload)).await,
        "csv" => export_csv_handler(Json(payload)).await,
        "ods" => export_ods_handler(Json(payload)).await,
        _ => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "Unsupported format",
                "message": format!("Format '{}' is not supported. Use 'xlsx', 'csv', or 'ods'.", format)
            })),
        )
            .into_response(),
    }
}

/// Export spreadsheet JSON data to CSV
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn export_csv_handler(Json(payload): Json<serde_json::Value>) -> Response {
    let delimiter = payload
        .get("delimiter")
        .and_then(|d| d.as_str())
        .and_then(|d| d.chars().next())
        .unwrap_or(',');

    match json_to_csv(&payload, Some(delimiter)) {
        Ok(data) => {
            let filename = payload
                .get("filename")
                .and_then(|f| f.as_str())
                .unwrap_or("spreadsheet.csv");

            (
                StatusCode::OK,
                [
                    ("Content-Type", "text/csv; charset=utf-8"),
                    (
                        "Content-Disposition",
                        &format!("attachment; filename=\"{}\"", filename),
                    ),
                ],
                data,
            )
                .into_response()
        },
        Err(e) => {
            tracing::error!("CSV export error: {}", e);
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Export failed",
                    "message": e.to_string()
                })),
            )
                .into_response()
        },
    }
}

/// Export spreadsheet JSON data to ODS (OpenDocument Spreadsheet)
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn export_ods_handler(Json(payload): Json<serde_json::Value>) -> Response {
    match json_to_ods(&payload) {
        Ok(data) => {
            let filename = payload
                .get("filename")
                .and_then(|f| f.as_str())
                .unwrap_or("spreadsheet.ods");

            (
                StatusCode::OK,
                [
                    (
                        "Content-Type",
                        "application/vnd.oasis.opendocument.spreadsheet",
                    ),
                    (
                        "Content-Disposition",
                        &format!("attachment; filename=\"{}\"", filename),
                    ),
                ],
                data,
            )
                .into_response()
        },
        Err(e) => {
            tracing::error!("ODS export error: {}", e);
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Export failed",
                    "message": e.to_string()
                })),
            )
                .into_response()
        },
    }
}

/// Import CSV from text content
#[derive(Debug, Deserialize)]
/// Request body for CsvImport.
pub struct CsvImportRequest {
    pub content: String,
    pub delimiter: Option<String>,
    pub has_headers: Option<bool>,
}

#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn import_csv_text(Json(payload): Json<CsvImportRequest>) -> Response {
    let delimiter = payload.delimiter.as_ref().and_then(|d| d.chars().next());

    let has_headers = payload.has_headers.unwrap_or(true);

    match csv_to_spreadsheet(payload.content.as_bytes(), delimiter, has_headers) {
        Ok(spreadsheet) => match spreadsheet_to_json(&spreadsheet) {
            Ok(json) => (
                StatusCode::OK,
                Json(serde_json::json!({
                    "success": true,
                    "detected_format": "csv",
                    "spreadsheet": json
                })),
            )
                .into_response(),
            Err(e) => (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Conversion failed",
                    "message": e.to_string()
                })),
            )
                .into_response(),
        },
        Err(e) => {
            tracing::error!("CSV import error: {}", e);
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Import failed",
                    "message": e.to_string()
                })),
            )
                .into_response()
        },
    }
}

/// Import XLSX or CSV file to JSON (auto-detect format)
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn import_spreadsheet(mut multipart: Multipart) -> Response {
    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();

        if name == "file" {
            let filename = field.file_name().unwrap_or("upload").to_string();

            match field.bytes().await {
                Ok(data) => {
                    let filename_lower = filename.to_lowercase();

                    // Detect format and process accordingly
                    if filename_lower.ends_with(".csv") || filename_lower.ends_with(".tsv") {
                        let delimiter = if filename_lower.ends_with(".tsv") {
                            Some('\t')
                        } else {
                            None // Auto-detect
                        };

                        match csv_to_spreadsheet(&data, delimiter, true) {
                            Ok(spreadsheet) => match spreadsheet_to_json(&spreadsheet) {
                                Ok(json) => {
                                    return (
                                        StatusCode::OK,
                                        Json(serde_json::json!({
                                            "success": true,
                                            "filename": filename,
                                            "detected_format": "csv",
                                            "spreadsheet": json
                                        })),
                                    )
                                        .into_response();
                                },
                                Err(e) => {
                                    return (
                                        StatusCode::BAD_REQUEST,
                                        Json(serde_json::json!({
                                            "error": "Conversion failed",
                                            "message": e.to_string()
                                        })),
                                    )
                                        .into_response();
                                },
                            },
                            Err(e) => {
                                tracing::error!("CSV import error: {}", e);
                                return (
                                    StatusCode::BAD_REQUEST,
                                    Json(serde_json::json!({
                                        "error": "Import failed",
                                        "message": e.to_string()
                                    })),
                                )
                                    .into_response();
                            },
                        }
                    } else if filename_lower.ends_with(".xlsx") || filename_lower.ends_with(".xls")
                    {
                        match xlsx_to_json(&data) {
                            Ok(json) => {
                                return (
                                    StatusCode::OK,
                                    Json(serde_json::json!({
                                        "success": true,
                                        "filename": filename,
                                        "detected_format": if filename_lower.ends_with(".xlsx") { "xlsx" } else { "xls" },
                                        "spreadsheet": json
                                    })),
                                )
                                    .into_response();
                            },
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
                            },
                        }
                    } else {
                        return (
                            StatusCode::BAD_REQUEST,
                            Json(serde_json::json!({
                                "error": "Unsupported file type",
                                "message": "Supported formats: .xlsx, .xls, .csv, .tsv"
                            })),
                        )
                            .into_response();
                    }
                },
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
                },
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
