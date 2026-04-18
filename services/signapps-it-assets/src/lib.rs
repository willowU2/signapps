//! Public library interface for signapps-it-assets.
//!
//! Exposes [`router`] so the single-binary runtime (`signapps-platform`)
//! can mount IT asset inventory routes (hardware, agents, patches,
//! monitoring, CMDB, change management, tickets, remote sessions)
//! without owning its own pool / JWT config.

#![allow(clippy::assertions_on_constants)]

pub mod handlers;
pub mod models;
pub mod routes;

use axum::{middleware, Router};
use signapps_cache::CacheService;
use signapps_common::middleware::{auth_middleware, tenant_context_middleware};
use signapps_service::shared_state::SharedState;
use signapps_sharing::routes::sharing_routes;
use signapps_sharing::{ResourceType, SharingEngine};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

pub use handlers::AppState;

/// Build the IT assets router using the shared runtime state.
///
/// # Errors
///
/// Returns an error if shared-state cloning fails (none currently, but reserved).
pub async fn router(shared: SharedState) -> anyhow::Result<Router> {
    let state = build_state(&shared).await?;
    let sharing_engine =
        SharingEngine::new(shared.pool.inner().clone(), CacheService::default_config());
    Ok(create_router(state, sharing_engine))
}

async fn build_state(shared: &SharedState) -> anyhow::Result<AppState> {
    Ok(AppState::new(shared.pool.clone(), (*shared.jwt).clone()))
}

fn create_router(state: AppState, sharing_engine: SharingEngine) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            "http://localhost:3000".parse().expect("valid origin"),
            "http://127.0.0.1:3000".parse().expect("valid origin"),
        ]))
        .allow_credentials(true)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::PATCH,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
            axum::http::header::ORIGIN,
            axum::http::HeaderName::from_static("x-workspace-id"),
            axum::http::HeaderName::from_static("x-request-id"),
        ]);

    // Sharing sub-router: State<SharingEngine> — separate from AppState.
    let sharing_sub = sharing_routes("assets", ResourceType::Asset).with_state(sharing_engine);

    let protected_routes = routes::api_routes(state.clone())
        .route_layer(middleware::from_fn(tenant_context_middleware))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<handlers::AppState>,
        ));

    Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url(
            "/api-docs/openapi.json",
            handlers::openapi::ItAssetsApiDoc::openapi(),
        ))
        .merge(signapps_common::version::router("signapps-it-assets"))
        .merge(routes::public_routes().with_state(state.pool.clone()))
        .nest("/api/v1/it-assets", protected_routes)
        .merge(sharing_sub)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
}
