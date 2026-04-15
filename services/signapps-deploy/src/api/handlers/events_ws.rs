//! WebSocket `/events` — filled in Task P3a.11.

use crate::api::state::AppState;
use axum::Router;

/// Build the router for the WebSocket events stream.
pub fn router() -> Router<AppState> {
    Router::new()
}
