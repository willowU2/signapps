//! `GET /history` — filled in Task P3a.8.

use crate::api::state::AppState;
use axum::Router;

/// Build the router for deploy history endpoints.
pub fn router() -> Router<AppState> {
    Router::new()
}
