//! CRUD handlers for `/api/v1/org/assignments` — canonical surface (S1 W2).
//!
//! Wired in Task 10. Named `canonical_assignments` to avoid colliding
//! with the pre-existing `assignments` handler that still powers the
//! legacy `/api/v1/assignments` endpoints.

use axum::Router;

use crate::AppState;

/// Routes for `/api/v1/org/assignments` — placeholder in the scaffolding task.
pub fn routes() -> Router<AppState> {
    Router::new()
}
