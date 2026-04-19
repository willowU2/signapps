//! Public grant redirect mounted at `/g/:token`.
//!
//! Wired in Task 31. Temporarily a no-op placeholder so Task 30 can
//! land the token sign/verify module independently.

use axum::Router;

use crate::AppState;

/// Router stub — replaced in Task 31 with the real flow.
pub fn routes() -> Router<AppState> {
    Router::new()
}
