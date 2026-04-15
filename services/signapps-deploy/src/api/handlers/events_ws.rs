//! `GET /events` — WebSocket upgrade that streams deployment events.
//!
//! ## Phase 3a scope
//!
//! This handler establishes the WebSocket upgrade, emits a `deploy.connected`
//! frame, and keeps the connection alive with a 30-second ping. Real
//! `deployment.*` event subscription from `PgEventBus` is deferred to a
//! follow-up — the current implementation gives the UI a working WebSocket
//! endpoint from day one and gracefully closes when the client disconnects.

use crate::api::state::AppState;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use serde::Serialize;
use std::time::Duration;
use tokio::time::interval;

const KEEPALIVE_INTERVAL: Duration = Duration::from_secs(30);

#[derive(Serialize)]
struct Frame {
    channel: String,
    payload: serde_json::Value,
}

#[tracing::instrument(skip(ws, _state))]
async fn events_ws_handler(
    ws: WebSocketUpgrade,
    State(_state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(handle_socket)
}

async fn handle_socket(mut socket: WebSocket) {
    tracing::info!("events websocket opened");
    let mut keepalive = interval(KEEPALIVE_INTERVAL);

    // Emit a startup frame so clients see something immediately.
    let startup = Frame {
        channel: "deploy.connected".into(),
        payload: serde_json::json!({ "version": env!("CARGO_PKG_VERSION") }),
    };
    if let Ok(txt) = serde_json::to_string(&startup) {
        if socket.send(Message::Text(txt)).await.is_err() {
            return;
        }
    }

    loop {
        tokio::select! {
            _ = keepalive.tick() => {
                if socket.send(Message::Ping(Vec::new())).await.is_err() {
                    break;
                }
            }
            incoming = socket.recv() => {
                match incoming {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Err(_)) => break,
                    _ => { /* ignore other client frames */ }
                }
            }
        }
    }
    tracing::info!("events websocket closed");
}

/// Build the router for the WebSocket events stream.
pub fn router() -> Router<AppState> {
    Router::new().route("/events", get(events_ws_handler))
}
