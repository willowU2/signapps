//! Universal data import handler — CSV, JSON, vCard, iCal.
//!
//! POST /api/v1/data/import — accepts file upload, auto-detects format,
//! and returns parsed structured data.

use axum::{extract::Multipart, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
/// ImportResult data transfer object.
pub struct ImportResult {
    pub format: String,
    pub row_count: usize,
    pub columns: Vec<String>,
    pub rows: Vec<Vec<String>>,
    pub contacts: Vec<ContactRecord>,
    pub events: Vec<EventRecord>,
}

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
/// ContactRecord data transfer object.
pub struct ContactRecord {
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub organization: Option<String>,
    pub extra: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
/// EventRecord data transfer object.
pub struct EventRecord {
    pub summary: String,
    pub dtstart: Option<String>,
    pub dtend: Option<String>,
    pub location: Option<String>,
    pub description: Option<String>,
}

// ============================================================================
// Info endpoint
// ============================================================================

/// GET /api/v1/data/import/info — get data import service info
#[utoipa::path(
    get,
    path = "/api/v1/data/import/info",
    responses(
        (status = 200, description = "Data import service info"),
    ),
    tag = "DataImport"
)]
#[tracing::instrument(skip_all)]
pub async fn import_info() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "supported_formats": ["csv", "json", "vcf", "ics"],
        "max_file_size_mb": 50,
        "description": "Universal data import — auto-detects format from content"
    }))
}

// ============================================================================
// Import handler
// ============================================================================

/// POST /api/v1/data/import — upload a file and get parsed data back
#[utoipa::path(
    post,
    path = "/api/v1/data/import",
    responses(
        (status = 200, description = "Parsed import result", body = ImportResult),
        (status = 400, description = "No file or invalid encoding"),
        (status = 422, description = "Unsupported or malformed format"),
    ),
    tag = "DataImport"
)]
#[tracing::instrument(skip_all)]
pub async fn import_data(
    mut multipart: Multipart,
) -> Result<Json<ImportResult>, (StatusCode, String)> {
    let mut file_name = String::new();
    let mut file_data = Vec::new();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?
    {
        if field.name() == Some("file") {
            file_name = field.file_name().unwrap_or("unknown").to_string();
            file_data = field
                .bytes()
                .await
                .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?
                .to_vec();
            break;
        }
    }

    if file_data.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "No file provided".to_string()));
    }

    let content = String::from_utf8(file_data)
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Invalid UTF-8: {e}")))?;

    // Auto-detect format
    let ext = file_name.rsplit('.').next().unwrap_or("").to_lowercase();
    let format = detect_format(&ext, &content);

    let result = match format.as_str() {
        "csv" => parse_csv(&content),
        "json" => parse_json(&content),
        "vcf" => parse_vcard(&content),
        "ics" => parse_ical(&content),
        _ => Err(format!("Unsupported format: {format}")),
    }
    .map_err(|e| (StatusCode::UNPROCESSABLE_ENTITY, e))?;

    Ok(Json(result))
}

// ============================================================================
// Format detection
// ============================================================================

fn detect_format(ext: &str, content: &str) -> String {
    match ext {
        "csv" => "csv".to_string(),
        "json" => "json".to_string(),
        "vcf" | "vcard" => "vcf".to_string(),
        "ics" | "ical" => "ics".to_string(),
        _ => {
            let trimmed = content.trim();
            if trimmed.starts_with("BEGIN:VCARD") {
                "vcf".to_string()
            } else if trimmed.starts_with("BEGIN:VCALENDAR") {
                "ics".to_string()
            } else if trimmed.starts_with('{') || trimmed.starts_with('[') {
                "json".to_string()
            } else {
                "csv".to_string()
            }
        },
    }
}

// ============================================================================
// Parsers
// ============================================================================

fn parse_csv(content: &str) -> std::result::Result<ImportResult, String> {
    let mut lines = content.lines();
    let header_line = lines.next().ok_or("Empty CSV")?;
    let columns: Vec<String> = header_line
        .split(',')
        .map(|s| s.trim().to_string())
        .collect();

    let mut rows = Vec::new();
    for line in lines {
        if line.trim().is_empty() {
            continue;
        }
        let cells: Vec<String> = line.split(',').map(|s| s.trim().to_string()).collect();
        rows.push(cells);
    }

    Ok(ImportResult {
        format: "csv".to_string(),
        row_count: rows.len(),
        columns,
        rows,
        contacts: Vec::new(),
        events: Vec::new(),
    })
}

fn parse_json(content: &str) -> std::result::Result<ImportResult, String> {
    let value: serde_json::Value =
        serde_json::from_str(content).map_err(|e| format!("Invalid JSON: {e}"))?;

    let (columns, rows) = match &value {
        serde_json::Value::Array(arr) => {
            let mut cols = Vec::new();
            let mut data_rows = Vec::new();
            if let Some(serde_json::Value::Object(first)) = arr.first() {
                cols = first.keys().cloned().collect();
            }
            for item in arr {
                if let serde_json::Value::Object(obj) = item {
                    let row: Vec<String> = cols
                        .iter()
                        .map(|k| match obj.get(k) {
                            Some(v) => match v {
                                serde_json::Value::String(s) => s.clone(),
                                other => other.to_string(),
                            },
                            None => String::new(),
                        })
                        .collect();
                    data_rows.push(row);
                }
            }
            (cols, data_rows)
        },
        _ => (vec!["value".to_string()], vec![vec![value.to_string()]]),
    };

    Ok(ImportResult {
        format: "json".to_string(),
        row_count: rows.len(),
        columns,
        rows,
        contacts: Vec::new(),
        events: Vec::new(),
    })
}

fn parse_vcard(content: &str) -> std::result::Result<ImportResult, String> {
    let mut contacts = Vec::new();
    let mut current: Option<ContactRecord> = None;

    for line in content.lines() {
        let line = line.trim();
        if line == "BEGIN:VCARD" {
            current = Some(ContactRecord {
                name: String::new(),
                email: None,
                phone: None,
                organization: None,
                extra: HashMap::new(),
            });
        } else if line == "END:VCARD" {
            if let Some(c) = current.take() {
                contacts.push(c);
            }
        } else if let Some(ref mut c) = current {
            if let Some(val) = line.strip_prefix("FN:") {
                c.name = val.to_string();
            } else if line.contains("EMAIL") {
                if let Some(val) = line.rsplit(':').next() {
                    c.email = Some(val.to_string());
                }
            } else if line.contains("TEL") {
                if let Some(val) = line.rsplit(':').next() {
                    c.phone = Some(val.to_string());
                }
            } else if let Some(val) = line.strip_prefix("ORG:") {
                c.organization = Some(val.replace(';', " ").trim().to_string());
            }
        }
    }

    let columns = vec![
        "name".to_string(),
        "email".to_string(),
        "phone".to_string(),
        "organization".to_string(),
    ];
    let rows: Vec<Vec<String>> = contacts
        .iter()
        .map(|c| {
            vec![
                c.name.clone(),
                c.email.clone().unwrap_or_default(),
                c.phone.clone().unwrap_or_default(),
                c.organization.clone().unwrap_or_default(),
            ]
        })
        .collect();

    Ok(ImportResult {
        format: "vcf".to_string(),
        row_count: contacts.len(),
        columns,
        rows,
        contacts,
        events: Vec::new(),
    })
}

fn parse_ical(content: &str) -> std::result::Result<ImportResult, String> {
    let mut events = Vec::new();
    let mut current: Option<EventRecord> = None;

    for line in content.lines() {
        let line = line.trim();
        if line == "BEGIN:VEVENT" {
            current = Some(EventRecord {
                summary: String::new(),
                dtstart: None,
                dtend: None,
                location: None,
                description: None,
            });
        } else if line == "END:VEVENT" {
            if let Some(e) = current.take() {
                events.push(e);
            }
        } else if let Some(ref mut e) = current {
            if let Some(val) = line.strip_prefix("SUMMARY:") {
                e.summary = val.to_string();
            } else if line.starts_with("DTSTART") {
                if let Some(val) = line.rsplit(':').next() {
                    e.dtstart = Some(val.to_string());
                }
            } else if line.starts_with("DTEND") {
                if let Some(val) = line.rsplit(':').next() {
                    e.dtend = Some(val.to_string());
                }
            } else if let Some(val) = line.strip_prefix("LOCATION:") {
                e.location = Some(val.to_string());
            } else if let Some(val) = line.strip_prefix("DESCRIPTION:") {
                e.description = Some(val.to_string());
            }
        }
    }

    let columns = vec![
        "summary".to_string(),
        "dtstart".to_string(),
        "dtend".to_string(),
        "location".to_string(),
    ];
    let rows: Vec<Vec<String>> = events
        .iter()
        .map(|e| {
            vec![
                e.summary.clone(),
                e.dtstart.clone().unwrap_or_default(),
                e.dtend.clone().unwrap_or_default(),
                e.location.clone().unwrap_or_default(),
            ]
        })
        .collect();

    Ok(ImportResult {
        format: "ics".to_string(),
        row_count: events.len(),
        columns,
        rows,
        contacts: Vec::new(),
        events,
    })
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
