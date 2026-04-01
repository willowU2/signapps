//! Agent HTTP status interface.
//!
//! Exposes a minimal Axum HTTP server on `AGENT_STATUS_PORT` (default 9999)
//! so that the SignApps server can query agent liveness and retrieve basic
//! metadata without going through the full IT-Assets backend.

use crate::config::AgentConfig;
use axum::{extract::State, Json};
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::RwLock;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

/// Current agent status snapshot.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct AgentStatusResponse {
    /// Unique identifier assigned during enrollment.
    pub agent_id: Option<String>,
    /// URL of the SignApps management server this agent reports to.
    pub server_url: Option<String>,
    /// Running version of the agent binary (semver).
    pub version: String,
    /// Whether the agent is enrolled and ready to accept commands.
    pub enrolled: bool,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// Get agent status.
///
/// Returns the current enrollment state and version information of this agent.
///
/// # Errors
///
/// Returns `500` if the internal config lock is poisoned (extremely rare).
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/status",
    responses(
        (status = 200, description = "Agent status", body = AgentStatusResponse),
    ),
    tag = "System",
)]
pub async fn agent_status(State(config): State<Arc<RwLock<AgentConfig>>>) -> Json<AgentStatusResponse> {
    let cfg = config.read().await;
    Json(AgentStatusResponse {
        agent_id: cfg.agent_id.clone(),
        server_url: cfg.server_url.clone(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        enrolled: cfg.agent_id.is_some(),
    })
}

/// Agent health check.
///
/// Returns a minimal `{"status":"ok"}` payload for liveness probes.
///
/// # Errors
///
/// Never returns an error — this endpoint is always available.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/health",
    responses(
        (status = 200, description = "Agent is alive", body = inline(serde_json::Value)),
    ),
    tag = "System",
)]
pub async fn agent_health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "service": "signapps-agent",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}
