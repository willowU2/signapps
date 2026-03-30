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
use yrs::{updates::decoder::Decode, Doc, ReadTxn, Transact};

use crate::{handlers::persistence, AppState};

/// Maximum number of concurrent WebSocket connections.
const MAX_CONNECTIONS: usize = 1000;

/// Global counter for active WebSocket connections.
static ACTIVE_CONNECTIONS: AtomicUsize = AtomicUsize::new(0);

/// Generic WebSocket handler for all document types
/// Endpoint: GET /api/v1/docs/{type}/{doc_id}/ws
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/websocket/{id}",
    responses((status = 200, description = "Success")),
    tag = "Docs"
)]
#[tracing::instrument(skip_all)]
pub async fn websocket_handler(
    Path((doc_type, doc_id)): Path<(String, String)>,
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    // Accept both UUIDs and arbitrary room names (e.g. "default-sheet")
    // y-websocket clients may use non-UUID identifiers for local rooms

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

    ws.on_upgrade(move |socket| handle_socket(socket, doc_id, doc_type, state))
        .into_response()
}

async fn handle_socket(socket: WebSocket, doc_id: String, doc_type: String, state: AppState) {
    // Ensure the connection counter is decremented when this handler exits
    let _guard = ConnectionGuard;
    let session_id = Uuid::new_v4();

    info!(
        session_id = %session_id,
        doc_id = %doc_id,
        doc_type = %doc_type,
        "New WebSocket connection"
    );

    // Use composite key: type::doc_id
    let cache_key = format!("{}::{}", doc_type, doc_id);

    // Get or create document
    // First check memory
    let doc = if let Some(entry) = state.docs.get(&cache_key) {
        entry.clone()
    } else {
        // Try loading from DB
        let loaded_doc = match persistence::load_document(state.pool.inner(), &doc_id).await {
            Ok(Some(d)) => {
                info!(doc_id = %doc_id, "Loaded document from database");
                Some(d)
            },
            Ok(None) => None,
            Err(e) => {
                error!(doc_id = %doc_id, error = %e, "Failed to load document");
                None
            },
        };

        let new_doc = loaded_doc.unwrap_or_else(Doc::new);
        state.docs.insert(cache_key.clone(), new_doc.clone());
        new_doc
    };

    // Get or create broadcast channel for this document
    let tx = if let Some(entry) = state.broadcasts.get(&cache_key) {
        entry.clone()
    } else {
        let (tx, _rx) = broadcast::channel(100);
        state.broadcasts.insert(cache_key.clone(), tx.clone());
        tx
    };

    // Split WebSocket into sender and receiver
    let (mut sender, mut receiver) = socket.split();

    // Send initial state to client
    // We encode the whole document state as an update and send it
    let initial_state = doc
        .transact()
        .encode_state_as_update_v1(&yrs::StateVector::default());
    if let Err(e) = sender.send(Message::Binary(initial_state)).await {
        error!(session_id = %session_id, error = %e, "Failed to send initial state");
        return;
    }

    info!(session_id = %session_id, "Sent initial document state");

    // Handle incoming messages from client
    let mut client_rx = tx.subscribe();

    // We need to clone doc and state for the receive task
    let doc_clone = doc.clone();
    let state_clone = state.clone();
    let doc_id_clone = doc_id.clone();
    let doc_type_clone = doc_type.clone();

    let mut receive_task = tokio::spawn(async move {
        while let Some(msg_result) = receiver.next().await {
            match msg_result {
                Ok(Message::Binary(data)) => {
                    // Apply update to local Yjs document
                    {
                        let mut txn = doc_clone.transact_mut();
                        match yrs::Update::decode_v1(&data) {
                            Ok(update) => {
                                txn.apply_update(update);
                            },
                            Err(e) => {
                                error!(session_id = %session_id, error = %e, "Failed to decode update");
                                continue;
                            },
                        }
                    }

                    // Broker to other clients
                    let _ = tx.send(data.clone());

                    // Persist to DB (fire and forget / async)
                    // In a real app, you might batch this or use the audit trail
                    let pool = state_clone.pool.clone();
                    let d_id = doc_id_clone.clone();
                    let d_type = doc_type_clone.clone();
                    let d_ref = doc_clone.clone();

                    tokio::spawn(async move {
                        // Save snapshot
                        if let Err(e) =
                            persistence::save_document(pool.inner(), &d_id, &d_type, &d_ref).await
                        {
                            error!(doc_id = %d_id, error = %e, "Failed to persist document");
                        }
                    });

                    // Log update
                    // persistence::log_update(state_clone.pool.inner(), &doc_id_clone, &data).await.ok();

                    debug!(session_id = %session_id, "Update processed and broadcasted");
                },
                Ok(Message::Text(msg)) => {
                    debug!(session_id = %session_id, message = %msg, "Text message received");
                },
                Ok(Message::Ping(_)) => {
                    // debug!(session_id = %session_id, "Ping received");
                },
                Ok(Message::Pong(_)) => {
                    // debug!(session_id = %session_id, "Pong received");
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
        while let Ok(data) = client_rx.recv().await {
            // Prevent echoing back to sender?
            // Broadcaster sends to ALL. We should probably filter if possible,
            // but for now simple broadcast is fine as Yjs handles duplicate updates gracefully.
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
