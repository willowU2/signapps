use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use tracing::info;
use uuid::Uuid;

use crate::AppState;

#[derive(serde::Serialize, serde::Deserialize)]
/// Request payload for CreateBoard operation.
pub struct CreateBoardRequest {
    pub name: String,
    #[serde(default)]
    pub board_type: String, // kanban, board, etc.
}

#[derive(serde::Serialize, serde::Deserialize)]
/// Response payload for Board operation.
pub struct BoardResponse {
    pub id: String,
    pub name: String,
    pub doc_type: String,
    pub board_type: String,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
/// Represents a card.
pub struct Card {
    pub id: String,
    pub title: String,
    pub description: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
/// Represents a column.
pub struct Column {
    pub id: String,
    pub title: String,
    pub cards: Vec<Card>,
}

#[derive(serde::Serialize, serde::Deserialize)]
/// Response payload for Columns operation.
pub struct ColumnsResponse {
    pub columns: Vec<Column>,
}

/// Create a new board (Kanban) and persist its initial CRDT state to the
/// database so the first WebSocket client receives a well-formed structure.
#[tracing::instrument(skip_all)]
pub async fn create_board(
    State(state): State<AppState>,
    Json(payload): Json<CreateBoardRequest>,
) -> Result<(StatusCode, Json<BoardResponse>), (StatusCode, String)> {
    let doc_id = Uuid::new_v4().to_string();
    let doc_type = "board";
    let board_type = if payload.board_type.is_empty() {
        "kanban".to_string()
    } else {
        payload.board_type
    };

    // Build and persist initial CRDT state (columns YArray, cards YMap, meta YMap)
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
        board_type = %board_type,
        "Created board"
    );

    Ok((
        StatusCode::CREATED,
        Json(BoardResponse {
            id: doc_id,
            name: payload.name,
            doc_type: doc_type.to_string(),
            board_type,
            created_at: chrono::Utc::now().to_rfc3339(),
        }),
    ))
}

/// Get columns from board
#[tracing::instrument(skip_all)]
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
