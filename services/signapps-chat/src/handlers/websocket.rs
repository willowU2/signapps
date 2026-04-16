//! WebSocket upgrade and connection handler.

use crate::state::AppState;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
use futures_util::{stream::StreamExt, SinkExt};
use uuid::Uuid;

/// Upgrade an HTTP connection to WebSocket.
pub async fn ws_upgrade(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws(socket, state))
}

async fn handle_ws(socket: WebSocket, state: AppState) {
    let session_id = Uuid::new_v4();
    tracing::info!(session = %session_id, "WebSocket connected");

    let (mut ws_tx, mut ws_rx) = socket.split();
    let mut broadcast_rx = state.broadcast_tx.subscribe();

    let mut send_task = tokio::spawn(async move {
        while let Ok(event_json) = broadcast_rx.recv().await {
            if ws_tx.send(Message::Text(event_json)).await.is_err() {
                break;
            }
        }
    });

    let tx = state.broadcast_tx.clone();
    let mut recv_task = tokio::spawn(async move {
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

    // On the first task completion, abort the other so we do not leak a
    // zombie task holding a live broadcast::Receiver slot for the rest of
    // the process lifetime.
    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    }

    tracing::info!(session = %session_id, "WebSocket disconnected");
}
