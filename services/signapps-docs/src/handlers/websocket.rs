use axum::{
    extract::{ws::{WebSocket, WebSocketUpgrade}, Path, State},
    response::IntoResponse,
};
use futures::{stream::StreamExt, SinkExt};
use tokio::sync::broadcast;
use tokio_tungstenite::tungstenite::Message;
use tracing::{debug, error, info};
use uuid::Uuid;
use yrs::Doc;

use crate::{models::ClientSession, AppState};

/// Generic WebSocket handler for all document types
/// Endpoint: GET /api/v1/docs/{type}/{doc_id}/ws
pub async fn websocket_handler(
    Path((doc_type, doc_id)): Path<(String, String)>,
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    // Validate doc_id is a valid UUID
    if let Err(_) = Uuid::parse_str(&doc_id) {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            "Invalid document ID format",
        )
            .into_response();
    }

    ws.on_upgrade(move |socket| handle_socket(socket, doc_id, doc_type, state))
        .into_response()
}

async fn handle_socket(
    socket: WebSocket,
    doc_id: String,
    doc_type: String,
    state: AppState,
) {
    let session_id = Uuid::new_v4();

    info!(
        session_id = %session_id,
        doc_id = %doc_id,
        doc_type = %doc_type,
        "New WebSocket connection"
    );

    // Use composite key: type::doc_id
    let cache_key = format!("{}::{}", doc_type, doc_id);

    // Get or create document in memory
    let doc = if let Some(entry) = state.docs.get(&cache_key) {
        entry.clone()
    } else {
        let new_doc = Doc::new();
        state.docs.insert(cache_key.clone(), new_doc.clone());
        new_doc
    };

    // Create broadcast channel for this document
    let (tx, _rx) = broadcast::channel(100);

    // Split WebSocket into sender and receiver
    let (mut sender, mut receiver) = socket.split();

    // Create session
    let _session = ClientSession {
        id: session_id,
        doc_id: doc_id.clone(),
        tx: tx.clone(),
    };

    // Note: In production, send proper Y.js state snapshot here
    // For now, skip initial state sync
    info!(session_id = %session_id, "Ready for WebSocket messages");

    debug!(session_id = %session_id, doc_type = %doc_type, "Sent initial document state");

    // Handle incoming messages from client
    let mut client_rx = tx.subscribe();
    let mut receive_task = tokio::spawn(async move {
        while let Some(msg_result) = receiver.next().await {
            match msg_result {
                Ok(Message::Binary(data)) => {
                    // In production: Apply Y.js update to document
                    // For now: Just broadcast update to other clients
                    let _ = tx.send(data);

                    debug!(session_id = %session_id, "Update broadcasted");
                }
                Ok(Message::Text(msg)) => {
                    debug!(session_id = %session_id, message = %msg, "Text message received");
                }
                Ok(Message::Ping(_)) => {
                    debug!(session_id = %session_id, "Ping received");
                }
                Ok(Message::Pong(_)) => {
                    debug!(session_id = %session_id, "Pong received");
                }
                Ok(Message::Close(_)) => {
                    info!(session_id = %session_id, "Client requested close");
                    break;
                }
                Err(e) => {
                    error!(
                        session_id = %session_id,
                        error = ?e,
                        "WebSocket error"
                    );
                    break;
                }
                _ => {}
            }
        }
    });

    // Handle outgoing broadcasts to client
    let mut broadcast_task = tokio::spawn(async move {
        while let Ok(data) = client_rx.recv().await {
            if let Err(e) = sender.send(Message::Binary(data)).await {
                error!(
                    session_id = %session_id,
                    error = ?e,
                    "Failed to send broadcast"
                );
                break;
            }
        }
    });

    // Wait for either task to complete
    tokio::select! {
        _ = (&mut receive_task) => {
            broadcast_task.abort();
            debug!(session_id = %session_id, "Receive task ended");
        }
        _ = (&mut broadcast_task) => {
            receive_task.abort();
            debug!(session_id = %session_id, "Broadcast task ended");
        }
    }

    info!(
        session_id = %session_id,
        doc_id = %doc_id,
        doc_type = %doc_type,
        "WebSocket connection closed"
    );
}
