//! `POST /promote` — filled in Task P3a.9.

use crate::api::state::AppState;
use axum::Router;

/// Build the router for environment promotion endpoints.
pub fn router() -> Router<AppState> {
    Router::new()
}
