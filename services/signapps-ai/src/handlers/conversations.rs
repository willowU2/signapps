//! Conversation CRUD handlers.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::Result;
use signapps_db::models::conversation::{Conversation, ConversationMessage};
use uuid::Uuid;

use crate::memory::ConversationMemory;
use crate::AppState;

/// Query parameters for listing conversations.
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct ListParams {
    /// Maximum number of conversations to return (default 50).
    pub limit: Option<i64>,
}

/// Query parameters for fetching messages.
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct MessagesParams {
    /// Maximum number of messages to return (default 100).
    pub limit: Option<i64>,
}

/// Response for listing conversations.
#[derive(Debug, Serialize)]
/// Response for Conversations.
pub struct ConversationsResponse {
    pub conversations: Vec<Conversation>,
    pub count: usize,
}

/// Response for a single conversation with its messages.
#[derive(Debug, Serialize)]
/// ConversationDetail data transfer object.
pub struct ConversationDetail {
    pub conversation: Conversation,
    pub messages: Vec<ConversationMessage>,
}

/// List conversations for the authenticated user.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/conversations",
    responses((status = 200, description = "Success")),
    tag = "Ai"
)]
#[tracing::instrument(skip_all)]
pub async fn list_conversations(
    State(state): State<AppState>,
    Extension(claims): Extension<signapps_common::auth::Claims>,
    Query(params): Query<ListParams>,
) -> Result<Json<ConversationsResponse>> {
    let memory = ConversationMemory::new(state.pool.clone());
    let limit = params.limit.unwrap_or(50);
    let conversations = memory.list_conversations(claims.sub, limit).await?;
    let count = conversations.len();

    Ok(Json(ConversationsResponse {
        conversations,
        count,
    }))
}

/// Get a single conversation with its messages.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/conversations",
    responses((status = 200, description = "Success")),
    tag = "Ai"
)]
#[tracing::instrument(skip_all)]
pub async fn get_conversation(
    State(state): State<AppState>,
    Extension(claims): Extension<signapps_common::auth::Claims>,
    Path(id): Path<Uuid>,
    Query(params): Query<MessagesParams>,
) -> Result<Json<ConversationDetail>> {
    let memory = ConversationMemory::new(state.pool.clone());
    let limit = params.limit.unwrap_or(100);

    // get_or_create with Some(id) fetches and verifies ownership
    let conversation = memory.get_or_create(Some(id), claims.sub).await?;
    let messages = memory.get_context(id, limit as usize).await?;

    Ok(Json(ConversationDetail {
        conversation,
        messages,
    }))
}

/// Delete a conversation and all its messages.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    delete,
    path = "/api/v1/conversations",
    responses((status = 204, description = "Success")),
    tag = "Ai"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_conversation(
    State(state): State<AppState>,
    Extension(claims): Extension<signapps_common::auth::Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let memory = ConversationMemory::new(state.pool.clone());

    // Verify ownership first
    let _conversation = memory.get_or_create(Some(id), claims.sub).await?;
    memory.delete_conversation(id).await?;

    Ok(StatusCode::NO_CONTENT)
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
