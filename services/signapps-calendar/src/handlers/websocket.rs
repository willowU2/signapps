//! Real-time calendar collaboration via WebSocket
//! Implements Yrs CRDT-based document sync for multi-user editing

use axum::{
    extract::{ws::{WebSocket, WebSocketUpgrade, Message}, Path, State},
    response::IntoResponse,
};
use futures::{stream::StreamExt, SinkExt};
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{debug, error, info};
use uuid::Uuid;
use yrs::Doc;

use crate::AppState;

/// Calendar document session metadata
#[derive(Debug, Clone)]
pub struct CalendarSession {
    pub id: Uuid,
    pub calendar_id: Uuid,
    pub user_id: Uuid,
    pub tx: broadcast::Sender<Vec<u8>>,
}

/// WebSocket handler for calendar real-time collaboration
/// Endpoint: GET /api/v1/calendars/:calendar_id/ws
pub async fn websocket_handler(
    Path(calendar_id): Path<Uuid>,
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| {
        handle_socket(socket, calendar_id, state)
    })
    .into_response()
}

/// Handle individual WebSocket connection
async fn handle_socket(
    socket: WebSocket,
    calendar_id: Uuid,
    state: AppState,
) {
    let session_id = Uuid::new_v4();

    // For now, use Uuid::nil as system user (should be from JWT auth in production)
    let user_id = Uuid::nil();

    info!(
        session_id = %session_id,
        calendar_id = %calendar_id,
        user_id = %user_id,
        "New calendar WebSocket connection"
    );

    // Get or create Yrs document for this calendar
    let cache_key = format!("calendar::{}", calendar_id);

    let _doc = if let Some(entry) = state.calendar_docs.get(&cache_key) {
        entry.clone()
    } else {
        let new_doc = Arc::new(Doc::new());
        state.calendar_docs.insert(cache_key.clone(), new_doc.clone());
        info!(calendar_id = %calendar_id, "Created new Yrs document");
        new_doc
    };

    // Get or create broadcast channel for this calendar
    let tx = if let Some(entry) = state.calendar_broadcasts.get(&cache_key) {
        entry.clone()
    } else {
        let (tx, _rx) = broadcast::channel(100);
        state.calendar_broadcasts.insert(cache_key.clone(), tx.clone());
        info!(calendar_id = %calendar_id, "Created new broadcast channel");
        tx
    };

    // Split WebSocket into sender and receiver
    let (mut sender, mut receiver) = socket.split();

    // Create session
    let _session = CalendarSession {
        id: session_id,
        calendar_id,
        user_id,
        tx: tx.clone(),
    };

    info!(
        session_id = %session_id,
        calendar_id = %calendar_id,
        "Calendar WebSocket ready for messages"
    );

    // Handle incoming messages from client
    let mut client_rx = tx.subscribe();
    let calendar_id_log = calendar_id;
    let session_id_log = session_id;

    let mut receive_task = tokio::spawn(async move {
        while let Some(msg_result) = receiver.next().await {
            match msg_result {
                Ok(Message::Binary(data)) => {
                    debug!(
                        session_id = %session_id_log,
                        calendar_id = %calendar_id_log,
                        bytes = data.len(),
                        "Received Yrs update"
                    );

                    // Broadcast update to all connected clients
                    if let Err(e) = tx.send(data) {
                        debug!(
                            session_id = %session_id_log,
                            error = %e,
                            "Failed to broadcast update (no receivers)"
                        );
                    }
                }
                Ok(Message::Text(msg)) => {
                    debug!(
                        session_id = %session_id_log,
                        message = %msg,
                        "Text message received"
                    );
                }
                Ok(Message::Ping(_)) => {
                    debug!(session_id = %session_id_log, "Ping received");
                }
                Ok(Message::Pong(_)) => {
                    debug!(session_id = %session_id_log, "Pong received");
                }
                Ok(Message::Close(_)) => {
                    info!(
                        session_id = %session_id_log,
                        calendar_id = %calendar_id_log,
                        "Client requested close"
                    );
                    break;
                }
                Err(e) => {
                    error!(
                        session_id = %session_id_log,
                        error = ?e,
                        "WebSocket error"
                    );
                    break;
                }
            }
        }
    });

    // Handle outgoing broadcasts to client
    let session_id_bc = session_id;
    let calendar_id_bc = calendar_id;

    let mut broadcast_task = tokio::spawn(async move {
        while let Ok(data) = client_rx.recv().await {
            match sender.send(Message::Binary(data)).await {
                Ok(_) => {
                    debug!(
                        session_id = %session_id_bc,
                        "Update sent to client"
                    );
                }
                Err(e) => {
                    error!(
                        session_id = %session_id_bc,
                        calendar_id = %calendar_id_bc,
                        error = ?e,
                        "Failed to send update to client"
                    );
                    break;
                }
            }
        }
    });

    // Wait for either task to complete
    tokio::select! {
        _ = (&mut receive_task) => {
            broadcast_task.abort();
            debug!(
                session_id = %session_id,
                "Receive task ended"
            );
        }
        _ = (&mut broadcast_task) => {
            receive_task.abort();
            debug!(
                session_id = %session_id,
                "Broadcast task ended"
            );
        }
    }

    info!(
        session_id = %session_id,
        calendar_id = %calendar_id,
        "WebSocket connection closed"
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_id_unique() {
        let session1 = Uuid::new_v4();
        let session2 = Uuid::new_v4();
        assert_ne!(session1, session2);
    }

    #[test]
    fn test_cache_key_format() {
        let calendar_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
        let key = format!("calendar::{}", calendar_id);
        assert!(key.starts_with("calendar::"));
        assert!(key.contains("550e8400"));
    }
}
