use axum::{extract::{State, Path}, http::StatusCode, Json};
use serde_json::json;
use uuid::Uuid;
use tracing::info;

use crate::AppState;

#[derive(serde::Serialize, serde::Deserialize)]
pub struct CreateSheetRequest {
    pub name: String,
    #[serde(default)]
    pub rows: u32,
    #[serde(default)]
    pub cols: u32,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct SheetResponse {
    pub id: String,
    pub name: String,
    pub doc_type: String,
    pub rows: u32,
    pub cols: u32,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct RowsResponse {
    pub rows: Vec<Vec<String>>,
}

/// Create a new spreadsheet
pub async fn create_sheet(
    State(_state): State<AppState>,
    Json(payload): Json<CreateSheetRequest>,
) -> Result<(StatusCode, Json<SheetResponse>), (StatusCode, String)> {
    let doc_id = Uuid::new_v4().to_string();
    let rows = if payload.rows == 0 { 100 } else { payload.rows };
    let cols = if payload.cols == 0 { 26 } else { payload.cols };

    info!(
        doc_id = %doc_id,
        doc_type = "sheet",
        name = %payload.name,
        rows = rows,
        cols = cols,
        "Created spreadsheet"
    );

    Ok((
        StatusCode::CREATED,
        Json(SheetResponse {
            id: doc_id,
            name: payload.name,
            doc_type: "sheet".to_string(),
            rows,
            cols,
            created_at: chrono::Utc::now().to_rfc3339(),
        }),
    ))
}

/// Get rows from spreadsheet
pub async fn get_rows(
    State(_state): State<AppState>,
    Path(_doc_id): Path<String>,
) -> Result<Json<RowsResponse>, (StatusCode, String)> {
    // In production: fetch from Y.doc
    Ok(Json(RowsResponse {
        rows: vec![vec![]; 100],
    }))
}
