//! Lobby / knock-to-enter handlers.
//!
//! **Provisional in-memory implementation.** The design calls for a
//! migration `meet_extensions.sql` that would add a
//! `meet.waiting_room_requests` table plus a `requires_knock` column on
//! `meet.rooms`. Creating schema is a user-gated step of the Phase 1
//! plan, so until that migration lands we store the knock queue in
//! process memory (lost on service restart).
//!
//! The existing `/api/v1/meet/rooms/:id/waiting-room` routes in
//! `waiting_room.rs` target the eventual DB-backed implementation and
//! are left untouched on purpose — this module adds the new
//! code-based endpoints (`/meet/rooms/:code/lobby`, `/knock`,
//! `/admit/:identity`, `/deny/:identity`) described in the plan.

use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
};

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;

use crate::{models::Room, AppState};

/// Status of a knock request.
#[derive(Debug, Clone, Copy, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum KnockStatus {
    /// Pending host decision.
    Pending,
    /// Host admitted the knocker.
    Admitted,
    /// Host denied the knocker.
    Denied,
}

/// A knock queue entry.
#[derive(Debug, Clone)]
struct KnockEntry {
    /// Opaque request id (sequential counter encoded as string).
    request_id: String,
    /// Identity the host uses when admit/deny (maps to `identity` path param).
    identity: String,
    /// Display name supplied by the knocker.
    display_name: String,
    /// Current status.
    status: KnockStatus,
    /// Time the knock was received.
    created_at: DateTime<Utc>,
}

/// In-memory lobby state, scoped per-room-code.
///
/// Keys are room codes (as stored in `meet.rooms.room_code`). The list
/// is replaced wholesale when a host resolves (admit/deny).
#[derive(Debug, Default)]
pub struct LobbyState {
    inner: Mutex<HashMap<String, Vec<KnockEntry>>>,
    seq: AtomicU64,
}

impl LobbyState {
    /// Create a fresh empty lobby.
    pub fn new() -> Self {
        Self::default()
    }

    fn next_id(&self) -> String {
        let n = self.seq.fetch_add(1, Ordering::Relaxed);
        format!("req-{n}")
    }

    fn push(&self, room_code: &str, entry: KnockEntry) {
        let mut guard = self.inner.lock().expect("lobby mutex poisoned");
        guard.entry(room_code.to_string()).or_default().push(entry);
    }

    fn resolve(&self, room_code: &str, identity: &str, status: KnockStatus) -> Option<KnockEntry> {
        let mut guard = self.inner.lock().expect("lobby mutex poisoned");
        let list = guard.get_mut(room_code)?;
        let target = list
            .iter_mut()
            .filter(|e| matches!(e.status, KnockStatus::Pending) && e.identity == identity)
            .next_back()?;
        target.status = status;
        Some(target.clone())
    }
}

// --- DTOs ---------------------------------------------------------------------

/// Response for `GET /meet/rooms/:code/lobby`.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct LobbyInfo {
    /// Whether the room currently accepts joins (not `ended`).
    pub is_open: bool,
    /// Whether the host requires explicit admission.
    pub requires_knock: bool,
    /// Whether the room is password-protected.
    pub has_password: bool,
}

/// Request body for `POST /meet/rooms/:code/knock`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct KnockRequest {
    /// Display name shown to the host in the waiting list.
    pub display_name: String,
    /// Optional stable identity — if absent, one is generated (uuid-less
    /// anonymous handle). The admit/deny endpoints use this value.
    #[serde(default)]
    pub identity: Option<String>,
}

/// Response body for `POST /meet/rooms/:code/knock`.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct KnockResponse {
    /// Server-assigned request id.
    pub request_id: String,
    /// Identity the host must use to admit/deny this knocker.
    pub identity: String,
    /// Current status (always `pending` on creation).
    pub status: KnockStatus,
}

/// Response body for admit/deny.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct ResolvedKnock {
    /// Request id.
    pub request_id: String,
    /// Knocker identity.
    pub identity: String,
    /// Display name that was supplied.
    pub display_name: String,
    /// Resolved status.
    pub status: KnockStatus,
    /// Original knock time.
    pub created_at: DateTime<Utc>,
}

// --- Handlers -----------------------------------------------------------------

async fn fetch_room_by_code(state: &AppState, code: &str) -> Result<Room, (StatusCode, String)> {
    sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE room_code = $1")
        .bind(code)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))
}

/// Public lobby metadata (no auth).
#[utoipa::path(
    get,
    path = "/api/v1/meet/rooms/{code}/lobby",
    params(("code" = String, Path, description = "Room code")),
    responses(
        (status = 200, description = "Lobby metadata", body = LobbyInfo),
        (status = 404, description = "Room not found"),
    ),
    tag = "Meet"
)]
#[tracing::instrument(skip(state))]
pub async fn get_lobby(
    State(state): State<AppState>,
    Path(code): Path<String>,
) -> Result<Json<LobbyInfo>, (StatusCode, String)> {
    let room = fetch_room_by_code(&state, &code).await?;
    // `requires_knock` lives on a column that doesn't exist yet — we
    // infer it from `is_private` (password-protected rooms imply a
    // knock flow in the absence of the migration).
    let requires_knock = room.is_private;
    Ok(Json(LobbyInfo {
        is_open: room.status != "ended",
        requires_knock,
        has_password: room.password_hash.is_some(),
    }))
}

/// Knock to request entry (public, no auth).
#[utoipa::path(
    post,
    path = "/api/v1/meet/rooms/{code}/knock",
    params(("code" = String, Path, description = "Room code")),
    request_body = KnockRequest,
    responses(
        (status = 200, description = "Knock recorded", body = KnockResponse),
        (status = 404, description = "Room not found"),
        (status = 410, description = "Room has ended"),
    ),
    tag = "Meet"
)]
#[tracing::instrument(skip(state))]
pub async fn knock(
    State(state): State<AppState>,
    Path(code): Path<String>,
    Json(req): Json<KnockRequest>,
) -> Result<Json<KnockResponse>, (StatusCode, String)> {
    let room = fetch_room_by_code(&state, &code).await?;
    if room.status == "ended" {
        return Err((StatusCode::GONE, "Room has ended".to_string()));
    }

    let identity = req.identity.unwrap_or_else(|| {
        // Lightweight anonymous handle (display_name + counter fragment).
        let sanitized: String = req
            .display_name
            .chars()
            .filter(|c| c.is_ascii_alphanumeric())
            .collect();
        let n = uuid::Uuid::new_v4();
        format!("guest-{}-{}", sanitized, &n.simple().to_string()[..8])
    });
    let request_id = state.lobby.next_id();
    let entry = KnockEntry {
        request_id: request_id.clone(),
        identity: identity.clone(),
        display_name: req.display_name.clone(),
        status: KnockStatus::Pending,
        created_at: Utc::now(),
    };
    state.lobby.push(&code, entry);
    Ok(Json(KnockResponse {
        request_id,
        identity,
        status: KnockStatus::Pending,
    }))
}

async fn host_only(
    state: &AppState,
    code: &str,
    claims: &Claims,
) -> Result<Room, (StatusCode, String)> {
    let room = fetch_room_by_code(state, code).await?;
    if room.created_by != claims.sub {
        return Err((StatusCode::FORBIDDEN, "Only host can resolve knocks".into()));
    }
    Ok(room)
}

/// Admit a pending knocker (host only).
#[utoipa::path(
    post,
    path = "/api/v1/meet/rooms/{code}/admit/{identity}",
    params(
        ("code" = String, Path, description = "Room code"),
        ("identity" = String, Path, description = "Knocker identity"),
    ),
    responses(
        (status = 200, description = "Admitted", body = ResolvedKnock),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — host only"),
        (status = 404, description = "Knock not found"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state), fields(user_id = %claims.sub))]
pub async fn admit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((code, identity)): Path<(String, String)>,
) -> Result<Json<ResolvedKnock>, (StatusCode, String)> {
    let _room = host_only(&state, &code, &claims).await?;
    let entry = state
        .lobby
        .resolve(&code, &identity, KnockStatus::Admitted)
        .ok_or((
            StatusCode::NOT_FOUND,
            "No pending knock for identity".to_string(),
        ))?;
    Ok(Json(ResolvedKnock {
        request_id: entry.request_id,
        identity: entry.identity,
        display_name: entry.display_name,
        status: entry.status,
        created_at: entry.created_at,
    }))
}

/// Deny a pending knocker (host only).
#[utoipa::path(
    post,
    path = "/api/v1/meet/rooms/{code}/deny/{identity}",
    params(
        ("code" = String, Path, description = "Room code"),
        ("identity" = String, Path, description = "Knocker identity"),
    ),
    responses(
        (status = 200, description = "Denied", body = ResolvedKnock),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — host only"),
        (status = 404, description = "Knock not found"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state), fields(user_id = %claims.sub))]
pub async fn deny(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((code, identity)): Path<(String, String)>,
) -> Result<Json<ResolvedKnock>, (StatusCode, String)> {
    let _room = host_only(&state, &code, &claims).await?;
    let entry = state
        .lobby
        .resolve(&code, &identity, KnockStatus::Denied)
        .ok_or((
            StatusCode::NOT_FOUND,
            "No pending knock for identity".to_string(),
        ))?;
    Ok(Json(ResolvedKnock {
        request_id: entry.request_id,
        identity: entry.identity,
        display_name: entry.display_name,
        status: entry.status,
        created_at: entry.created_at,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lobby_push_and_resolve_admit() {
        let lobby = LobbyState::new();
        let entry = KnockEntry {
            request_id: "req-0".into(),
            identity: "alice".into(),
            display_name: "Alice".into(),
            status: KnockStatus::Pending,
            created_at: Utc::now(),
        };
        lobby.push("ABC123", entry);
        let resolved = lobby
            .resolve("ABC123", "alice", KnockStatus::Admitted)
            .expect("resolves");
        assert!(matches!(resolved.status, KnockStatus::Admitted));
    }

    #[test]
    fn resolve_unknown_identity_returns_none() {
        let lobby = LobbyState::new();
        assert!(lobby.resolve("ABC123", "nobody", KnockStatus::Admitted).is_none());
    }
}
