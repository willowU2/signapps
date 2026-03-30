use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use tracing::info;
use uuid::Uuid;

use crate::AppState;

#[derive(serde::Serialize, serde::Deserialize)]
/// Request payload for CreateSheet operation.
pub struct CreateSheetRequest {
    pub name: String,
    #[serde(default)]
    pub rows: u32,
    #[serde(default)]
    pub cols: u32,
}

#[derive(serde::Serialize, serde::Deserialize)]
/// Response payload for Sheet operation.
pub struct SheetResponse {
    pub id: String,
    pub name: String,
    pub doc_type: String,
    pub rows: u32,
    pub cols: u32,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
/// Response payload for Rows operation.
pub struct RowsResponse {
    pub rows: Vec<Vec<String>>,
}

/// Create a new spreadsheet and persist its initial CRDT state to the
/// database so the first WebSocket client receives a well-formed structure.
#[tracing::instrument(skip_all)]
pub async fn create_sheet(
    State(state): State<AppState>,
    Json(payload): Json<CreateSheetRequest>,
) -> Result<(StatusCode, Json<SheetResponse>), (StatusCode, String)> {
    let doc_id = Uuid::new_v4().to_string();
    let doc_type = "sheet";
    let rows = if payload.rows == 0 { 100 } else { payload.rows };
    let cols = if payload.cols == 0 { 26 } else { payload.cols };

    // Build and persist initial CRDT state (cells YMap, meta YMap, columns YArray)
    let doc_binary = crate::utils::crdt::initial_state_for_type(doc_type);
    let doc_uuid = Uuid::parse_str(&doc_id).expect("newly-generated UUID is always valid");
    sqlx::query(
        r#"INSERT INTO documents (id, doc_type, doc_binary, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (id) DO NOTHING"#,
    )
    .bind(doc_uuid)
    .bind(doc_type)
    .bind(doc_binary)
    .execute(state.pool.inner())
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to persist document: {e}"),
        )
    })?;

    info!(
        doc_id = %doc_id,
        doc_type = %doc_type,
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
            doc_type: doc_type.to_string(),
            rows,
            cols,
            created_at: chrono::Utc::now().to_rfc3339(),
        }),
    ))
}

/// Get rows from spreadsheet
#[tracing::instrument(skip_all)]
pub async fn get_rows(
    State(_state): State<AppState>,
    Path(_doc_id): Path<String>,
) -> Result<Json<RowsResponse>, (StatusCode, String)> {
    // In production: fetch from Y.doc
    Ok(Json(RowsResponse {
        rows: vec![vec![]; 100],
    }))
}
