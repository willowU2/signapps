//! Feature flags CRUD — filled in Task P3a.10.

use crate::api::state::AppState;
use axum::Router;

/// Build the router for feature flag CRUD endpoints.
pub fn router() -> Router<AppState> {
    Router::new()
}
