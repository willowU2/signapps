//! `GET /events` — WebSocket streaming of deployment lifecycle events.
//!
//! ## Wire-up
//!
//! Each connection spawns a dedicated [`sqlx::postgres::PgListener`] that
//! listens on the PostgreSQL `deployment_events` channel. The channel is
//! populated by the `notify_deployment_event` trigger installed by migration
//! `308_deployment_events_notify.sql`, which fires on every INSERT into
//! `deployment_audit_log`. No orchestrator-side change is required — every
//! `persistence::audit(...)` call is automatically reflected on the socket.
//!
//! ## Frame format
//!
//! All frames are JSON text of shape:
//!
//! ```json
//! { "channel": "deployment.<action>", "payload": { ... } }
//! ```
//!
//! The first frame emitted after the upgrade is
//! `{ "channel": "deploy.connected", "payload": { "version": "<crate>" } }`.
//! A WebSocket ping is sent every 30s to keep intermediaries from idling
//! the connection.

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
use sqlx::postgres::PgListener;
use std::time::Duration;
use tokio::time::interval;

const KEEPALIVE_INTERVAL: Duration = Duration::from_secs(30);
const NOTIFY_CHANNEL: &str = "deployment_events";

/// JSON envelope sent to WebSocket clients.
#[derive(Serialize)]
struct Frame {
    channel: String,
    payload: serde_json::Value,
}

#[tracing::instrument(skip(ws, state))]
async fn events_ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: AppState) {
    tracing::info!("events websocket opened");

    // Startup frame so clients have something to display immediately.
    let startup = Frame {
        channel: "deploy.connected".into(),
        payload: serde_json::json!({ "version": env!("CARGO_PKG_VERSION") }),
    };
    if let Ok(txt) = serde_json::to_string(&startup) {
        if socket.send(Message::Text(txt)).await.is_err() {
            return;
        }
    }

    // Connect a dedicated PgListener for this WS client. A failure here is
    // not fatal for the UI — the socket degrades to keepalive-only so the
    // operator still sees the connected indicator.
    let mut listener = match PgListener::connect_with(&state.pool).await {
        Ok(l) => Some(l),
        Err(e) => {
            tracing::error!(error = %e, "failed to connect PgListener; events disabled for this socket");
            None
        },
    };
    if let Some(l) = listener.as_mut() {
        if let Err(e) = l.listen(NOTIFY_CHANNEL).await {
            tracing::error!(error = %e, channel = NOTIFY_CHANNEL, "PgListener LISTEN failed");
            listener = None;
        }
    }

    let mut keepalive = interval(KEEPALIVE_INTERVAL);

    loop {
        // Two run modes: with an active listener or without. We keep the loop
        // shape identical by building a future that resolves to `None` when
        // there is no listener.
        tokio::select! {
            _ = keepalive.tick() => {
                if socket.send(Message::Ping(Vec::new())).await.is_err() {
                    break;
                }
            }
            maybe_notification = async {
                match listener.as_mut() {
                    Some(l) => Some(l.recv().await),
                    None    => std::future::pending().await,
                }
            } => {
                match maybe_notification {
                    Some(Ok(notif)) => {
                        let payload_str = notif.payload();
                        let parsed: serde_json::Value = serde_json::from_str(payload_str)
                            .unwrap_or_else(|_| serde_json::Value::String(payload_str.to_string()));

                        let action = parsed
                            .get("action")
                            .and_then(|a| a.as_str())
                            .unwrap_or("unknown");

                        let frame = Frame {
                            channel: format!("deployment.{action}"),
                            payload: parsed,
                        };
                        if let Ok(txt) = serde_json::to_string(&frame) {
                            if socket.send(Message::Text(txt)).await.is_err() {
                                break;
                            }
                        }
                    }
                    Some(Err(e)) => {
                        tracing::error!(error = %e, "PgListener recv error; dropping listener for this socket");
                        listener = None;
                    }
                    None => {
                        // Unreachable — future::pending never resolves.
                    }
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
