//! Remote access WebSocket relay.
//!
//! Architecture:
//! - Agent connects to `/agent/:id/remote-ws` and holds a persistent WS channel.
//! - Admin calls `POST /:hw_id/remote-session/start` — server forwards `start_session`
//!   to the agent's channel, then upgrades the admin HTTP connection to a WS proxy.
//! - Frames from agent are relayed to all active admin viewers via broadcast.
//! - Mouse/keyboard events from admins are forwarded to the agent.
//!
//! No VNC, no Guacamole — fully custom, JWT-authed, TLS-wrapped.

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use dashmap::DashMap;
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use signapps_db::DatabasePool;
use std::sync::Arc;
use tokio::sync::broadcast;
use uuid::Uuid;

// ─── AppState ─────────────────────────────────────────────────────────────────

/// Extended application state that holds the DB pool plus live agent WS channels.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    /// Map of agent_id → broadcast sender for commands directed to that agent.
    pub agent_channels: Arc<DashMap<Uuid, broadcast::Sender<String>>>,
    /// Map of agent_id → broadcast sender for frames coming from that agent.
    pub frame_channels: Arc<DashMap<Uuid, broadcast::Sender<String>>>,
    /// Map of agent_id → recording file path (when recording is enabled).
    pub recording_paths: Arc<DashMap<Uuid, std::path::PathBuf>>,
}

impl AppState {
    /// Create a new AppState wrapping the database pool.
    pub fn new(pool: DatabasePool) -> Self {
        Self {
            pool,
            agent_channels: Arc::new(DashMap::new()),
            frame_channels: Arc::new(DashMap::new()),
            recording_paths: Arc::new(DashMap::new()),
        }
    }
}

// ─── Request / Response types ─────────────────────────────────────────────────

/// Query parameters for the agent WebSocket endpoint.
#[derive(Debug, Deserialize)]
pub struct AgentWsQuery {
    pub token: Option<String>,
}

/// Request body for starting a remote session.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct StartSessionReq {
    pub mode: Option<String>,
    pub admin_name: Option<String>,
    /// When true, all frames are saved to a recording file.
    pub record: Option<bool>,
}

/// Response for session creation.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct SessionResp {
    pub session_id: Uuid,
    pub status: String,
    pub mode: String,
}

fn internal_err(e: impl std::fmt::Display) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
}

// ─── RM5: Agent persistent WebSocket channel ─────────────────────────────────
//
// GET /agent/:agent_id/remote-ws?token=JWT
//
// The agent connects here at startup and keeps the connection alive.
// The server uses this channel to push remote session commands.

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/agent/{agent_id}/remote-ws",
    params(
        ("agent_id" = uuid::Uuid, Path, description = "Agent UUID"),
        ("token" = String, Query, description = "JWT token"),
    ),
    responses(
        (status = 101, description = "WebSocket upgrade"),
        (status = 401, description = "Missing token"),
    ),
    security(("bearer" = [])),
    tag = "Remote"
)]
pub async fn agent_remote_ws(
    Path(agent_id): Path<Uuid>,
    Query(params): Query<AgentWsQuery>,
    State(state): State<AppState>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    // Basic token presence check (full JWT validation lives in gateway middleware)
    if params.token.as_deref().unwrap_or("").is_empty() {
        return (StatusCode::UNAUTHORIZED, "Missing token").into_response();
    }
    ws.on_upgrade(move |socket| handle_agent_ws(socket, agent_id, state))
}

async fn handle_agent_ws(socket: WebSocket, agent_id: Uuid, state: AppState) {
    tracing::info!("Agent {} connected to remote channel", agent_id);

    let (cmd_tx, mut cmd_rx) = broadcast::channel::<String>(64);
    let (frame_tx, _frame_rx) = broadcast::channel::<String>(256);

    state.agent_channels.insert(agent_id, cmd_tx);
    state.frame_channels.insert(agent_id, frame_tx.clone());

    let (mut ws_sink, mut ws_stream) = socket.split();

    // Forward commands from admins → agent
    let send_task = tokio::spawn(async move {
        while let Ok(msg) = cmd_rx.recv().await {
            if ws_sink.send(Message::Text(msg)).await.is_err() {
                break;
            }
        }
    });

    // Receive frames from agent → relay to admin viewers + optional recording
    while let Some(Ok(msg)) = ws_stream.next().await {
        match msg {
            Message::Text(text) => {
                tracing::debug!("Frame from agent {}: {} bytes", agent_id, text.len());
                let _ = frame_tx.send(text.to_string());

                // Feature 26: Append frame to recording file if active
                if let Some(rec_path) = state.recording_paths.get(&agent_id) {
                    use std::io::Write;
                    if let Ok(mut f) = std::fs::OpenOptions::new()
                        .create(true)
                        .append(true)
                        .open(rec_path.value())
                    {
                        let _ = writeln!(f, "{}", text);
                    }
                }
            },
            Message::Close(_) => {
                tracing::info!("Agent {} disconnected from remote channel", agent_id);
                break;
            },
            _ => {},
        }
    }

    send_task.abort();
    state.agent_channels.remove(&agent_id);
    state.frame_channels.remove(&agent_id);
    tracing::info!("Agent {} remote channel cleaned up", agent_id);
}

// ─── RM5: Admin viewer WebSocket ──────────────────────────────────────────────
//
// GET /:hw_id/remote-session
//
// Admin browser connects here. Receives frames from agent, sends input events.

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/hardware/{hw_id}/remote-session",
    params(("hw_id" = uuid::Uuid, Path, description = "Hardware UUID")),
    responses(
        (status = 101, description = "WebSocket upgrade"),
    ),
    security(("bearer" = [])),
    tag = "Remote"
)]
pub async fn admin_remote_viewer(
    Path(hw_id): Path<Uuid>,
    State(state): State<AppState>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_admin_viewer(socket, hw_id, state))
}

async fn handle_admin_viewer(socket: WebSocket, hw_id: Uuid, state: AppState) {
    // Resolve hardware → agent_id
    let agent_id = match resolve_agent_id(hw_id, &state.pool).await {
        Some(id) => id,
        None => {
            tracing::warn!("Admin viewer: no agent found for hardware {}", hw_id);
            return;
        },
    };

    tracing::info!(
        "Admin viewer connected for hardware {} (agent {})",
        hw_id,
        agent_id
    );

    // Subscribe to frame stream from this agent
    let mut frame_rx = match state.frame_channels.get(&agent_id) {
        Some(sender) => sender.subscribe(),
        None => {
            tracing::warn!("Agent {} not connected — no frame channel", agent_id);
            return;
        },
    };

    let (mut ws_sink, mut ws_stream) = socket.split();

    // Forward frames from agent → admin browser
    let send_task = tokio::spawn(async move {
        while let Ok(frame) = frame_rx.recv().await {
            if ws_sink.send(Message::Text(frame)).await.is_err() {
                break;
            }
        }
    });

    // Forward input events from admin browser → agent channel
    while let Some(Ok(msg)) = ws_stream.next().await {
        match msg {
            Message::Text(text) => {
                if let Some(agent_tx) = state.agent_channels.get(&agent_id) {
                    let _ = agent_tx.send(text.to_string());
                }
            },
            Message::Close(_) => break,
            _ => {},
        }
    }

    send_task.abort();
    tracing::info!("Admin viewer disconnected for hardware {}", hw_id);
}

// ─── RM5: Start remote session (HTTP POST) ────────────────────────────────────
//
// POST /:hw_id/remote-session/start
//
// Sends `start_session` command to the connected agent.
// Records the session in DB.

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/hardware/{hw_id}/remote-session/start",
    params(("hw_id" = uuid::Uuid, Path, description = "Hardware UUID")),
    request_body = StartSessionReq,
    responses(
        (status = 201, description = "Remote session started", body = SessionResp),
        (status = 404, description = "No agent found for hardware"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Remote"
)]
pub async fn start_remote_session(
    Path(hw_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(payload): Json<StartSessionReq>,
) -> Result<(StatusCode, Json<SessionResp>), (StatusCode, String)> {
    let agent_id = resolve_agent_id(hw_id, &state.pool).await.ok_or((
        StatusCode::NOT_FOUND,
        "No agent found for this hardware".to_string(),
    ))?;

    let session_id = Uuid::new_v4();
    let mode = payload.mode.unwrap_or_else(|| "observe".to_string());
    let admin_name = payload.admin_name.unwrap_or_else(|| "Admin".to_string());
    let record = payload.record.unwrap_or(false);

    // Feature 26: determine recording file path if recording enabled
    let rec_file_path: Option<String> = if record {
        let recs_dir = std::path::PathBuf::from("/var/lib/signapps/recordings");
        let _ = std::fs::create_dir_all(&recs_dir);
        let file_name = format!("session_{}.ndjson", session_id);
        let full_path = recs_dir.join(&file_name);
        // Register recording path in AppState so handle_agent_ws can write frames
        if let Some(agent_id) = resolve_agent_id(hw_id, &state.pool).await {
            state.recording_paths.insert(agent_id, full_path.clone());
        }
        Some(full_path.to_string_lossy().to_string())
    } else {
        None
    };

    // Record in DB (using dynamic query — remote.sessions table created in migration 123)
    sqlx::query(
        r#"
        INSERT INTO remote.sessions (id, hardware_id, admin_user_id, mode, status, file_path)
        VALUES ($1, $2, $3, $4, 'active', $5)
        "#,
    )
    .bind(session_id)
    .bind(hw_id)
    .bind(Uuid::nil()) // TODO: extract from JWT auth middleware
    .bind(&mode)
    .bind(&rec_file_path)
    .execute(state.pool.inner())
    .await
    .map_err(internal_err)?;

    // Send command to agent if connected
    let cmd = serde_json::json!({
        "type": "start_session",
        "session_id": session_id,
        "mode": mode,
        "admin_name": admin_name,
    })
    .to_string();

    if let Some(tx) = state.agent_channels.get(&agent_id) {
        let _ = tx.send(cmd);
        tracing::info!(
            "start_session sent to agent {} for hardware {} (mode={})",
            agent_id,
            hw_id,
            mode
        );
    } else {
        tracing::warn!(
            "Agent {} not connected — start_session recorded in DB only",
            agent_id
        );
    }

    Ok((
        StatusCode::CREATED,
        Json(SessionResp {
            session_id,
            status: "active".to_string(),
            mode,
        }),
    ))
}

// ─── RM6: List session recordings ─────────────────────────────────────────────
//
// GET /:hw_id/recordings

#[derive(Debug, serde::Serialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct RecordingRow {
    pub id: Uuid,
    pub hardware_id: Uuid,
    pub session_id: Uuid,
    pub file_path: Option<String>,
    pub size_bytes: Option<i64>,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub ended_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/hardware/{hw_id}/recordings",
    params(("hw_id" = uuid::Uuid, Path, description = "Hardware UUID")),
    responses(
        (status = 200, description = "Session recordings list", body = Vec<RecordingRow>),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Remote"
)]
pub async fn list_recordings(
    Path(hw_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<Vec<RecordingRow>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, RecordingRow>(
        r#"
        SELECT id, hardware_id, session_id, file_path, size_bytes, started_at, ended_at
        FROM remote.sessions
        WHERE hardware_id = $1
          AND file_path IS NOT NULL
        ORDER BY started_at DESC
        LIMIT 100
        "#,
    )
    .bind(hw_id)
    .fetch_all(state.pool.inner())
    .await
    .map_err(internal_err)?;

    Ok(Json(rows))
}

// ─── RM5: Stop remote session (HTTP POST) ─────────────────────────────────────
//
// POST /:hw_id/remote-session/stop

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/hardware/{hw_id}/remote-session/stop",
    params(("hw_id" = uuid::Uuid, Path, description = "Hardware UUID")),
    responses(
        (status = 204, description = "Session stopped"),
        (status = 404, description = "No agent found for hardware"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Remote"
)]
pub async fn stop_remote_session(
    Path(hw_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<StatusCode, (StatusCode, String)> {
    let agent_id = resolve_agent_id(hw_id, &state.pool).await.ok_or((
        StatusCode::NOT_FOUND,
        "No agent found for this hardware".to_string(),
    ))?;

    // Mark active sessions as ended
    sqlx::query(
        r#"
        UPDATE remote.sessions
        SET status = 'ended',
            ended_at = now(),
            duration_seconds = EXTRACT(EPOCH FROM (now() - started_at))::integer
        WHERE hardware_id = $1 AND status = 'active'
        "#,
    )
    .bind(hw_id)
    .execute(state.pool.inner())
    .await
    .map_err(internal_err)?;

    // Feature 26: stop recording — update file_size in DB then remove recording path
    if let Some(rec_path) = state.recording_paths.remove(&agent_id) {
        let size = std::fs::metadata(&rec_path.1)
            .map(|m| m.len() as i64)
            .unwrap_or(0);
        let _ = sqlx::query(
            "UPDATE remote.sessions SET size_bytes = $1 WHERE hardware_id = $2 AND status = 'active'",
        )
        .bind(size)
        .bind(hw_id)
        .execute(state.pool.inner())
        .await;
    }

    // Notify agent to end all sessions
    let cmd = serde_json::json!({
        "type": "stop_session",
        "session_id": "all",
    })
    .to_string();

    if let Some(tx) = state.agent_channels.get(&agent_id) {
        let _ = tx.send(cmd);
    }

    Ok(StatusCode::NO_CONTENT)
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async fn resolve_agent_id(hw_id: Uuid, pool: &DatabasePool) -> Option<Uuid> {
    sqlx::query_scalar::<_, Option<Uuid>>("SELECT agent_id FROM it.hardware WHERE id = $1")
        .bind(hw_id)
        .fetch_optional(pool.inner())
        .await
        .ok()
        .flatten()
        .flatten()
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }
}
