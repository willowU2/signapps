//! `POST /envs/:env/maintenance` — filled in Task P3a.9.

use crate::api::state::AppState;
use axum::Router;

/// Build the router for maintenance mode endpoints.
pub fn router() -> Router<AppState> {
    Router::new()
}
