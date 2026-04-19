//! Access-grant handlers for `/api/v1/org/grants` — canonical surface (S1 W5).
//!
//! Wired in W5. Placeholder `routes()` returns an empty router.

use axum::Router;

use crate::AppState;

/// Routes for `/api/v1/org/grants` — placeholder in the scaffolding task.
pub fn routes() -> Router<AppState> {
    Router::new()
}
