//! Public grant redirect handler mounted at `/g/:token` (S1 W5).
//!
//! Wired in W5. Placeholder `routes()` returns an empty router.

use axum::Router;

use crate::AppState;

/// Routes for `/g/:token` — placeholder in the scaffolding task.
pub fn routes() -> Router<AppState> {
    Router::new()
}
