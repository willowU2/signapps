//! CRUD handlers for `/api/v1/org/persons` — canonical surface (S1 W2).
//!
//! Actual endpoints are wired in Task 10. This module currently exports
//! an empty `routes()` placeholder so the router compiles.

use axum::Router;

use crate::AppState;

/// Routes for `/api/v1/org/persons` — placeholder in the scaffolding task.
pub fn routes() -> Router<AppState> {
    Router::new()
}
