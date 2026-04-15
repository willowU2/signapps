//! Router assembly. Auth layer added in Task P3a.7.

use crate::api::state::AppState;
use axum::Router;

/// Build the Phase 3a API router.
///
/// At this stage all handler routers are empty (filled in later tasks).
/// Mounted under `/api/v1/deploy`.
pub fn build_router(state: AppState) -> Router {
    let api = Router::new()
        .merge(crate::api::handlers::envs::router())
        .merge(crate::api::handlers::versions::router())
        .merge(crate::api::handlers::deploy::router())
        .merge(crate::api::handlers::rollback::router())
        .merge(crate::api::handlers::maintenance::router())
        .merge(crate::api::handlers::history::router())
        .merge(crate::api::handlers::promote::router())
        .merge(crate::api::handlers::feature_flags::router())
        .merge(crate::api::handlers::events_ws::router())
        .with_state(state.clone());

    Router::new().nest("/api/v1/deploy", api).with_state(state)
}
