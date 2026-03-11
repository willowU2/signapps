use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use tracing::info;
use uuid::Uuid;

use crate::AppState;

#[derive(serde::Serialize, serde::Deserialize)]
pub struct CreateBoardRequest {
    pub name: String,
    #[serde(default)]
    pub board_type: String, // kanban, board, etc.
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct BoardResponse {
    pub id: String,
    pub name: String,
    pub doc_type: String,
    pub board_type: String,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct Card {
    pub id: String,
    pub title: String,
    pub description: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct Column {
    pub id: String,
    pub title: String,
    pub cards: Vec<Card>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ColumnsResponse {
    pub columns: Vec<Column>,
}

/// Create a new board (Kanban)
pub async fn create_board(
    State(_state): State<AppState>,
    Json(payload): Json<CreateBoardRequest>,
) -> Result<(StatusCode, Json<BoardResponse>), (StatusCode, String)> {
    let doc_id = Uuid::new_v4().to_string();
    let board_type = if payload.board_type.is_empty() {
        "kanban".to_string()
    } else {
        payload.board_type
    };

    info!(
        doc_id = %doc_id,
        doc_type = "board",
        name = %payload.name,
        board_type = %board_type,
        "Created board"
    );

    Ok((
        StatusCode::CREATED,
        Json(BoardResponse {
            id: doc_id,
            name: payload.name,
            doc_type: "board".to_string(),
            board_type,
            created_at: chrono::Utc::now().to_rfc3339(),
        }),
    ))
}

/// Get columns from board
pub async fn get_columns(
    State(_state): State<AppState>,
    Path(_doc_id): Path<String>,
) -> Result<Json<ColumnsResponse>, (StatusCode, String)> {
    // In production: fetch from Y.doc
    Ok(Json(ColumnsResponse {
        columns: vec![
            Column {
                id: "col-1".to_string(),
                title: "To Do".to_string(),
                cards: vec![],
            },
            Column {
                id: "col-2".to_string(),
                title: "In Progress".to_string(),
                cards: vec![],
            },
            Column {
                id: "col-3".to_string(),
                title: "Done".to_string(),
                cards: vec![],
            },
        ],
    }))
}
