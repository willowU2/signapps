use axum::{
    extract::ws::{Message, WebSocket},
    extract::{Path, State, WebSocketUpgrade},
    http::StatusCode,
    Json,
};
use futures::{sink::SinkExt, stream::StreamExt};
use uuid::Uuid;

use crate::models::{CreateConnectionRequest, RemoteConnection};
use crate::AppState;

pub async fn list_connections(
    State(state): State<AppState>,
) -> Result<Json<Vec<RemoteConnection>>, (StatusCode, String)> {
    let connections = sqlx::query_as::<_, RemoteConnection>(
        r#"
        SELECT id, hardware_id, name, protocol, hostname, port, username, password_encrypted, private_key_encrypted, parameters, created_at, updated_at
        FROM remote.connections
        ORDER BY name ASC
        "#
    )
    .fetch_all(state.db.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch remote connections: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())
    })?;

    Ok(Json(connections))
}

pub async fn create_connection(
    State(state): State<AppState>,
    Json(payload): Json<CreateConnectionRequest>,
) -> Result<(StatusCode, Json<RemoteConnection>), (StatusCode, String)> {
    // In a real production system, the password must be symmetrically encrypted using a secure KMS
    // prior to resting in the Postgres DB to maintain compliance.
    let connection = sqlx::query_as::<_, RemoteConnection>(
        r#"
        INSERT INTO remote.connections (hardware_id, name, protocol, hostname, port, username, password_encrypted, private_key_encrypted, parameters)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, hardware_id, name, protocol, hostname, port, username, password_encrypted, private_key_encrypted, parameters, created_at, updated_at
        "#
    )
    .bind(&payload.hardware_id)
    .bind(&payload.name)
    .bind(&payload.protocol)
    .bind(&payload.hostname)
    .bind(payload.port)
    .bind(&payload.username)
    .bind(&payload.password)
    .bind(&payload.private_key)
    .bind(payload.parameters.unwrap_or_else(|| serde_json::json!({})))
    .fetch_one(state.db.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to save connection: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())
    })?;

    Ok((StatusCode::CREATED, Json(connection)))
}

pub async fn connection_gateway_ws(
    ws: WebSocketUpgrade,
    Path(connection_id): Path<Uuid>,
    State(state): State<AppState>,
) -> axum::response::Response {
    ws.on_upgrade(move |socket| handle_guacamole_socket(socket, connection_id, state))
}

async fn handle_guacamole_socket(mut socket: WebSocket, connection_id: Uuid, state: AppState) {
    tracing::info!(
        "Upgraded unified WebSocket for Remote Connection: {}",
        connection_id
    );

    // 1. Fetch credentials from DB
    let conn_record = match sqlx::query_as::<_, RemoteConnection>(
        r#"SELECT id, hardware_id, name, protocol, hostname, port, username, password_encrypted, private_key_encrypted, parameters, created_at, updated_at
           FROM remote.connections WHERE id = $1"#
    )
    .bind(connection_id)
    .fetch_one(state.db.inner())
    .await {
        Ok(c) => c,
        Err(_) => {
            let _ = socket.send(Message::Text("4.error,404.Connection not found;".to_string())).await;
            return;
        }
    };

    // TODO: Connect to guacd using tokio::net::TcpStream::connect("guacd:4822").
    // Perform the Guacamole Handshake `select, protocol`, send `size` and `audio` formats,
    // and pipe the TCP frame stream bi-directionally to the WebSocket.

    // Connection sequence to the frontend Canvas viewer:
    let _ = socket
        .send(Message::Text("4.size,1.0,4.1024,3.768;".to_string()))
        .await;
    let _ = socket
        .send(Message::Text(format!("5.ready,{}.;", conn_record.protocol)))
        .await;

    while let Some(Ok(msg)) = socket.next().await {
        if let Message::Text(text) = msg {
            tracing::debug!("Received browser GUAC instruction: {}", text);
            // Echo back an ACK or basic sync token to keep the canvas alive
            if text.starts_with("4.sync") {
                let _ = socket.send(Message::Text(text)).await;
            }
        }
    }

    tracing::info!("Remote connection {} cleanly terminated.", connection_id);
}
