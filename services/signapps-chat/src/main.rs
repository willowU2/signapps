//! SignApps Chat Service
//! Real-time messaging with channels, messages, reactions, and WebSocket fan-out.
//! In-memory skeleton — no database.

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Extension, Path, State,
    },
    http::StatusCode,
    middleware,
    response::IntoResponse,
    routing::{get, post},
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
    pub author_id: Uuid,
    pub author_name: String,
    pub content: String,
    pub reactions: Vec<Reaction>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reaction {
    pub emoji: String,
    pub user_id: Uuid,
    pub created_at: String,
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
}

#[derive(Debug, Deserialize)]
pub struct AddReactionRequest {
    pub emoji: String,
    pub user_id: Uuid,
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
            broadcast_tx: tx,
            jwt_config,
        }
    }
}

// ---------------------------------------------------------------------------
// Handlers — Channels
// ---------------------------------------------------------------------------

async fn health_check() -> StatusCode {
    StatusCode::OK
}

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
        Some(msgs) => (StatusCode::OK, Json(serde_json::to_value(&*msgs).unwrap_or_default())),
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
            Json(serde_json::to_value(serde_json::json!({ "error": "Channel not found" })).unwrap()),
        );
    }

    // Derive author identity from JWT claims — never trust the client
    let author_id = claims.sub;
    let author_name = claims.username.clone();

    let now = Utc::now().to_rfc3339();
    let msg = ChatMessage {
        id: Uuid::new_v4(),
        channel_id,
        author_id,
        author_name,
        content: payload.content,
        reactions: Vec::new(),
        created_at: now.clone(),
        updated_at: now,
    };

    // Store message
    state
        .messages
        .entry(channel_id)
        .or_default()
        .push(msg.clone());

    // Broadcast via WebSocket
    let event = WsEvent {
        event_type: "new_message".to_string(),
        payload: serde_json::to_value(&msg).unwrap_or_default(),
    };
    let event_json = serde_json::to_string(&event).unwrap_or_default();
    let _ = state.broadcast_tx.send(event_json);

    tracing::info!(id = %msg.id, channel = %channel_id, "Message sent");
    (StatusCode::CREATED, Json(serde_json::to_value(&msg).unwrap_or_default()))
}

// ---------------------------------------------------------------------------
// Handlers — Reactions
// ---------------------------------------------------------------------------

async fn add_reaction(
    State(state): State<AppState>,
    Path(message_id): Path<Uuid>,
    Json(payload): Json<AddReactionRequest>,
) -> impl IntoResponse {
    // Find the message across all channels
    for mut entry in state.messages.iter_mut() {
        if let Some(msg) = entry.value_mut().iter_mut().find(|m| m.id == message_id) {
            let now = Utc::now().to_rfc3339();
            let reaction = Reaction {
                emoji: payload.emoji.clone(),
                user_id: payload.user_id,
                created_at: now,
            };
            msg.reactions.push(reaction);
            msg.updated_at = Utc::now().to_rfc3339();

            // Broadcast reaction event
            let event = WsEvent {
                event_type: "reaction_added".to_string(),
                payload: serde_json::json!({
                    "message_id": message_id,
                    "emoji": payload.emoji,
                    "user_id": payload.user_id,
                }),
            };
            let event_json = serde_json::to_string(&event).unwrap_or_default();
            let _ = state.broadcast_tx.send(event_json);

            tracing::info!(message = %message_id, emoji = %payload.emoji, "Reaction added");
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
// WebSocket handler
// ---------------------------------------------------------------------------

async fn ws_upgrade(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws(socket, state))
}

async fn handle_ws(socket: WebSocket, state: AppState) {
    let session_id = Uuid::new_v4();
    tracing::info!(session = %session_id, "WebSocket connected");

    let (mut ws_tx, mut ws_rx) = socket.split();
    let mut broadcast_rx = state.broadcast_tx.subscribe();

    // Task 1: forward broadcast events to this client
    let send_task = tokio::spawn(async move {
        while let Ok(event_json) = broadcast_rx.recv().await {
            if ws_tx.send(Message::Text(event_json.into())).await.is_err() {
                break;
            }
        }
    });

    // Task 2: receive messages from this client and broadcast them
    let tx = state.broadcast_tx.clone();
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_rx.next().await {
            match msg {
                Message::Text(text) => {
                    // Client can send chat messages directly via WS
                    // Re-broadcast to all connected clients
                    let _ = tx.send(text.to_string());
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    // Wait for either task to finish — then abort the other
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
    // Public routes (no auth required)
    let public_routes = Router::new()
        .route("/health", get(health_check));

    // Protected routes (auth required)
    let protected_routes = Router::new()
        // Channels
        .route("/api/v1/channels", get(list_channels).post(create_channel))
        // Messages
        .route(
            "/api/v1/channels/:id/messages",
            get(list_messages).post(send_message),
        )
        // Reactions
        .route("/api/v1/messages/:id/reactions", post(add_reaction))
        // WebSocket
        .route("/api/v1/ws", get(ws_upgrade))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    public_routes
        .merge(protected_routes)
        // Middleware
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::new()
            .allow_origin(AllowOrigin::list([
                "http://localhost:3000".parse().unwrap(),
                "http://127.0.0.1:3000".parse().unwrap(),
            ]))
            .allow_credentials(true)
            .allow_methods([axum::http::Method::GET, axum::http::Method::POST, axum::http::Method::PUT, axum::http::Method::PATCH, axum::http::Method::DELETE, axum::http::Method::OPTIONS])
            .allow_headers([axum::http::header::CONTENT_TYPE, axum::http::header::AUTHORIZATION, axum::http::header::ACCEPT, axum::http::header::ORIGIN]))
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
