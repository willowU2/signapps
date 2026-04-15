//! Router assembly. Auth layer added in Task P3a.7.

use crate::api::{auth::require_superadmin, handlers, openapi::ApiDoc, state::AppState};
use axum::{middleware, Router};
use signapps_common::middleware::auth_middleware;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

/// Build the Phase 3a API router.
///
/// At this stage all handler routers are empty (filled in later tasks).
/// Mounted under `/api/v1/deploy`.
///
/// # Auth
///
/// Every route is gated behind two layers:
/// 1. [`auth_middleware`] — verifies the JWT and injects [`signapps_common::auth::Claims`]
///    into request extensions.
/// 2. [`require_superadmin`] — rejects anything below role `3` (SuperAdmin).
///
/// Axum applies layers in reverse registration order, so on each request
/// `auth_middleware` runs first, then `require_superadmin`, then the handler.
pub fn build_router(state: AppState) -> Router {
    let api = Router::new()
        .merge(handlers::envs::router())
        .merge(handlers::versions::router())
        .merge(handlers::deploy::router())
        .merge(handlers::rollback::router())
        .merge(handlers::maintenance::router())
        .merge(handlers::history::router())
        .merge(handlers::promote::router())
        .merge(handlers::feature_flags::router())
        .merge(handlers::events_ws::router())
        .with_state(state.clone());

    // Layer order — axum applies these in reverse, so on each request:
    //   auth_middleware runs first (extracts Claims into extensions),
    //   require_superadmin runs next (403 if role not superadmin),
    //   then the handler.
    let protected =
        api.layer(middleware::from_fn(require_superadmin))
            .layer(middleware::from_fn_with_state(
                state.clone(),
                auth_middleware::<AppState>,
            ));

    Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .nest("/api/v1/deploy", protected)
        .with_state(state)
}
