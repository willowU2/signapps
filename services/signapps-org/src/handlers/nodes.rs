//! CRUD handlers for `/api/v1/org/nodes` — canonical surface (S1 W2).
//!
//! Actual endpoints are wired in Task 10. This module currently exports
//! an empty `routes()` placeholder so the router compiles.

use axum::Router;

use crate::AppState;

/// Routes for `/api/v1/org/nodes` — placeholder in the scaffolding task.
///
/// The real CRUD endpoints are added in Task 10 of the S1 plan.
pub fn routes() -> Router<AppState> {
    Router::new()
}
