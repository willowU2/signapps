//! Handler for real-time CRDT WebSocket sync.

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
// WebSocket streams use axum's built-in recv/send rather than futures SinkExt/StreamExt
use serde::{Deserialize, Serialize};

use crate::AppState;

/// Gère l'upgrade WebSocket.
#[tracing::instrument(skip(ws, state))]
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

#[derive(Serialize, Deserialize, Debug)]
pub struct WsMessage {
    pub message_type: String, // "crdt_patch", "request_sync"
    pub payload: serde_json::Value,
}

async fn handle_socket(mut socket: WebSocket, state: AppState) {
    tracing::info!("New WebSocket connection established for CRDT sync");

    while let Some(msg) = socket.recv().await {
        if let Ok(Message::Text(text)) = msg {
            // Process CRDT patch (Simplified for concept demonstration)
            match serde_json::from_str::<WsMessage>(&text) {
                Ok(parsed_req) => {
                    tracing::debug!(?parsed_req, "Received WS Message");
                    
                    // TODO: WASM Engine Validation Hook
                    // TODO: pgvector recalculation Trigger
                    
                    // Fake successful sync reply
                    let reply = WsMessage {
                        message_type: "sync_ack".to_string(),
                        payload: serde_json::json!({"status": "synced"}),
                    };
                    
                    if let Ok(reply_text) = serde_json::to_string(&reply) {
                        let _ = socket.send(Message::Text(reply_text.into())).await;
                    }
                }
                Err(e) => {
                    tracing::error!(?e, "Failed to parse CRDT message");
                }
            }
        }
    }
    tracing::info!("WebSocket connection closed");
}
