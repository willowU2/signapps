use axum::{extract::State, http::StatusCode, Json};
use serde_json::json;
use uuid::Uuid;
use tracing::info;

use crate::AppState;

#[derive(serde::Serialize, serde::Deserialize)]
pub struct CreateTextDocumentRequest {
    pub name: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct DocumentResponse {
    pub id: String,
    pub name: String,
    pub doc_type: String,
    pub created_at: String,
}

/// Create a new text document
pub async fn create_document(
    State(_state): State<AppState>,
    Json(payload): Json<CreateTextDocumentRequest>,
) -> Result<(StatusCode, Json<DocumentResponse>), (StatusCode, String)> {
    let doc_id = Uuid::new_v4().to_string();

    info!(
        doc_id = %doc_id,
        doc_type = "text",
        name = %payload.name,
        "Created text document"
    );

    Ok((
        StatusCode::CREATED,
        Json(DocumentResponse {
            id: doc_id,
            name: payload.name,
            doc_type: "text".to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
        }),
    ))
}
