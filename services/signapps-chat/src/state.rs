//! Application state and broadcast helper for the chat service.

use crate::types::{ChatMessage, DirectMessageRoom, PresenceEntry, ReadStatus, WsEvent};
use dashmap::DashMap;
use signapps_common::pg_events::PgEventBus;
use signapps_common::rbac::resolver::OrgPermissionResolver;
use signapps_common::{AuthState, JwtConfig};
use sqlx::{Pool, Postgres};
use std::sync::Arc;
use tokio::sync::broadcast;
use uuid::Uuid;

#[derive(Clone)]
/// Application state for  service.
pub struct AppState {
    /// PostgreSQL pool — used for channels and messages persistence.
    pub pool: Pool<Postgres>,
    // In-memory stores (DMs, presence, read-status not yet persisted)
    pub dm_rooms: Arc<DashMap<Uuid, DirectMessageRoom>>,
    pub dm_messages: Arc<DashMap<Uuid, Vec<ChatMessage>>>,
    pub presence: Arc<DashMap<Uuid, PresenceEntry>>,
    pub read_status: Arc<DashMap<String, ReadStatus>>, // "{channel_id}:{user_id}" -> status
    pub broadcast_tx: broadcast::Sender<String>,
    pub jwt_config: JwtConfig,
    pub event_bus: PgEventBus,
    /// Shared RBAC resolver injected by the runtime. `None` in tests.
    pub resolver: Option<Arc<dyn OrgPermissionResolver>>,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

impl AppState {
    /// Create a new [`AppState`].
    pub fn new(pool: Pool<Postgres>, jwt_config: JwtConfig, event_bus: PgEventBus) -> Self {
        let (tx, _) = broadcast::channel::<String>(1024);
        Self {
            pool,
            dm_rooms: Arc::new(DashMap::new()),
            dm_messages: Arc::new(DashMap::new()),
            presence: Arc::new(DashMap::new()),
            read_status: Arc::new(DashMap::new()),
            broadcast_tx: tx,
            jwt_config,
            event_bus,
            resolver: None,
        }
    }

    /// Replace the current resolver (platform binary call — tests
    /// leave it at `None`).
    pub fn with_resolver(mut self, resolver: Option<Arc<dyn OrgPermissionResolver>>) -> Self {
        self.resolver = resolver;
        self
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Broadcast a WebSocket event to all connected clients.
pub fn broadcast(state: &AppState, event_type: &str, payload: serde_json::Value) {
    let event = WsEvent {
        event_type: event_type.to_string(),
        payload,
    };
    let json = serde_json::to_string(&event).unwrap_or_default();
    let _ = state.broadcast_tx.send(json);
}
