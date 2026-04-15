//! Collab WebSocket alias handler.
//!
//! Originally `signapps-collab` (port 3013). The real-time collaborative editing
//! WebSocket endpoint has been absorbed into `signapps-docs` (port 3010).
//!
//! Old URL: `ws://localhost:3013/api/v1/collab/ws/:doc_id`
//! New URL: `ws://localhost:3010/api/v1/collab/ws/:doc_id`
//!
//! The route delegates to the existing docs WebSocket handler with a fixed
//! `doc_type` of `"collab"` so the in-memory key is `"collab::<doc_id>"`.

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

/// Maximum number of concurrent collab WebSocket connections.
const MAX_CONNECTIONS: usize = 1000;

/// Global counter for active collab WebSocket connections.
static ACTIVE_CONNECTIONS: AtomicUsize = AtomicUsize::new(0);

/// WebSocket handler for Y.js CRDT collaborative editing (legacy collab endpoint).
///
/// Clients connect to `/api/v1/collab/ws/:doc_id` to collaboratively edit a document.
/// Previously served from `signapps-collab` on port 3013; now on port 3010.
///
/// # Errors
///
/// Returns `503 Service Unavailable` if the connection limit is reached.
#[utoipa::path(
    get,
    path = "/api/v1/collab/ws/{doc_id}",
    params(
        ("doc_id" = String, Path, description = "Document UUID to collaborate on")
    ),
    responses(
        (status = 101, description = "WebSocket upgrade — Y.js CRDT collaborative editing"),
        (status = 401, description = "Unauthorized"),
        (status = 503, description = "Too many active connections"),
    ),
    security(("bearer" = [])),
    tag = "Collab"
)]
#[tracing::instrument(skip_all)]
pub async fn collab_websocket_handler(
    Path(doc_id): Path<String>,
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let current = ACTIVE_CONNECTIONS.fetch_add(1, Ordering::Relaxed);
    if current >= MAX_CONNECTIONS {
        ACTIVE_CONNECTIONS.fetch_sub(1, Ordering::Relaxed);
        warn!(
            current_connections = current,
            max_connections = MAX_CONNECTIONS,
            "Collab WebSocket connection rejected: too many active connections"
        );
        return (
            axum::http::StatusCode::SERVICE_UNAVAILABLE,
            "Too many active connections",
        )
            .into_response();
    }

    ws.on_upgrade(move |socket| handle_collab_socket(socket, doc_id, state))
        .into_response()
}

async fn handle_collab_socket(socket: WebSocket, doc_id: String, state: AppState) {
    let _guard = CollabConnectionGuard;
    let session_id = Uuid::new_v4();
    // Use "collab" as the doc_type so the cache key is unique from other doc types.
    let doc_type = "collab";
    let cache_key = format!("{}::{}", doc_type, doc_id);

    info!(
        session_id = %session_id,
        doc_id = %doc_id,
        "New collab WebSocket connection"
    );

    // Get or create document in memory
    let doc = if let Some(entry) = state.docs.get(&cache_key) {
        entry.clone()
    } else {
        let loaded_doc =
            match persistence::load_document(state.pool.inner(), &doc_id, None, None).await {
                Ok(Some(d)) => {
                    info!(doc_id = %doc_id, "Loaded collab document from database");
                    Some(d)
                },
                Ok(None) => None,
                Err(e) => {
                    error!(doc_id = %doc_id, error = %e, "Failed to load collab document");
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

    let (mut sender, mut receiver) = socket.split();

    // Send initial state to client
    let initial_state = doc
        .transact()
        .encode_state_as_update_v1(&yrs::StateVector::default());
    if let Err(e) = sender.send(Message::Binary(initial_state)).await {
        error!(session_id = %session_id, error = %e, "Failed to send collab initial state");
        return;
    }
    info!(session_id = %session_id, "Sent collab initial document state");

    let mut client_rx = tx.subscribe();
    let doc_clone = doc.clone();
    let state_clone = state.clone();
    let doc_id_clone = doc_id.clone();

    let mut receive_task = tokio::spawn(async move {
        while let Some(msg_result) = receiver.next().await {
            match msg_result {
                Ok(Message::Binary(data)) => {
                    {
                        let mut txn = doc_clone.transact_mut();
                        match yrs::Update::decode_v1(&data) {
                            Ok(update) => {
                                txn.apply_update(update);
                            },
                            Err(e) => {
                                error!(session_id = %session_id, error = %e, "Failed to decode collab update");
                                continue;
                            },
                        }
                    }

                    let _ = tx.send(data.clone());

                    let pool = state_clone.pool.clone();
                    let d_id = doc_id_clone.clone();
                    let d_ref = doc_clone.clone();

                    tokio::spawn(async move {
                        if let Err(e) = persistence::save_document(
                            pool.inner(),
                            &d_id,
                            doc_type,
                            &d_ref,
                            None,
                            None,
                        )
                        .await
                        {
                            error!(doc_id = %d_id, error = %e, "Failed to persist collab document");
                        }
                    });

                    debug!(session_id = %session_id, "Collab update processed and broadcast");
                },
                Ok(Message::Close(_)) => {
                    info!(session_id = %session_id, "Collab client requested close");
                    break;
                },
                Ok(_) => {},
                Err(e) => {
                    error!(session_id = %session_id, error = ?e, "Collab WebSocket error");
                    break;
                },
            }
        }
    });

    let mut broadcast_task = tokio::spawn(async move {
        while let Ok(data) = client_rx.recv().await {
            if let Err(e) = sender.send(Message::Binary(data)).await {
                error!(session_id = %session_id, error = ?e, "Failed to send collab broadcast");
                break;
            }
        }
    });

    tokio::select! {
        _ = (&mut receive_task) => { broadcast_task.abort(); }
        _ = (&mut broadcast_task) => { receive_task.abort(); }
    }

    info!(session_id = %session_id, doc_id = %doc_id, "Collab WebSocket connection closed");
}

/// RAII guard that decrements the active connection counter on drop.
struct CollabConnectionGuard;

impl Drop for CollabConnectionGuard {
    fn drop(&mut self) {
        ACTIVE_CONNECTIONS.fetch_sub(1, Ordering::Relaxed);
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }
}
