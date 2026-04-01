//! SignApps Chat Service
//! Real-time messaging with channels, messages, reactions, threads, pins,
//! DMs, presence, search, file attachments and export.
//! Channels and messages are persisted in PostgreSQL (chat schema).
//! DMs, presence, and read-status remain in-memory (no user-facing persistence yet).

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Extension, Multipart, Path, Query, State,
    },
    http::StatusCode,
    middleware,
    response::IntoResponse,
    routing::{delete, get, patch, post},
    Json, Router,
};
use chrono::Utc;
use dashmap::DashMap;
use futures_util::{stream::StreamExt, SinkExt};
use serde::{Deserialize, Serialize};
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::auth_middleware;
use signapps_common::pg_events::{NewEvent, PgEventBus};
use signapps_common::{AuthState, Claims, JwtConfig};
use sqlx::{Pool, Postgres};
use std::sync::Arc;
use tokio::sync::broadcast;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
/// Represents a channel.
pub struct Channel {
    pub id: Uuid,
    pub name: String,
    pub topic: Option<String>,
    pub is_private: bool,
    pub created_by: Uuid,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: chrono::DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// Represents a chat message.
pub struct ChatMessage {
    pub id: Uuid,
    pub channel_id: Uuid,
    pub user_id: Uuid,
    pub username: String,
    pub content: String,
    pub parent_id: Option<Uuid>,
    pub reactions: serde_json::Value,
    pub attachment: Option<Attachment>,
    pub is_pinned: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// sqlx row shape for chat.messages (attachment stored as JSONB)
#[derive(Debug, Clone, sqlx::FromRow)]
struct MessageRow {
    pub id: Uuid,
    pub channel_id: Uuid,
    pub user_id: Uuid,
    pub username: String,
    pub content: String,
    pub parent_id: Option<Uuid>,
    pub reactions: serde_json::Value,
    pub attachment: Option<serde_json::Value>,
    pub is_pinned: bool,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: chrono::DateTime<Utc>,
}

impl From<MessageRow> for ChatMessage {
    fn from(r: MessageRow) -> Self {
        let attachment = r
            .attachment
            .and_then(|v| serde_json::from_value::<Attachment>(v).ok());
        Self {
            id: r.id,
            channel_id: r.channel_id,
            user_id: r.user_id,
            username: r.username,
            content: r.content,
            parent_id: r.parent_id,
            reactions: r.reactions,
            attachment,
            is_pinned: r.is_pinned,
            created_at: r.created_at.to_rfc3339(),
            updated_at: r.updated_at.to_rfc3339(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// Represents a attachment.
pub struct Attachment {
    pub url: String,
    pub filename: String,
    pub content_type: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// Represents a direct message room.
pub struct DirectMessageRoom {
    pub id: Uuid,
    pub participants: Vec<DmParticipant>,
    pub created_at: String,
    pub last_message_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// Represents a dm participant.
pub struct DmParticipant {
    pub user_id: Uuid,
    pub username: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// Represents a presence entry.
pub struct PresenceEntry {
    pub user_id: Uuid,
    pub status: String, // "online" | "away" | "busy" | "offline"
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// Represents a read status.
pub struct ReadStatus {
    pub channel_id: Uuid,
    pub user_id: Uuid,
    pub unread_count: u64,
    pub last_read_at: String,
}

// ---------------------------------------------------------------------------
// Request / Response DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
/// Request payload for CreateChannel operation.
pub struct CreateChannelRequest {
    pub name: String,
    pub topic: Option<String>,
    pub is_private: Option<bool>,
}

#[derive(Debug, Deserialize)]
/// Request payload for SendMessage operation.
pub struct SendMessageRequest {
    pub content: String,
    pub parent_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
/// Request payload for AddReaction operation.
pub struct AddReactionRequest {
    pub emoji: String,
}

#[derive(Debug, Deserialize)]
/// Request payload for EditMessage operation.
pub struct EditMessageRequest {
    pub content: String,
}

#[derive(Debug, Deserialize)]
/// Request payload for CreateDm operation.
pub struct CreateDmRequest {
    pub participant_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
/// Request payload for SetPresence operation.
pub struct SetPresenceRequest {
    pub status: String,
}

#[derive(Debug, Deserialize)]
/// Query parameters for filtering and pagination.
pub struct SearchQuery {
    pub q: String,
}

#[derive(Debug, Deserialize)]
/// Query parameters for filtering and pagination.
pub struct ExportQuery {
    pub format: Option<String>, // "json" or "csv"
}

/// Envelope broadcast over WebSocket and the broadcast channel.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub payload: serde_json::Value,
}

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------

#[derive(Clone)]
/// Application state for  service.
pub struct AppState {
    /// PostgreSQL pool — used for channels and messages persistence.
    pub pool: Pool<Postgres>,
    // In-memory stores (DMs, presence, read-status not yet persisted)
    pub dm_rooms: Arc<DashMap<Uuid, DirectMessageRoom>>,
    pub dm_messages: Arc<DashMap<Uuid, Vec<ChatMessage>>>,
    pub presence: Arc<DashMap<Uuid, PresenceEntry>>,
    pub read_status: Arc<DashMap<String, ReadStatus>>, // "{channel_id}:{user_id}" -> status
    pub broadcast_tx: broadcast::Sender<String>,
    pub jwt_config: JwtConfig,
    pub event_bus: PgEventBus,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

impl AppState {
    fn new(pool: Pool<Postgres>, jwt_config: JwtConfig, event_bus: PgEventBus) -> Self {
        let (tx, _) = broadcast::channel::<String>(1024);
        Self {
            pool,
            dm_rooms: Arc::new(DashMap::new()),
            dm_messages: Arc::new(DashMap::new()),
            presence: Arc::new(DashMap::new()),
            read_status: Arc::new(DashMap::new()),
            broadcast_tx: tx,
            jwt_config,
            event_bus,
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn broadcast(state: &AppState, event_type: &str, payload: serde_json::Value) {
    let event = WsEvent {
        event_type: event_type.to_string(),
        payload,
    };
    let json = serde_json::to_string(&event).unwrap_or_default();
    let _ = state.broadcast_tx.send(json);
}

// ---------------------------------------------------------------------------
// Handlers — Health
// ---------------------------------------------------------------------------

async fn health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "ok",
        "service": "signapps-chat",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": signapps_common::healthz::uptime_seconds()
    }))
}

// ---------------------------------------------------------------------------
// Handlers — Channels (DB-backed)
// ---------------------------------------------------------------------------

async fn list_channels(State(state): State<AppState>) -> impl IntoResponse {
    match sqlx::query_as::<_, Channel>(
        "SELECT id, name, topic, is_private, created_by, created_at, updated_at \
         FROM chat.channels ORDER BY created_at ASC",
    )
    .fetch_all(&state.pool)
    .await
    {
        Ok(channels) => (
            StatusCode::OK,
            Json(serde_json::to_value(channels).unwrap_or_default()),
        ),
        Err(e) => {
            tracing::error!("list_channels DB error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
        },
    }
}

async fn get_channel(State(state): State<AppState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    match sqlx::query_as::<_, Channel>(
        "SELECT id, name, topic, is_private, created_by, created_at, updated_at \
         FROM chat.channels WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(channel)) => (
            StatusCode::OK,
            Json(serde_json::to_value(channel).unwrap_or_default()),
        ),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Channel not found" })),
        ),
        Err(e) => {
            tracing::error!("get_channel DB error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
        },
    }
}

async fn create_channel(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateChannelRequest>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, Channel>(
        r#"
        INSERT INTO chat.channels (name, topic, is_private, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, topic, is_private, created_by, created_at, updated_at
        "#,
    )
    .bind(&payload.name)
    .bind(&payload.topic)
    .bind(payload.is_private.unwrap_or(false))
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await
    {
        Ok(channel) => {
            tracing::info!(id = %channel.id, name = %channel.name, "Channel created");
            (
                StatusCode::CREATED,
                Json(serde_json::to_value(channel).unwrap_or_default()),
            )
        },
        Err(e) => {
            tracing::error!("create_channel DB error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to create channel" })),
            )
        },
    }
}

async fn update_channel(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateChannelRequest>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, Channel>(
        r#"
        UPDATE chat.channels
        SET name = $1,
            topic = COALESCE($2, topic),
            is_private = COALESCE($3, is_private),
            updated_at = NOW()
        WHERE id = $4
        RETURNING id, name, topic, is_private, created_by, created_at, updated_at
        "#,
    )
    .bind(&payload.name)
    .bind(&payload.topic)
    .bind(payload.is_private)
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(channel)) => {
            tracing::info!(id = %id, "Channel updated");
            (
                StatusCode::OK,
                Json(serde_json::to_value(channel).unwrap_or_default()),
            )
        },
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Channel not found" })),
        ),
        Err(e) => {
            tracing::error!("update_channel DB error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
        },
    }
}

async fn delete_channel(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query("DELETE FROM chat.channels WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await
    {
        Ok(r) if r.rows_affected() > 0 => {
            tracing::info!(id = %id, "Channel deleted");
            (StatusCode::NO_CONTENT, Json(serde_json::json!({})))
        },
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Channel not found" })),
        ),
        Err(e) => {
            tracing::error!("delete_channel DB error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
        },
    }
}

// ---------------------------------------------------------------------------
// Handlers — Messages (DB-backed)
// ---------------------------------------------------------------------------

async fn list_messages(
    State(state): State<AppState>,
    Path(channel_id): Path<Uuid>,
) -> impl IntoResponse {
    // Verify channel exists
    match sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM chat.channels WHERE id = $1)")
        .bind(channel_id)
        .fetch_one(&state.pool)
        .await
    {
        Ok(false) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Channel not found" })),
            )
        },
        Err(e) => {
            tracing::error!("list_messages channel check error: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            );
        },
        Ok(true) => {},
    }

    match sqlx::query_as::<_, MessageRow>(
        "SELECT id, channel_id, user_id, username, content, parent_id, \
                reactions, attachment, is_pinned, created_at, updated_at \
         FROM chat.messages WHERE channel_id = $1 ORDER BY created_at ASC",
    )
    .bind(channel_id)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => {
            let msgs: Vec<ChatMessage> = rows.into_iter().map(ChatMessage::from).collect();
            (
                StatusCode::OK,
                Json(serde_json::to_value(msgs).unwrap_or_default()),
            )
        },
        Err(e) => {
            tracing::error!("list_messages DB error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
        },
    }
}

async fn send_message(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(channel_id): Path<Uuid>,
    Json(payload): Json<SendMessageRequest>,
) -> impl IntoResponse {
    // Verify channel exists
    match sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM chat.channels WHERE id = $1)")
        .bind(channel_id)
        .fetch_one(&state.pool)
        .await
    {
        Ok(false) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Channel not found" })),
            )
        },
        Err(e) => {
            tracing::error!("send_message channel check error: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            );
        },
        Ok(true) => {},
    }

    match sqlx::query_as::<_, MessageRow>(
        r#"
        INSERT INTO chat.messages (channel_id, user_id, username, content, parent_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, channel_id, user_id, username, content, parent_id,
                  reactions, attachment, is_pinned, created_at, updated_at
        "#,
    )
    .bind(channel_id)
    .bind(claims.sub)
    .bind(&claims.username)
    .bind(&payload.content)
    .bind(payload.parent_id)
    .fetch_one(&state.pool)
    .await
    {
        Ok(row) => {
            let msg = ChatMessage::from(row);
            tracing::info!(id = %msg.id, channel = %channel_id, "Message sent");
            broadcast(
                &state,
                "new_message",
                serde_json::to_value(&msg).unwrap_or_default(),
            );
            let _ = state
                .event_bus
                .publish(NewEvent {
                    event_type: "chat.message.created".into(),
                    aggregate_id: Some(msg.id),
                    payload: serde_json::json!({
                        "channel_id": channel_id,
                        "user_id": claims.sub,
                    }),
                })
                .await;
            (
                StatusCode::CREATED,
                Json(serde_json::to_value(&msg).unwrap_or_default()),
            )
        },
        Err(e) => {
            tracing::error!("send_message DB error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to save message" })),
            )
        },
    }
}

// ---------------------------------------------------------------------------
// Handlers — Edit & Delete Messages
// ---------------------------------------------------------------------------

async fn edit_message(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((channel_id, message_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<EditMessageRequest>,
) -> impl IntoResponse {
    if payload.content.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Content cannot be empty" })),
        );
    }

    // Try DB-backed channel messages first (only own messages)
    let result = sqlx::query_as::<_, MessageRow>(
        r#"
        UPDATE chat.messages
        SET content = $1, updated_at = NOW()
        WHERE id = $2 AND channel_id = $3 AND user_id = $4
        RETURNING id, channel_id, user_id, username, content, parent_id,
                  reactions, attachment, is_pinned, created_at, updated_at
        "#,
    )
    .bind(&payload.content)
    .bind(message_id)
    .bind(channel_id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await;

    match result {
        Ok(Some(row)) => {
            let msg = ChatMessage::from(row);
            broadcast(
                &state,
                "message_edited",
                serde_json::to_value(&msg).unwrap_or_default(),
            );
            return (
                StatusCode::OK,
                Json(serde_json::to_value(&msg).unwrap_or_default()),
            );
        },
        Ok(None) => {},
        Err(e) => {
            tracing::error!("edit_message DB error: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            );
        },
    }

    // Try DM in-memory
    for mut entry in state.dm_messages.iter_mut() {
        if let Some(msg) = entry
            .value_mut()
            .iter_mut()
            .find(|m| m.id == message_id && m.user_id == claims.sub)
        {
            msg.content = payload.content.clone();
            msg.updated_at = Utc::now().to_rfc3339();
            let val = serde_json::to_value(msg.clone()).unwrap_or_default();
            broadcast(&state, "message_edited", val.clone());
            return (StatusCode::OK, Json(val));
        }
    }

    (
        StatusCode::NOT_FOUND,
        Json(serde_json::json!({ "error": "Message not found or not yours" })),
    )
}

async fn delete_message(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((channel_id, message_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    // Try DB-backed channel messages first (only own messages)
    let result =
        sqlx::query("DELETE FROM chat.messages WHERE id = $1 AND channel_id = $2 AND user_id = $3")
            .bind(message_id)
            .bind(channel_id)
            .bind(claims.sub)
            .execute(&state.pool)
            .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            tracing::info!(id = %message_id, channel = %channel_id, "Message deleted");
            broadcast(
                &state,
                "message_deleted",
                serde_json::json!({ "message_id": message_id, "channel_id": channel_id }),
            );
            return (StatusCode::NO_CONTENT, Json(serde_json::json!({})));
        },
        Ok(_) => {},
        Err(e) => {
            tracing::error!("delete_message DB error: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            );
        },
    }

    // Try DM in-memory
    for mut entry in state.dm_messages.iter_mut() {
        let msgs = entry.value_mut();
        if let Some(pos) = msgs
            .iter()
            .position(|m| m.id == message_id && m.user_id == claims.sub)
        {
            msgs.remove(pos);
            broadcast(
                &state,
                "message_deleted",
                serde_json::json!({ "message_id": message_id }),
            );
            return (StatusCode::NO_CONTENT, Json(serde_json::json!({})));
        }
    }

    (
        StatusCode::NOT_FOUND,
        Json(serde_json::json!({ "error": "Message not found or not yours" })),
    )
}

// ---------------------------------------------------------------------------
// Handlers — File upload (IDEA-134)
// ---------------------------------------------------------------------------

async fn upload_file(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(channel_id): Path<Uuid>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let mut filename = String::from("file");
    let mut content_type = String::from("application/octet-stream");
    let mut size: u64 = 0;

    while let Ok(Some(field)) = multipart.next_field().await {
        if let Some(name) = field.file_name() {
            filename = name.to_string();
        }
        if let Some(ct) = field.content_type() {
            content_type = ct.to_string();
        }
        if let Ok(bytes) = field.bytes().await {
            size = bytes.len() as u64;
        }
    }

    // In a real implementation this would upload to signapps-storage
    let attachment = Attachment {
        url: format!("/api/v1/channels/{}/files/{}", channel_id, Uuid::new_v4()),
        filename,
        content_type,
        size,
    };

    (
        StatusCode::CREATED,
        Json(serde_json::to_value(attachment).unwrap_or_default()),
    )
}

// ---------------------------------------------------------------------------
// Handlers — Reactions (IDEA-131, DB-backed)
// ---------------------------------------------------------------------------

async fn add_reaction(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(message_id): Path<Uuid>,
    Json(payload): Json<AddReactionRequest>,
) -> impl IntoResponse {
    // Try channel messages first
    let result = sqlx::query_as::<_, MessageRow>(
        r#"
        UPDATE chat.messages
        SET reactions = jsonb_set(
            reactions,
            ARRAY[$1],
            to_jsonb(COALESCE((reactions->$1)::int, 0) + 1)
        ),
        updated_at = NOW()
        WHERE id = $2
        RETURNING id, channel_id, user_id, username, content, parent_id,
                  reactions, attachment, is_pinned, created_at, updated_at
        "#,
    )
    .bind(&payload.emoji)
    .bind(message_id)
    .fetch_optional(&state.pool)
    .await;

    match result {
        Ok(Some(row)) => {
            broadcast(
                &state,
                "reaction_added",
                serde_json::json!({
                    "message_id": message_id,
                    "emoji": payload.emoji,
                    "user_id": claims.sub,
                    "count": row.reactions.get(&payload.emoji),
                }),
            );
            return (
                StatusCode::CREATED,
                Json(serde_json::json!({ "status": "ok" })),
            );
        },
        Ok(None) => {
            // Message not in DB channel messages — fall through to DM in-memory
        },
        Err(e) => {
            tracing::error!("add_reaction DB error: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            );
        },
    }

    // Check DM messages (still in-memory)
    for mut entry in state.dm_messages.iter_mut() {
        if let Some(msg) = entry.value_mut().iter_mut().find(|m| m.id == message_id) {
            if !msg.reactions.is_object() {
                msg.reactions = serde_json::json!({});
            }
            if let Some(reactions) = msg.reactions.as_object_mut() {
                let count = reactions
                    .entry(payload.emoji.clone())
                    .or_insert(serde_json::json!(0));
                *count = serde_json::json!(count.as_u64().unwrap_or(0) + 1);
            }
            msg.updated_at = Utc::now().to_rfc3339();
            return (
                StatusCode::CREATED,
                Json(serde_json::json!({ "status": "ok" })),
            );
        }
    }

    (
        StatusCode::NOT_FOUND,
        Json(serde_json::json!({ "error": "Message not found" })),
    )
}

// ---------------------------------------------------------------------------
// Handlers — Pin messages (IDEA-132, DB-backed)
// ---------------------------------------------------------------------------

async fn pin_message(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path((channel_id, message_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    match sqlx::query(
        "UPDATE chat.messages SET is_pinned = true, updated_at = NOW() \
         WHERE id = $1 AND channel_id = $2",
    )
    .bind(message_id)
    .bind(channel_id)
    .execute(&state.pool)
    .await
    {
        Ok(r) if r.rows_affected() > 0 => {
            broadcast(
                &state,
                "message_pinned",
                serde_json::json!({
                    "channel_id": channel_id,
                    "message_id": message_id,
                }),
            );
            (
                StatusCode::OK,
                Json(serde_json::json!({ "status": "pinned" })),
            )
        },
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Message not found" })),
        ),
        Err(e) => {
            tracing::error!("pin_message DB error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
        },
    }
}

async fn unpin_message(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path((channel_id, message_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    match sqlx::query(
        "UPDATE chat.messages SET is_pinned = false, updated_at = NOW() \
         WHERE id = $1 AND channel_id = $2",
    )
    .bind(message_id)
    .bind(channel_id)
    .execute(&state.pool)
    .await
    {
        Ok(r) if r.rows_affected() > 0 => (
            StatusCode::OK,
            Json(serde_json::json!({ "status": "unpinned" })),
        ),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Message not found" })),
        ),
        Err(e) => {
            tracing::error!("unpin_message DB error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
        },
    }
}

async fn list_pinned(
    State(state): State<AppState>,
    Path(channel_id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, MessageRow>(
        "SELECT id, channel_id, user_id, username, content, parent_id, \
                reactions, attachment, is_pinned, created_at, updated_at \
         FROM chat.messages WHERE channel_id = $1 AND is_pinned = true \
         ORDER BY created_at ASC",
    )
    .bind(channel_id)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => {
            let msgs: Vec<ChatMessage> = rows.into_iter().map(ChatMessage::from).collect();
            (
                StatusCode::OK,
                Json(serde_json::to_value(msgs).unwrap_or_default()),
            )
        },
        Err(e) => {
            tracing::error!("list_pinned DB error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
        },
    }
}

// ---------------------------------------------------------------------------
// Handlers — Direct Messages (IDEA-137, in-memory)
// ---------------------------------------------------------------------------

async fn list_dms(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let rooms: Vec<DirectMessageRoom> = state
        .dm_rooms
        .iter()
        .filter(|e| {
            e.value()
                .participants
                .iter()
                .any(|p| p.user_id == claims.sub)
        })
        .map(|e| e.value().clone())
        .collect();
    Json(rooms)
}

async fn create_dm(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateDmRequest>,
) -> impl IntoResponse {
    // Check if DM room already exists between these participants
    let mut all_ids = payload.participant_ids.clone();
    all_ids.push(claims.sub);
    all_ids.sort();

    for entry in state.dm_rooms.iter() {
        let mut room_ids: Vec<Uuid> = entry
            .value()
            .participants
            .iter()
            .map(|p| p.user_id)
            .collect();
        room_ids.sort();
        if room_ids == all_ids {
            return (
                StatusCode::OK,
                Json(serde_json::to_value(entry.value().clone()).unwrap_or_default()),
            );
        }
    }

    let now = Utc::now().to_rfc3339();
    let mut participants: Vec<DmParticipant> = payload
        .participant_ids
        .iter()
        .map(|id| DmParticipant {
            user_id: *id,
            username: id.to_string(),
        })
        .collect();
    participants.push(DmParticipant {
        user_id: claims.sub,
        username: claims.username.clone(),
    });

    let room = DirectMessageRoom {
        id: Uuid::new_v4(),
        participants,
        created_at: now,
        last_message_at: None,
    };
    let room_id = room.id;
    state.dm_rooms.insert(room_id, room.clone());
    state.dm_messages.insert(room_id, Vec::new());

    (
        StatusCode::CREATED,
        Json(serde_json::to_value(room).unwrap_or_default()),
    )
}

async fn delete_dm(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(room_id): Path<Uuid>,
) -> impl IntoResponse {
    match state.dm_rooms.get(&room_id) {
        Some(room) if room.participants.iter().any(|p| p.user_id == claims.sub) => {
            state.dm_rooms.remove(&room_id);
            state.dm_messages.remove(&room_id);
            (StatusCode::NO_CONTENT, Json(serde_json::json!({})))
        },
        Some(_) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "Not a participant" })),
        ),
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "DM not found" })),
        ),
    }
}

async fn list_dm_messages(
    State(state): State<AppState>,
    Path(room_id): Path<Uuid>,
) -> impl IntoResponse {
    match state.dm_messages.get(&room_id) {
        Some(msgs) => (
            StatusCode::OK,
            Json(serde_json::to_value(&*msgs).unwrap_or_default()),
        ),
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "DM room not found" })),
        ),
    }
}

async fn send_dm_message(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(room_id): Path<Uuid>,
    Json(payload): Json<SendMessageRequest>,
) -> impl IntoResponse {
    if !state.dm_rooms.contains_key(&room_id) {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "DM not found" })),
        );
    }

    let now = Utc::now().to_rfc3339();
    let msg = ChatMessage {
        id: Uuid::new_v4(),
        channel_id: room_id,
        user_id: claims.sub,
        username: claims.username.clone(),
        content: payload.content,
        parent_id: None,
        reactions: serde_json::json!({}),
        attachment: None,
        is_pinned: false,
        created_at: now.clone(),
        updated_at: now.clone(),
    };

    state
        .dm_messages
        .entry(room_id)
        .or_default()
        .push(msg.clone());
    if let Some(mut room) = state.dm_rooms.get_mut(&room_id) {
        room.last_message_at = Some(now);
    }

    broadcast(
        &state,
        "new_message",
        serde_json::to_value(&msg).unwrap_or_default(),
    );
    (
        StatusCode::CREATED,
        Json(serde_json::to_value(&msg).unwrap_or_default()),
    )
}

// ---------------------------------------------------------------------------
// Handlers — Presence (IDEA-136)
// ---------------------------------------------------------------------------

async fn get_presence(State(state): State<AppState>) -> impl IntoResponse {
    let entries: Vec<PresenceEntry> = state.presence.iter().map(|e| e.value().clone()).collect();
    Json(entries)
}

async fn set_presence(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<SetPresenceRequest>,
) -> impl IntoResponse {
    let entry = PresenceEntry {
        user_id: claims.sub,
        status: payload.status.clone(),
        updated_at: Utc::now().to_rfc3339(),
    };
    state.presence.insert(claims.sub, entry.clone());
    broadcast(
        &state,
        "presence_updated",
        serde_json::to_value(&entry).unwrap_or_default(),
    );
    (
        StatusCode::OK,
        Json(serde_json::to_value(entry).unwrap_or_default()),
    )
}

// ---------------------------------------------------------------------------
// Handlers — Search (IDEA-138, DB-backed)
// ---------------------------------------------------------------------------

async fn search_messages(
    State(state): State<AppState>,
    Path(channel_id): Path<Uuid>,
    Query(params): Query<SearchQuery>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, MessageRow>(
        "SELECT id, channel_id, user_id, username, content, parent_id, \
                reactions, attachment, is_pinned, created_at, updated_at \
         FROM chat.messages \
         WHERE channel_id = $1 AND content ILIKE $2 \
         ORDER BY created_at DESC \
         LIMIT 100",
    )
    .bind(channel_id)
    .bind(format!("%{}%", params.q))
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => {
            let msgs: Vec<ChatMessage> = rows.into_iter().map(ChatMessage::from).collect();
            (
                StatusCode::OK,
                Json(serde_json::to_value(msgs).unwrap_or_default()),
            )
        },
        Err(e) => {
            tracing::error!("search_messages DB error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
        },
    }
}

// ---------------------------------------------------------------------------
// Handlers — Read status / Unread counts (IDEA-140, in-memory)
// ---------------------------------------------------------------------------

async fn get_read_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(channel_id): Path<Uuid>,
) -> impl IntoResponse {
    let key = format!("{}:{}", channel_id, claims.sub);
    match state.read_status.get(&key) {
        Some(s) => (
            StatusCode::OK,
            Json(serde_json::to_value(s.clone()).unwrap_or_default()),
        ),
        None => {
            // Count unread from DB
            let msg_count: i64 =
                sqlx::query_scalar("SELECT COUNT(*) FROM chat.messages WHERE channel_id = $1")
                    .bind(channel_id)
                    .fetch_one(&state.pool)
                    .await
                    .unwrap_or(0);

            let status = ReadStatus {
                channel_id,
                user_id: claims.sub,
                unread_count: msg_count as u64,
                last_read_at: Utc::now().to_rfc3339(),
            };
            (
                StatusCode::OK,
                Json(serde_json::to_value(status).unwrap_or_default()),
            )
        },
    }
}

async fn mark_channel_read(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(channel_id): Path<Uuid>,
) -> impl IntoResponse {
    let key = format!("{}:{}", channel_id, claims.sub);
    let status = ReadStatus {
        channel_id,
        user_id: claims.sub,
        unread_count: 0,
        last_read_at: Utc::now().to_rfc3339(),
    };
    state.read_status.insert(key, status.clone());
    (
        StatusCode::OK,
        Json(serde_json::to_value(status).unwrap_or_default()),
    )
}

async fn get_all_unread(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let statuses: Vec<ReadStatus> = state
        .read_status
        .iter()
        .filter(|e| e.value().user_id == claims.sub)
        .map(|e| e.value().clone())
        .collect();
    Json(statuses)
}

// ---------------------------------------------------------------------------
// Handlers — Export channel history (IDEA-142, DB-backed)
// ---------------------------------------------------------------------------

async fn export_channel(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(channel_id): Path<Uuid>,
    Query(params): Query<ExportQuery>,
) -> impl IntoResponse {
    let format = params.format.as_deref().unwrap_or("json");

    let rows = match sqlx::query_as::<_, MessageRow>(
        "SELECT id, channel_id, user_id, username, content, parent_id, \
                reactions, attachment, is_pinned, created_at, updated_at \
         FROM chat.messages WHERE channel_id = $1 ORDER BY created_at ASC",
    )
    .bind(channel_id)
    .fetch_all(&state.pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("export_channel DB error: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                [(axum::http::header::CONTENT_TYPE, "application/json")],
                serde_json::json!({ "error": "Database error" }).to_string(),
            );
        },
    };

    let msgs: Vec<ChatMessage> = rows.into_iter().map(ChatMessage::from).collect();

    if format == "csv" {
        let mut csv = String::from("id,username,content,created_at\n");
        for m in &msgs {
            let content = m.content.replace('"', "\"\"");
            csv.push_str(&format!(
                "{},{},\"{}\",{}\n",
                m.id, m.username, content, m.created_at
            ));
        }
        (
            StatusCode::OK,
            [(axum::http::header::CONTENT_TYPE, "text/csv")],
            csv,
        )
    } else {
        let json = serde_json::to_string(&msgs).unwrap_or_default();
        (
            StatusCode::OK,
            [(axum::http::header::CONTENT_TYPE, "application/json")],
            json,
        )
    }
}

// ---------------------------------------------------------------------------
// WebSocket handler
// ---------------------------------------------------------------------------

async fn ws_upgrade(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws(socket, state))
}

async fn handle_ws(socket: WebSocket, state: AppState) {
    let session_id = Uuid::new_v4();
    tracing::info!(session = %session_id, "WebSocket connected");

    let (mut ws_tx, mut ws_rx) = socket.split();
    let mut broadcast_rx = state.broadcast_tx.subscribe();

    let send_task = tokio::spawn(async move {
        while let Ok(event_json) = broadcast_rx.recv().await {
            if ws_tx.send(Message::Text(event_json)).await.is_err() {
                break;
            }
        }
    });

    let tx = state.broadcast_tx.clone();
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_rx.next().await {
            match msg {
                Message::Text(text) => {
                    let _ = tx.send(text.to_string());
                },
                Message::Close(_) => break,
                _ => {},
            }
        }
    });

    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    tracing::info!(session = %session_id, "WebSocket disconnected");
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

fn create_router(state: AppState) -> Router {
    let public_routes = Router::new().route("/health", get(health_check));

    let protected_routes = Router::new()
        // Channels
        .route("/api/v1/channels", get(list_channels).post(create_channel))
        .route(
            "/api/v1/channels/:id",
            get(get_channel).put(update_channel).delete(delete_channel),
        )
        // Messages
        .route("/api/v1/channels/:id/messages", get(list_messages).post(send_message))
        .route(
            "/api/v1/channels/:channel_id/messages/:message_id",
            patch(edit_message).delete(delete_message),
        )
        // File upload per channel
        .route("/api/v1/channels/:id/upload", post(upload_file))
        // Pins (IDEA-132)
        .route("/api/v1/channels/:channel_id/pins", get(list_pinned))
        .route("/api/v1/channels/:channel_id/messages/:message_id/pin", post(pin_message))
        .route("/api/v1/channels/:channel_id/messages/:message_id/pin", delete(unpin_message))
        // Search (IDEA-138)
        .route("/api/v1/channels/:id/search", get(search_messages))
        // Export (IDEA-142)
        .route("/api/v1/channels/:id/export", get(export_channel))
        // Read status (IDEA-140)
        .route("/api/v1/channels/:id/read-status", get(get_read_status).post(mark_channel_read))
        .route("/api/v1/unread-counts", get(get_all_unread))
        // Reactions (IDEA-131)
        .route("/api/v1/messages/:id/reactions", post(add_reaction))
        // Direct Messages (IDEA-137)
        .route("/api/v1/dms", get(list_dms).post(create_dm))
        .route("/api/v1/dms/:id", delete(delete_dm))
        .route("/api/v1/dms/:id/messages", get(list_dm_messages).post(send_dm_message))
        // Presence (IDEA-136)
        .route("/api/v1/presence", get(get_presence).post(set_presence))
        // WebSocket
        .route("/api/v1/ws", get(ws_upgrade))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    public_routes
        .merge(protected_routes)
        .layer(TraceLayer::new_for_http())
        .layer(
            CorsLayer::new()
                .allow_origin(AllowOrigin::list([
                    "http://localhost:3000".parse().expect("valid origin"),
                    "http://127.0.0.1:3000".parse().expect("valid origin"),
                ]))
                .allow_credentials(true)
                .allow_methods([
                    axum::http::Method::GET,
                    axum::http::Method::POST,
                    axum::http::Method::PUT,
                    axum::http::Method::PATCH,
                    axum::http::Method::DELETE,
                    axum::http::Method::OPTIONS,
                ])
                .allow_headers([
                    axum::http::header::CONTENT_TYPE,
                    axum::http::header::AUTHORIZATION,
                    axum::http::header::ACCEPT,
                    axum::http::header::ORIGIN,
                    axum::http::HeaderName::from_static("x-workspace-id"),
                    axum::http::HeaderName::from_static("x-request-id"),
                ]),
        )
        .layer(axum::extract::DefaultBodyLimit::max(50 * 1024 * 1024))
        .with_state(state)
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing("signapps_chat");
    load_env();

    let config = ServiceConfig::from_env("signapps-chat", 3020);
    config.log_startup();

    let db_pool = signapps_db::create_pool(&config.database_url)
        .await
        .expect("Failed to connect to Postgres");
    tracing::info!("Database pool created");

    let event_bus = PgEventBus::new(db_pool.inner().clone(), "signapps-chat".to_string());

    let jwt_config = config.jwt_config();
    let state = AppState::new(db_pool.inner().clone(), jwt_config, event_bus);
    tracing::info!("Chat service initialized with PostgreSQL persistence");

    let app = create_router(state);

    signapps_common::bootstrap::run_server(app, &config).await?;

    Ok(())
}
