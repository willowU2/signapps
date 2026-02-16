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

/// WebSocket handler for collaborative document editing
/// Endpoint: GET /api/v1/collab/ws/:doc_id?token=JWT_TOKEN
pub async fn websocket_handler(
    Path(doc_id): Path<String>,
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

    ws.on_upgrade(move |socket| handle_socket(socket, doc_id, state))
        .into_response()
}

async fn handle_socket(
    socket: WebSocket,
    doc_id: String,
    state: AppState,
) {
    let session_id = Uuid::new_v4();

    info!(
        session_id = %session_id,
        doc_id = %doc_id,
        "New WebSocket connection"
    );

    // Get or create document in memory
    let doc = if let Some(entry) = state.docs.get(&doc_id) {
        entry.clone()
    } else {
        let new_doc = Doc::new();
        state.docs.insert(doc_id.clone(), new_doc.clone());
        new_doc
    };

    // Create broadcast channel for this document
    let (tx, _rx) = broadcast::channel(100);

    // Split WebSocket into sender and receiver
    let (mut sender, mut receiver) = socket.split();

    // Create session
    let session = ClientSession {
        id: session_id,
        doc_id: doc_id.clone(),
        tx: tx.clone(),
    };

    // Send initial state to client
    let state_vector = doc.get_state_vector();
    let initial_state = doc.encode_state_as_update(&state_vector);

    if let Err(e) = sender.send(Message::Binary(initial_state)).await {
        error!(
            session_id = %session_id,
            error = ?e,
            "Failed to send initial state"
        );
        return;
    }

    debug!(session_id = %session_id, "Sent initial document state");

    // Handle incoming messages from client
    let mut client_rx = tx.subscribe();
    let mut receive_task = tokio::spawn(async move {
        while let Some(msg_result) = receiver.next().await {
            match msg_result {
                Ok(Message::Binary(data)) => {
                    // Apply Y.js update to document
                    if let Err(e) = doc.transact_mut().apply_update_from_binary(data.clone()) {
                        error!(
                            session_id = %session_id,
                            error = ?e,
                            "Failed to apply update"
                        );
                        continue;
                    }

                    // Broadcast update to other clients
                    let _ = tx.send(data);

                    debug!(session_id = %session_id, "Update applied and broadcasted");
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
        "WebSocket connection closed"
    );

    // Persist document before closing
    // (implement in persistence module)
    // save_document(&doc_id, &doc, &state.pool).await.ok();
}
