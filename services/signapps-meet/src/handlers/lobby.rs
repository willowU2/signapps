//! Lobby / knock-to-enter handlers.
//!
//! Backed by `meet.waiting_room_requests` (migration `286_meet_extensions.sql`).
//! The in-memory fallback from Phase 1 is gone — every knock is now
//! persisted, survives service restarts, and is visible to any host
//! instance.
//!
//! Endpoints:
//! - `GET  /meet/rooms/:code/lobby`                     (public)
//! - `POST /meet/rooms/:code/knock`                     (public)
//! - `GET  /meet/rooms/:code/knock-status?identity=...` (public, by identity)
//! - `GET  /meet/rooms/:code/knocks`                    (host-only)
//! - `POST /meet/rooms/:code/admit/:identity`           (host-only)
//! - `POST /meet/rooms/:code/deny/:identity`            (host-only)
//!
//! On state changes the handlers publish events on `PgEventBus`:
//! `meet.knock.requested`, `meet.knock.admitted`, `meet.knock.denied`.
//! Phase 4 notifications will consume these.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::pg_events::{NewEvent, PgEventBus};
use signapps_common::Claims;
use sqlx::FromRow;
use uuid::Uuid;

use crate::{models::Room, AppState};

// ── DTOs ──────────────────────────────────────────────────────────────────────

/// Status of a knock request (matches the `status` CHECK constraint on
/// `meet.waiting_room_requests`).
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

impl KnockStatus {
    fn as_db(self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Admitted => "admitted",
            Self::Denied => "denied",
        }
    }

    fn parse(s: &str) -> Self {
        match s {
            "admitted" => Self::Admitted,
            "denied" => Self::Denied,
            _ => Self::Pending,
        }
    }
}

/// Response for `GET /meet/rooms/:code/lobby`.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct LobbyInfo {
    /// Whether the room currently accepts joins (not `ended`).
    pub is_open: bool,
    /// Whether the host requires explicit admission.
    pub requires_knock: bool,
    /// Whether the room is password-protected.
    pub has_password: bool,
    /// Room UUID (to help the frontend resolve code→id).
    pub room_id: Uuid,
    /// Human-readable room name.
    pub room_name: String,
}

/// Request body for `POST /meet/rooms/:code/knock`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct KnockRequest {
    /// Display name shown to the host in the waiting list.
    pub display_name: String,
    /// Optional stable identity — if absent the server generates one.
    #[serde(default)]
    pub identity: Option<String>,
}

/// Response body for `POST /meet/rooms/:code/knock`.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct KnockResponse {
    /// Server-assigned request id (UUID).
    pub request_id: Uuid,
    /// Identity the host must use to admit/deny this knocker.
    pub identity: String,
    /// Current status (always `pending` on creation).
    pub status: KnockStatus,
}

/// Response body for a pending knocker entry (host view).
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct KnockEntry {
    /// Request id.
    pub request_id: Uuid,
    /// Knocker identity.
    pub identity: String,
    /// Display name supplied by the knocker.
    pub display_name: String,
    /// Resolved status.
    pub status: KnockStatus,
    /// Time the knock was received.
    pub created_at: DateTime<Utc>,
    /// Time the status was resolved, if any.
    pub resolved_at: Option<DateTime<Utc>>,
}

/// Query for `GET /meet/rooms/:code/knock-status`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct KnockStatusQuery {
    /// Knocker identity returned by the initial `/knock` call.
    pub identity: String,
}

/// Response for `GET /meet/rooms/:code/knock-status`.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct KnockStatusResponse {
    /// Current status.
    pub status: KnockStatus,
}

// ── DB row ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, FromRow)]
struct WaitingRoomRow {
    id: Uuid,
    #[allow(dead_code)]
    room_id: Uuid,
    identity: String,
    display_name: String,
    status: String,
    created_at: DateTime<Utc>,
    resolved_at: Option<DateTime<Utc>>,
}

impl From<WaitingRoomRow> for KnockEntry {
    fn from(r: WaitingRoomRow) -> Self {
        Self {
            request_id: r.id,
            identity: r.identity,
            display_name: r.display_name,
            status: KnockStatus::parse(&r.status),
            created_at: r.created_at,
            resolved_at: r.resolved_at,
        }
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async fn fetch_room_by_code(state: &AppState, code: &str) -> Result<Room, (StatusCode, String)> {
    sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE room_code = $1")
        .bind(code)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))
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

fn generate_identity(display_name: &str) -> String {
    let sanitized: String = display_name
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .take(12)
        .collect();
    let tag = Uuid::new_v4().simple().to_string();
    format!("guest-{}-{}", sanitized, &tag[..8])
}

async fn publish_event(
    pool: &sqlx::PgPool,
    event_type: &str,
    aggregate_id: Uuid,
    payload: serde_json::Value,
) {
    let bus = PgEventBus::new(pool.clone(), "signapps-meet".to_string());
    if let Err(err) = bus
        .publish(NewEvent {
            event_type: event_type.to_string(),
            aggregate_id: Some(aggregate_id),
            payload,
        })
        .await
    {
        tracing::warn!(?err, event_type, "failed to publish knock event");
    }
}

// ── Handlers ───────────────────────────────────────────────────────────────────

/// Public lobby metadata (no auth).
///
/// # Errors
///
/// Returns `404` if the room code is unknown, `500` on DB failure.
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

    // Read the persisted flag; fall back to `is_private` when the column
    // is false (legacy rooms created before the 286 migration still rely
    // on is_private to signal a gated entrance).
    let requires_knock_row: (bool,) =
        sqlx::query_as("SELECT COALESCE(requires_knock, false) FROM meet.rooms WHERE id = $1")
            .bind(room.id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let requires_knock = requires_knock_row.0 || room.is_private;

    Ok(Json(LobbyInfo {
        is_open: room.status != "ended",
        requires_knock,
        has_password: room.password_hash.is_some(),
        room_id: room.id,
        room_name: room.name,
    }))
}

/// Knock to request entry (public, no auth).
///
/// # Errors
///
/// - `404` if the room code is unknown.
/// - `410` if the room has ended.
/// - `500` on DB failure.
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

    let identity = req
        .identity
        .clone()
        .unwrap_or_else(|| generate_identity(&req.display_name));

    // Upsert — a knocker who refreshes the lobby shouldn't create dupes.
    // When a previous row exists and is pending/denied we overwrite to
    // pending (fresh attempt); admitted rows are left alone so a double
    // click can't undo the admission.
    let row: WaitingRoomRow = sqlx::query_as(
        r#"
        INSERT INTO meet.waiting_room_requests
            (room_id, identity, display_name, status)
        VALUES ($1, $2, $3, 'pending')
        ON CONFLICT (room_id, identity) DO UPDATE SET
            status = CASE
                WHEN meet.waiting_room_requests.status = 'admitted' THEN 'admitted'
                ELSE 'pending'
            END,
            display_name = EXCLUDED.display_name,
            created_at = CASE
                WHEN meet.waiting_room_requests.status = 'admitted' THEN meet.waiting_room_requests.created_at
                ELSE NOW()
            END,
            resolved_at = CASE
                WHEN meet.waiting_room_requests.status = 'admitted' THEN meet.waiting_room_requests.resolved_at
                ELSE NULL
            END
        RETURNING id, room_id, identity, display_name, status, created_at, resolved_at
        "#,
    )
    .bind(room.id)
    .bind(&identity)
    .bind(&req.display_name)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    publish_event(
        &state.pool,
        "meet.knock.requested",
        row.id,
        serde_json::json!({
            "room_id": room.id,
            "room_code": code,
            "identity": row.identity,
            "display_name": row.display_name,
        }),
    )
    .await;

    Ok(Json(KnockResponse {
        request_id: row.id,
        identity: row.identity,
        status: KnockStatus::parse(&row.status),
    }))
}

/// Poll the current knock status (public, by identity).
///
/// # Errors
///
/// - `404` if the room or the identity is unknown.
/// - `500` on DB failure.
#[utoipa::path(
    get,
    path = "/api/v1/meet/rooms/{code}/knock-status",
    params(
        ("code" = String, Path, description = "Room code"),
        KnockStatusQuery,
    ),
    responses(
        (status = 200, description = "Current status", body = KnockStatusResponse),
        (status = 404, description = "Knock not found"),
    ),
    tag = "Meet"
)]
#[tracing::instrument(skip(state))]
pub async fn knock_status(
    State(state): State<AppState>,
    Path(code): Path<String>,
    Query(q): Query<KnockStatusQuery>,
) -> Result<Json<KnockStatusResponse>, (StatusCode, String)> {
    let room = fetch_room_by_code(&state, &code).await?;
    let status: Option<(String,)> = sqlx::query_as(
        "SELECT status FROM meet.waiting_room_requests WHERE room_id = $1 AND identity = $2",
    )
    .bind(room.id)
    .bind(&q.identity)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let (s,) = status.ok_or((StatusCode::NOT_FOUND, "Knock not found".to_string()))?;
    Ok(Json(KnockStatusResponse {
        status: KnockStatus::parse(&s),
    }))
}

/// List pending knockers (host only).
///
/// # Errors
///
/// - `403` if the caller is not the host.
/// - `404` if the room does not exist.
/// - `500` on DB failure.
#[utoipa::path(
    get,
    path = "/api/v1/meet/rooms/{code}/knocks",
    params(("code" = String, Path, description = "Room code")),
    responses(
        (status = 200, description = "Pending knock entries", body = Vec<KnockEntry>),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — host only"),
        (status = 404, description = "Room not found"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
pub async fn list_knocks(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(code): Path<String>,
) -> Result<Json<Vec<KnockEntry>>, (StatusCode, String)> {
    let room = host_only(&state, &code, &claims).await?;
    let rows: Vec<WaitingRoomRow> = sqlx::query_as(
        r#"
        SELECT id, room_id, identity, display_name, status, created_at, resolved_at
        FROM meet.waiting_room_requests
        WHERE room_id = $1 AND status = 'pending'
        ORDER BY created_at ASC
        "#,
    )
    .bind(room.id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(rows.into_iter().map(KnockEntry::from).collect()))
}

async fn resolve_knock(
    state: &AppState,
    room: &Room,
    identity: &str,
    status: KnockStatus,
) -> Result<WaitingRoomRow, (StatusCode, String)> {
    let row: Option<WaitingRoomRow> = sqlx::query_as(
        r#"
        UPDATE meet.waiting_room_requests
           SET status = $1, resolved_at = NOW()
         WHERE room_id = $2 AND identity = $3 AND status = 'pending'
        RETURNING id, room_id, identity, display_name, status, created_at, resolved_at
        "#,
    )
    .bind(status.as_db())
    .bind(room.id)
    .bind(identity)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    row.ok_or((
        StatusCode::NOT_FOUND,
        "No pending knock for identity".to_string(),
    ))
}

/// Admit a pending knocker (host only).
///
/// # Errors
///
/// - `403` if the caller is not the host.
/// - `404` if no pending knock exists for this identity.
/// - `500` on DB failure.
#[utoipa::path(
    post,
    path = "/api/v1/meet/rooms/{code}/admit/{identity}",
    params(
        ("code" = String, Path, description = "Room code"),
        ("identity" = String, Path, description = "Knocker identity"),
    ),
    responses(
        (status = 200, description = "Admitted", body = KnockEntry),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — host only"),
        (status = 404, description = "Knock not found"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
pub async fn admit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((code, identity)): Path<(String, String)>,
) -> Result<Json<KnockEntry>, (StatusCode, String)> {
    let room = host_only(&state, &code, &claims).await?;
    let row = resolve_knock(&state, &room, &identity, KnockStatus::Admitted).await?;

    publish_event(
        &state.pool,
        "meet.knock.admitted",
        row.id,
        serde_json::json!({
            "room_id": room.id,
            "room_code": code,
            "identity": row.identity,
        }),
    )
    .await;

    Ok(Json(row.into()))
}

/// Deny a pending knocker (host only).
///
/// # Errors
///
/// - `403` if the caller is not the host.
/// - `404` if no pending knock exists for this identity.
/// - `500` on DB failure.
#[utoipa::path(
    post,
    path = "/api/v1/meet/rooms/{code}/deny/{identity}",
    params(
        ("code" = String, Path, description = "Room code"),
        ("identity" = String, Path, description = "Knocker identity"),
    ),
    responses(
        (status = 200, description = "Denied", body = KnockEntry),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — host only"),
        (status = 404, description = "Knock not found"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
pub async fn deny(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((code, identity)): Path<(String, String)>,
) -> Result<Json<KnockEntry>, (StatusCode, String)> {
    let room = host_only(&state, &code, &claims).await?;
    let row = resolve_knock(&state, &room, &identity, KnockStatus::Denied).await?;

    publish_event(
        &state.pool,
        "meet.knock.denied",
        row.id,
        serde_json::json!({
            "room_id": room.id,
            "room_code": code,
            "identity": row.identity,
        }),
    )
    .await;

    Ok(Json(row.into()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn knock_status_round_trips() {
        assert!(matches!(KnockStatus::parse("pending"), KnockStatus::Pending));
        assert!(matches!(
            KnockStatus::parse("admitted"),
            KnockStatus::Admitted
        ));
        assert!(matches!(KnockStatus::parse("denied"), KnockStatus::Denied));
        assert_eq!(KnockStatus::Admitted.as_db(), "admitted");
    }

    #[test]
    fn generate_identity_produces_stable_prefix() {
        let id = generate_identity("Ada Lovelace!");
        assert!(id.starts_with("guest-AdaLovelace-"));
        assert_eq!(id.len(), "guest-AdaLovelace-".len() + 8);
    }
}
