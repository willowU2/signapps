//! SignApps Chat Service
//! Real-time messaging with channels, messages, reactions, threads, pins,
//! DMs, presence, search, file attachments and export.
//! In-memory skeleton — no database.

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Extension, Multipart, Path, Query, State,
    },
    http::StatusCode,
    middleware,
    response::IntoResponse,
    routing::{delete, get, post},
    Json, Router,
};
use chrono::Utc;
use dashmap::DashMap;
use futures_util::{stream::StreamExt, SinkExt};
use serde::{Deserialize, Serialize};
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::auth_middleware;
use signapps_common::{AuthState, Claims, JwtConfig};
use std::sync::Arc;
use tokio::sync::broadcast;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Channel {
    pub id: Uuid,
    pub name: String,
    pub topic: Option<String>,
    pub is_private: bool,
    pub created_by: Uuid,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub url: String,
    pub filename: String,
    pub content_type: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectMessageRoom {
    pub id: Uuid,
    pub participants: Vec<DmParticipant>,
    pub created_at: String,
    pub last_message_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DmParticipant {
    pub user_id: Uuid,
    pub username: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresenceEntry {
    pub user_id: Uuid,
    pub status: String, // "online" | "away" | "busy" | "offline"
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
pub struct CreateChannelRequest {
    pub name: String,
    pub topic: Option<String>,
    pub is_private: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub content: String,
    pub parent_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct AddReactionRequest {
    pub emoji: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateDmRequest {
    pub participant_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct SetPresenceRequest {
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
}

#[derive(Debug, Deserialize)]
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
// Application state (in-memory)
// ---------------------------------------------------------------------------

#[derive(Clone)]
pub struct AppState {
    pub channels: Arc<DashMap<Uuid, Channel>>,
    pub messages: Arc<DashMap<Uuid, Vec<ChatMessage>>>, // channel_id -> messages
    pub dm_rooms: Arc<DashMap<Uuid, DirectMessageRoom>>,
    pub dm_messages: Arc<DashMap<Uuid, Vec<ChatMessage>>>,
    pub presence: Arc<DashMap<Uuid, PresenceEntry>>,
    pub read_status: Arc<DashMap<String, ReadStatus>>, // "{channel_id}:{user_id}" -> status
    pub broadcast_tx: broadcast::Sender<String>,
    pub jwt_config: JwtConfig,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

impl AppState {
    fn new(jwt_config: JwtConfig) -> Self {
        let (tx, _) = broadcast::channel::<String>(1024);
        Self {
            channels: Arc::new(DashMap::new()),
            messages: Arc::new(DashMap::new()),
            dm_rooms: Arc::new(DashMap::new()),
            dm_messages: Arc::new(DashMap::new()),
            presence: Arc::new(DashMap::new()),
            read_status: Arc::new(DashMap::new()),
            broadcast_tx: tx,
            jwt_config,
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
// Handlers — Channels
// ---------------------------------------------------------------------------

async fn list_channels(State(state): State<AppState>) -> impl IntoResponse {
    let channels: Vec<Channel> = state.channels.iter().map(|e| e.value().clone()).collect();
    Json(channels)
}

async fn create_channel(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateChannelRequest>,
) -> impl IntoResponse {
    let now = Utc::now().to_rfc3339();
    let channel = Channel {
        id: Uuid::new_v4(),
        name: payload.name,
        topic: payload.topic,
        is_private: payload.is_private.unwrap_or(false),
        created_by: claims.sub,
        created_at: now.clone(),
        updated_at: now,
    };
    state.channels.insert(channel.id, channel.clone());
    state.messages.insert(channel.id, Vec::new());
    tracing::info!(id = %channel.id, name = %channel.name, "Channel created");
    (StatusCode::CREATED, Json(channel))
}

// ---------------------------------------------------------------------------
// Handlers — Messages
// ---------------------------------------------------------------------------

async fn list_messages(
    State(state): State<AppState>,
    Path(channel_id): Path<Uuid>,
) -> impl IntoResponse {
    match state.messages.get(&channel_id) {
        Some(msgs) => (
            StatusCode::OK,
            Json(serde_json::to_value(&*msgs).unwrap_or_default()),
        ),
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Channel not found" })),
        ),
    }
}

async fn send_message(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(channel_id): Path<Uuid>,
    Json(payload): Json<SendMessageRequest>,
) -> impl IntoResponse {
    if !state.channels.contains_key(&channel_id) {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Channel not found" })),
        );
    }

    let now = Utc::now().to_rfc3339();
    let msg = ChatMessage {
        id: Uuid::new_v4(),
        channel_id,
        user_id: claims.sub,
        username: claims.username.clone(),
        content: payload.content,
        parent_id: payload.parent_id,
        reactions: serde_json::json!({}),
        attachment: None,
        is_pinned: false,
        created_at: now.clone(),
        updated_at: now,
    };

    state
        .messages
        .entry(channel_id)
        .or_default()
        .push(msg.clone());

    // Update unread counts for all users (simplified: increment a global counter)
    broadcast(
        &state,
        "new_message",
        serde_json::to_value(&msg).unwrap_or_default(),
    );

    tracing::info!(id = %msg.id, channel = %channel_id, "Message sent");
    (
        StatusCode::CREATED,
        Json(serde_json::to_value(&msg).unwrap_or_default()),
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
    // For now return a placeholder URL
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
// Handlers — Reactions (IDEA-131)
// ---------------------------------------------------------------------------

async fn add_reaction(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(message_id): Path<Uuid>,
    Json(payload): Json<AddReactionRequest>,
) -> impl IntoResponse {
    for mut entry in state.messages.iter_mut() {
        if let Some(msg) = entry.value_mut().iter_mut().find(|m| m.id == message_id) {
            let reactions = msg.reactions.as_object_mut().unwrap();
            let count = reactions
                .entry(payload.emoji.clone())
                .or_insert(serde_json::json!(0));
            *count = serde_json::json!(count.as_u64().unwrap_or(0) + 1);
            msg.updated_at = Utc::now().to_rfc3339();

            broadcast(
                &state,
                "reaction_added",
                serde_json::json!({
                    "message_id": message_id,
                    "emoji": payload.emoji,
                    "user_id": claims.sub,
                    "count": reactions[&payload.emoji],
                }),
            );

            return (
                StatusCode::CREATED,
                Json(serde_json::json!({ "status": "ok" })),
            );
        }
    }
    // Also check DM messages
    for mut entry in state.dm_messages.iter_mut() {
        if let Some(msg) = entry.value_mut().iter_mut().find(|m| m.id == message_id) {
            let reactions = msg.reactions.as_object_mut().unwrap();
            let count = reactions
                .entry(payload.emoji.clone())
                .or_insert(serde_json::json!(0));
            *count = serde_json::json!(count.as_u64().unwrap_or(0) + 1);
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
// Handlers — Pin messages (IDEA-132)
// ---------------------------------------------------------------------------

async fn pin_message(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path((channel_id, message_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    for mut entry in state.messages.iter_mut() {
        if *entry.key() == channel_id {
            if let Some(msg) = entry.value_mut().iter_mut().find(|m| m.id == message_id) {
                msg.is_pinned = true;
                msg.updated_at = Utc::now().to_rfc3339();
                broadcast(
                    &state,
                    "message_pinned",
                    serde_json::json!({
                        "channel_id": channel_id,
                        "message_id": message_id,
                    }),
                );
                return (
                    StatusCode::OK,
                    Json(serde_json::json!({ "status": "pinned" })),
                );
            }
        }
    }
    (
        StatusCode::NOT_FOUND,
        Json(serde_json::json!({ "error": "Message not found" })),
    )
}

async fn unpin_message(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path((channel_id, message_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    for mut entry in state.messages.iter_mut() {
        if *entry.key() == channel_id {
            if let Some(msg) = entry.value_mut().iter_mut().find(|m| m.id == message_id) {
                msg.is_pinned = false;
                msg.updated_at = Utc::now().to_rfc3339();
                return (
                    StatusCode::OK,
                    Json(serde_json::json!({ "status": "unpinned" })),
                );
            }
        }
    }
    (
        StatusCode::NOT_FOUND,
        Json(serde_json::json!({ "error": "Message not found" })),
    )
}

async fn list_pinned(
    State(state): State<AppState>,
    Path(channel_id): Path<Uuid>,
) -> impl IntoResponse {
    match state.messages.get(&channel_id) {
        Some(msgs) => {
            let pinned: Vec<&ChatMessage> = msgs.iter().filter(|m| m.is_pinned).collect();
            (
                StatusCode::OK,
                Json(serde_json::to_value(pinned).unwrap_or_default()),
            )
        },
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Channel not found" })),
        ),
    }
}

// ---------------------------------------------------------------------------
// Handlers — Direct Messages (IDEA-137)
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
// Handlers — Search (IDEA-138)
// ---------------------------------------------------------------------------

async fn search_messages(
    State(state): State<AppState>,
    Path(channel_id): Path<Uuid>,
    Query(params): Query<SearchQuery>,
) -> impl IntoResponse {
    let query = params.q.to_lowercase();
    match state.messages.get(&channel_id) {
        Some(msgs) => {
            let results: Vec<&ChatMessage> = msgs
                .iter()
                .filter(|m| m.content.to_lowercase().contains(&query))
                .collect();
            (
                StatusCode::OK,
                Json(serde_json::to_value(results).unwrap_or_default()),
            )
        },
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Channel not found" })),
        ),
    }
}

// ---------------------------------------------------------------------------
// Handlers — Read status / Unread counts (IDEA-140)
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
            let msg_count = state
                .messages
                .get(&channel_id)
                .map(|m| m.len() as u64)
                .unwrap_or(0);
            let status = ReadStatus {
                channel_id,
                user_id: claims.sub,
                unread_count: msg_count,
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
// Handlers — Export channel history (IDEA-142)
// ---------------------------------------------------------------------------

async fn export_channel(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(channel_id): Path<Uuid>,
    Query(params): Query<ExportQuery>,
) -> impl IntoResponse {
    let format = params.format.as_deref().unwrap_or("json");
    match state.messages.get(&channel_id) {
        None => (
            StatusCode::NOT_FOUND,
            [(axum::http::header::CONTENT_TYPE, "application/json")],
            serde_json::json!({ "error": "Channel not found" }).to_string(),
        ),
        Some(msgs) => {
            if format == "csv" {
                let mut csv = String::from("id,username,content,created_at\n");
                for m in msgs.iter() {
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
                let json = serde_json::to_string(&*msgs).unwrap_or_default();
                (
                    StatusCode::OK,
                    [(axum::http::header::CONTENT_TYPE, "application/json")],
                    json,
                )
            }
        },
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
        // Messages
        .route("/api/v1/channels/:id/messages", get(list_messages).post(send_message))
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
                    "http://localhost:3000".parse().unwrap(),
                    "http://127.0.0.1:3000".parse().unwrap(),
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

    let jwt_config = config.jwt_config();
    let state = AppState::new(jwt_config);
    tracing::info!("In-memory store initialized (skeleton -- no DB yet)");

    let app = create_router(state);

    signapps_common::bootstrap::run_server(app, &config).await?;

    Ok(())
}
