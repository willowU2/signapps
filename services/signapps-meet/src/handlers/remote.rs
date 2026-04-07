//! Remote desktop connection handlers (absorbed from signapps-remote).
//!
//! Provides CRUD for saved remote connections and a WebSocket gateway that
//! bridges browser clients to guacd (Apache Guacamole daemon) via the
//! Guacamole protocol.

use axum::{
    extract::ws::{Message, WebSocket},
    extract::{Path, State, WebSocketUpgrade},
    http::StatusCode,
    Json,
};
use futures::stream::StreamExt;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use uuid::Uuid;

use crate::models::remote::{CreateConnectionRequest, RemoteConnection, UpdateConnectionRequest};
use crate::AppState;

#[utoipa::path(
    get,
    path = "/api/v1/remote/connections",
    responses(
        (status = 200, description = "List of remote connections", body = Vec<crate::models::remote::RemoteConnection>),
        (status = 500, description = "Database error"),
    ),
    security(("bearerAuth" = [])),
    tag = "remote-connections"
)]
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
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch remote connections: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())
    })?;

    Ok(Json(connections))
}

#[utoipa::path(
    post,
    path = "/api/v1/remote/connections",
    request_body = crate::models::remote::CreateConnectionRequest,
    responses(
        (status = 201, description = "Connection created", body = crate::models::remote::RemoteConnection),
        (status = 500, description = "Database error"),
    ),
    security(("bearerAuth" = [])),
    tag = "remote-connections"
)]
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
    .bind(payload.hardware_id)
    .bind(&payload.name)
    .bind(&payload.protocol)
    .bind(&payload.hostname)
    .bind(payload.port)
    .bind(&payload.username)
    .bind(&payload.password)
    .bind(&payload.private_key)
    .bind(payload.parameters.unwrap_or_else(|| serde_json::json!({})))
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to save connection: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())
    })?;

    Ok((StatusCode::CREATED, Json(connection)))
}

#[utoipa::path(
    get,
    path = "/api/v1/remote/connections/{id}",
    params(("id" = Uuid, Path, description = "Connection UUID")),
    responses(
        (status = 200, description = "Remote connection found", body = crate::models::remote::RemoteConnection),
        (status = 404, description = "Connection not found"),
        (status = 500, description = "Database error"),
    ),
    security(("bearerAuth" = [])),
    tag = "remote-connections"
)]
pub async fn get_connection(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<RemoteConnection>, (StatusCode, String)> {
    let connection = sqlx::query_as::<_, RemoteConnection>(
        r#"
        SELECT id, hardware_id, name, protocol, hostname, port, username, password_encrypted, private_key_encrypted, parameters, created_at, updated_at
        FROM remote.connections
        WHERE id = $1
        "#
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch connection: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())
    })?
    .ok_or((StatusCode::NOT_FOUND, "Connection not found".to_string()))?;

    Ok(Json(connection))
}

#[utoipa::path(
    put,
    path = "/api/v1/remote/connections/{id}",
    params(("id" = Uuid, Path, description = "Connection UUID")),
    request_body = crate::models::remote::UpdateConnectionRequest,
    responses(
        (status = 200, description = "Connection updated", body = crate::models::remote::RemoteConnection),
        (status = 404, description = "Connection not found"),
        (status = 500, description = "Database error"),
    ),
    security(("bearerAuth" = [])),
    tag = "remote-connections"
)]
pub async fn update_connection(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateConnectionRequest>,
) -> Result<Json<RemoteConnection>, (StatusCode, String)> {
    // First check if connection exists
    let _ = sqlx::query_as::<_, RemoteConnection>("SELECT * FROM remote.connections WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Connection not found".to_string()))?;

    let connection = sqlx::query_as::<_, RemoteConnection>(
        r#"
        UPDATE remote.connections SET
            name = COALESCE($1, name),
            protocol = COALESCE($2, protocol),
            hostname = COALESCE($3, hostname),
            port = COALESCE($4, port),
            username = COALESCE($5, username),
            password_encrypted = COALESCE($6, password_encrypted),
            private_key_encrypted = COALESCE($7, private_key_encrypted),
            parameters = COALESCE($8, parameters),
            updated_at = NOW()
        WHERE id = $9
        RETURNING id, hardware_id, name, protocol, hostname, port, username, password_encrypted, private_key_encrypted, parameters, created_at, updated_at
        "#
    )
    .bind(&payload.name)
    .bind(&payload.protocol)
    .bind(&payload.hostname)
    .bind(payload.port)
    .bind(&payload.username)
    .bind(&payload.password)
    .bind(&payload.private_key)
    .bind(&payload.parameters)
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update connection: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())
    })?;

    Ok(Json(connection))
}

#[utoipa::path(
    delete,
    path = "/api/v1/remote/connections/{id}",
    params(("id" = Uuid, Path, description = "Connection UUID")),
    responses(
        (status = 204, description = "Connection deleted"),
        (status = 404, description = "Connection not found"),
        (status = 500, description = "Database error"),
    ),
    security(("bearerAuth" = [])),
    tag = "remote-connections"
)]
pub async fn delete_connection(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    // TODO: add created_by column to remote.connections for user isolation
    let result = sqlx::query("DELETE FROM remote.connections WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete connection: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Database error".to_string(),
            )
        })?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Connection not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/api/v1/remote/ws/{id}",
    params(("id" = Uuid, Path, description = "Connection UUID")),
    responses(
        (status = 101, description = "WebSocket upgrade — Guacamole protocol tunnel"),
        (status = 404, description = "Connection not found"),
    ),
    security(("bearerAuth" = [])),
    tag = "remote-connections"
)]
pub async fn connection_gateway_ws(
    ws: WebSocketUpgrade,
    Path(connection_id): Path<Uuid>,
    State(state): State<AppState>,
) -> axum::response::Response {
    ws.on_upgrade(move |socket| handle_guacamole_socket(socket, connection_id, state))
}

async fn handle_guacamole_socket(mut socket: WebSocket, connection_id: Uuid, state: AppState) {
    tracing::info!(
        "Upgraded WebSocket for Remote Connection: {}",
        connection_id
    );

    // 1. Fetch credentials from DB
    let conn_record = match sqlx::query_as::<_, RemoteConnection>(
        r#"SELECT id, hardware_id, name, protocol, hostname, port, username, password_encrypted,
                  private_key_encrypted, parameters, created_at, updated_at
           FROM remote.connections WHERE id = $1"#,
    )
    .bind(connection_id)
    .fetch_one(&state.pool)
    .await
    {
        Ok(c) => c,
        Err(_) => {
            let _ = socket
                .send(Message::Text(
                    "4.error,404.Connection not found;".to_string(),
                ))
                .await;
            return;
        },
    };

    // 2. Resolve guacd address (configurable via env, default localhost:4822)
    let guacd_host = std::env::var("GUACD_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let guacd_port: u16 = std::env::var("GUACD_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(4822);

    let guacd_addr = format!("{}:{}", guacd_host, guacd_port);

    // 3. Open TCP connection to guacd
    let tcp_stream = match tokio::net::TcpStream::connect(&guacd_addr).await {
        Ok(s) => s,
        Err(e) => {
            tracing::error!("Failed to connect to guacd at {}: {}", guacd_addr, e);
            let _ = socket
                .send(Message::Text("5.error,14.guacd unreachable;".to_string()))
                .await;
            return;
        },
    };

    tracing::info!("Connected to guacd at {}", guacd_addr);

    // 4. Perform Guacamole handshake:
    //    → select <protocol>
    //    ← args
    //    → size, audio, video, image, connect
    let protocol = conn_record.protocol.to_lowercase();
    let select_instr = format!("6.select,{}.{};", protocol.len(), protocol);

    let (mut guacd_read, mut guacd_write) = tcp_stream.into_split();

    // Send select
    if let Err(e) = guacd_write.write_all(select_instr.as_bytes()).await {
        tracing::error!("Failed to send select to guacd: {}", e);
        return;
    }

    // Read args response from guacd
    let mut args_buf = vec![0u8; 4096];
    let n = match guacd_read.read(&mut args_buf).await {
        Ok(n) if n > 0 => n,
        _ => {
            tracing::error!("guacd did not return args");
            return;
        },
    };
    let args_msg = String::from_utf8_lossy(&args_buf[..n]).to_string();
    tracing::debug!("guacd args: {}", args_msg);

    // Build connect instruction with credentials
    let hostname = &conn_record.hostname;
    let port = if conn_record.port > 0 {
        conn_record.port
    } else if protocol == "rdp" {
        3389
    } else {
        5900
    };
    let username = conn_record.username.as_deref().unwrap_or("");
    let password = conn_record.password_encrypted.as_deref().unwrap_or("");

    // Build connection params: hostname, port, username, password (ignore-cert for RDP)
    let connect_parts: Vec<String> = vec![
        format!("{}.{}", hostname.len(), hostname),
        format!("{}.{}", port.to_string().len(), port),
        format!("{}.{}", username.len(), username),
        format!("{}.{}", password.len(), password),
    ];
    let connect_body = connect_parts.join(",");
    let connect_instr = format!("7.connect,{};", connect_body);

    // Send size, audio, video, image, connect
    let size_instr = "4.size,1.0,4.1024,3.768;";
    let audio_instr = "5.audio;";
    let video_instr = "5.video;";
    let image_instr = "5.image;";

    for instr in [
        size_instr,
        audio_instr,
        video_instr,
        image_instr,
        &connect_instr,
    ] {
        if let Err(e) = guacd_write.write_all(instr.as_bytes()).await {
            tracing::error!("Failed to send handshake instruction: {}", e);
            return;
        }
    }

    tracing::info!(
        "Guacamole handshake complete for connection {}",
        connection_id
    );

    // 5. Pipe data bidirectionally: browser WebSocket ↔ guacd TCP
    //    Use tokio::select! to handle both directions concurrently.
    loop {
        let mut guacd_buf = vec![0u8; 65536];
        tokio::select! {
            // Data from browser → guacd
            ws_msg = socket.next() => {
                match ws_msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Err(e) = guacd_write.write_all(text.as_bytes()).await {
                            tracing::debug!("Write to guacd failed (connection closed?): {}", e);
                            break;
                        }
                    },
                    Some(Ok(Message::Binary(data))) => {
                        if let Err(e) = guacd_write.write_all(&data).await {
                            tracing::debug!("Write to guacd failed: {}", e);
                            break;
                        }
                    },
                    Some(Ok(Message::Close(_))) | None => {
                        tracing::info!("Browser WebSocket closed for connection {}", connection_id);
                        break;
                    },
                    _ => {},
                }
            },
            // Data from guacd → browser
            guacd_result = guacd_read.read(&mut guacd_buf) => {
                match guacd_result {
                    Ok(0) => {
                        tracing::info!("guacd closed connection {}", connection_id);
                        break;
                    },
                    Ok(n) => {
                        let msg = String::from_utf8_lossy(&guacd_buf[..n]).to_string();
                        if let Err(e) = socket.send(Message::Text(msg)).await {
                            tracing::debug!("Send to browser failed: {}", e);
                            break;
                        }
                    },
                    Err(e) => {
                        tracing::debug!("guacd read error: {}", e);
                        break;
                    },
                }
            },
        }
    }

    tracing::info!("Remote connection {} terminated.", connection_id);
}
