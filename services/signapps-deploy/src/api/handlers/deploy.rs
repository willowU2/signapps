//! `POST /envs/:env/deploy` — filled in Task P3a.9.

use crate::api::state::AppState;
use axum::Router;

/// Build the router for deploy mutation endpoints.
pub fn router() -> Router<AppState> {
    Router::new()
}
