use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use tracing::{error, info};
use uuid::Uuid;
use yrs::{ReadTxn, Transact};

use crate::AppState;

#[derive(Serialize, Deserialize)]
pub struct CreateChannelRequest {
    pub name: String,
    #[serde(default)]
    pub topic: Option<String>,
    #[serde(default)]
    pub is_private: bool,
}

#[derive(Serialize, Deserialize)]
pub struct ChannelResponse {
    pub id: String,
    pub name: String,
    pub topic: Option<String>,
    pub is_private: bool,
    pub created_at: String,
    pub created_by: String, // uuid
}

/// Create a new chat channel
pub async fn create_channel(
    State(state): State<AppState>,
    Json(payload): Json<CreateChannelRequest>,
) -> Result<(StatusCode, Json<ChannelResponse>), (StatusCode, String)> {
    let doc_id = Uuid::new_v4();
    let user_id: Option<Uuid> = None; // TODO: Get from auth middleware when available

    // Initialize empty Yjs document state
    let doc = yrs::Doc::new();
    let doc_binary = doc
        .transact()
        .encode_state_as_update_v1(&yrs::StateVector::default());

    // 1. Insert into documents table
    sqlx::query(
        "INSERT INTO documents (id, name, doc_type, doc_binary, created_by) VALUES ($1, $2, 'chat', $3, $4)",
    )
    .bind(doc_id)
    .bind(&payload.name)
    .bind(doc_binary)
    .bind(user_id)
    .execute(state.pool.inner())
    .await
    .map_err(|e| {
        error!("Failed to create channel document: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to create channel: {}", e),
        )
    })?;

    // 2. Insert metadata (topic, is_private) into document_metadata
    let metadata = serde_json::json!({
        "topic": payload.topic,
        "is_private": payload.is_private
    });

    sqlx::query("INSERT INTO document_metadata (doc_id, metadata) VALUES ($1, $2)")
        .bind(doc_id)
        .bind(metadata)
        .execute(state.pool.inner())
        .await
        .map_err(|e| {
            error!("Failed to create channel metadata: {}", e);
            // Note: we might want to rollback the document creation here in a real transaction,
            // but for now we'll just log and return error.
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to create channel metadata".to_string(),
            )
        })?;

    info!(
        doc_id = %doc_id,
        name = %payload.name,
        "Created chat channel"
    );

    Ok((
        StatusCode::CREATED,
        Json(ChannelResponse {
            id: doc_id.to_string(),
            name: payload.name,
            topic: payload.topic,
            is_private: payload.is_private,
            created_at: chrono::Utc::now().to_rfc3339(),
            created_by: user_id.map(|id| id.to_string()).unwrap_or_default(),
        }),
    ))
}

#[derive(sqlx::FromRow, Serialize, Deserialize)]
pub struct ChannelRow {
    pub id: Uuid,
    pub name: String,
    pub topic: Option<String>,
    pub is_private: Option<bool>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub created_by: Option<Uuid>,
}

/// List all chat channels
pub async fn get_channels(
    State(state): State<AppState>,
) -> Result<Json<Vec<ChannelResponse>>, (StatusCode, String)> {
    let channels = sqlx::query_as::<_, ChannelRow>(
        r#"
        SELECT 
            d.id, 
            d.name, 
            (m.metadata->>'topic') as topic,
            COALESCE((m.metadata->>'is_private')::boolean, false) as is_private,
            d.created_at, 
            d.created_by 
        FROM documents d
        LEFT JOIN document_metadata m ON d.id = m.doc_id
        WHERE d.doc_type = 'chat'
        ORDER BY d.created_at DESC
        "#,
    )
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| {
        error!("Failed to fetch channels: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to fetch channels".to_string(),
        )
    })?;

    let response = channels
        .into_iter()
        .map(|row| ChannelResponse {
            id: row.id.to_string(),
            name: row.name,
            topic: row.topic,
            is_private: row.is_private.unwrap_or(false),
            created_at: row.created_at.to_rfc3339(),
            created_by: row.created_by.map(|id| id.to_string()).unwrap_or_default(),
        })
        .collect();

    Ok(Json(response))
}
