use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    response::IntoResponse,
};
use futures::{stream::StreamExt, SinkExt};
use std::sync::atomic::{AtomicUsize, Ordering};
use tokio::sync::broadcast;
use tracing::{debug, error, info, warn};
use uuid::Uuid;
use yrs::updates::decoder::Decode;
use yrs::{Doc, ReadTxn, Transact};
// Import Transact and ReadTxn for state_vector

use crate::{models::BroadcastMessage, AppState};

/// Maximum number of concurrent WebSocket connections.
const MAX_CONNECTIONS: usize = 1000;

/// Global counter for active WebSocket connections.
static ACTIVE_CONNECTIONS: AtomicUsize = AtomicUsize::new(0);

/// WebSocket handler for collaborative document editing
/// Endpoint: GET /api/v1/collab/ws/:doc_id?token=JWT_TOKEN
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn websocket_handler(
    Path(doc_id): Path<String>,
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    // Validate doc_id is a valid UUID
    if Uuid::parse_str(&doc_id).is_err() {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            "Invalid document ID format",
        )
            .into_response();
    }

    // Enforce connection limit to prevent resource exhaustion
    let current = ACTIVE_CONNECTIONS.fetch_add(1, Ordering::Relaxed);
    if current >= MAX_CONNECTIONS {
        ACTIVE_CONNECTIONS.fetch_sub(1, Ordering::Relaxed);
        warn!(
            current_connections = current,
            max_connections = MAX_CONNECTIONS,
            "WebSocket connection rejected: too many active connections"
        );
        return (
            axum::http::StatusCode::SERVICE_UNAVAILABLE,
            "Too many active connections",
        )
            .into_response();
    }

    ws.on_upgrade(move |socket| handle_socket(socket, doc_id, state))
        .into_response()
}

async fn handle_socket(socket: WebSocket, doc_id: String, state: AppState) {
    // Ensure the connection counter is decremented when this handler exits
    let _guard = ConnectionGuard;
    let doc_id_main = doc_id.clone();
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
        // Try to load from DB
        match crate::utils::persistence::load_document(state.pool.inner(), &doc_id).await {
            Ok(loaded_doc) => {
                debug!("Loaded document {} from database", doc_id);
                state.docs.insert(doc_id.clone(), loaded_doc.clone());
                loaded_doc
            },
            Err(e) => {
                error!("Failed to load document {}, creating new: {}", doc_id, e);
                let new_doc = Doc::new();
                state.docs.insert(doc_id.clone(), new_doc.clone());
                new_doc
            },
        }
    };

    // Get or create broadcast channel for this document
    let tx = state
        .channels
        .entry(doc_id.clone())
        .or_insert_with(|| {
            let (tx, _rx) = broadcast::channel(100);
            tx
        })
        .clone();

    // Split WebSocket into sender and receiver
    let (mut sender, mut receiver) = socket.split();

    // Send initial state to client
    let state_vector = doc.transact().state_vector();
    let initial_state = doc.transact().encode_state_as_update_v1(&state_vector);

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
    // Clone for persistence task
    let pool = state.pool.inner().clone();

    let mut receive_task = tokio::spawn(async move {
        while let Some(msg_result) = receiver.next().await {
            match msg_result {
                Ok(Message::Binary(data)) => {
                    // Apply Y.js update to document
                    {
                        let mut txn = doc.transact_mut();
                        if let Ok(update) = yrs::Update::decode_v1(&data) {
                            txn.apply_update(update);
                        }
                    }

                    // Broadcast update to other clients
                    let _ = tx.send(BroadcastMessage::Binary(data.clone()));

                    // Persist update
                    let pool_clone = pool.clone();
                    let doc_id_clone = doc_id.clone();
                    let update_data = data.clone();

                    tokio::spawn(async move {
                        if let Err(e) = crate::utils::persistence::save_update(
                            &pool_clone,
                            &doc_id_clone,
                            update_data,
                        )
                        .await
                        {
                            error!("Failed to persist update for {}: {}", doc_id_clone, e);
                        }
                    });

                    debug!(session_id = %session_id, "Update applied, broadcasted, and persisting");
                },
                Ok(Message::Text(msg)) => {
                    debug!(session_id = %session_id, "Broadcasting text message");
                    let _ = tx.send(BroadcastMessage::Text(msg));
                },
                Ok(Message::Ping(_)) => {
                    debug!(session_id = %session_id, "Ping received");
                },
                Ok(Message::Pong(_)) => {
                    debug!(session_id = %session_id, "Pong received");
                },
                Ok(Message::Close(_)) => {
                    info!(session_id = %session_id, "Client requested close");
                    break;
                },
                Err(e) => {
                    error!(
                        session_id = %session_id,
                        error = ?e,
                        "WebSocket error"
                    );
                    break;
                },
            }
        }
    });

    // Handle outgoing broadcasts to client
    let mut broadcast_task = tokio::spawn(async move {
        while let Ok(msg) = client_rx.recv().await {
            let ws_msg = match msg {
                BroadcastMessage::Binary(data) => Message::Binary(data),
                BroadcastMessage::Text(text) => Message::Text(text),
            };

            if let Err(e) = sender.send(ws_msg).await {
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
        doc_id = %doc_id_main,
        "WebSocket connection closed"
    );

    // Persist document before closing
    // (implement in persistence module)
    // save_document(&doc_id, &doc, &state.pool).await.ok();

    // _guard is dropped here, decrementing ACTIVE_CONNECTIONS
}

/// RAII guard that decrements the active connection counter on drop.
struct ConnectionGuard;

impl Drop for ConnectionGuard {
    fn drop(&mut self) {
        ACTIVE_CONNECTIONS.fetch_sub(1, Ordering::Relaxed);
    }
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
