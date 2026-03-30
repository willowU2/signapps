use axum::{extract::State, http::StatusCode, Json};
use tracing::info;
use uuid::Uuid;

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

/// Create a new text document and persist its initial CRDT state to the
/// database so the first WebSocket client receives a well-formed structure.
#[tracing::instrument(skip_all)]
pub async fn create_document(
    State(state): State<AppState>,
    Json(payload): Json<CreateTextDocumentRequest>,
) -> Result<(StatusCode, Json<DocumentResponse>), (StatusCode, String)> {
    let doc_id = Uuid::new_v4().to_string();
    let doc_type = "text";

    // Build and persist initial CRDT state (content YText, meta YMap, comments YArray)
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
        "Created text document"
    );

    Ok((
        StatusCode::CREATED,
        Json(DocumentResponse {
            id: doc_id,
            name: payload.name,
            doc_type: doc_type.to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
        }),
    ))
}
