//! `/envs`, `/envs/:env/health` — filled in Task P3a.8.

use crate::api::state::AppState;
use axum::Router;

/// Build the router for environment-related endpoints.
pub fn router() -> Router<AppState> {
    Router::new()
}
