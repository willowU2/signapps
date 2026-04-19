//! Public library interface for signapps-chat.
//!
//! Exposes [`router`] so the single-binary runtime can mount the
//! chat routes without owning its own pool.
//!
//! Real-time messaging with channels, messages, reactions, threads, pins,
//! DMs, presence, search, file attachments and export.

pub mod handlers;
pub mod provisioning_consumer;
pub mod state;
pub mod types;

use axum::{
    middleware,
    routing::{delete, get, patch, post},
    Router,
};
use signapps_cache::CacheService;
use signapps_common::middleware::{auth_middleware, tenant_context_middleware};
use signapps_service::shared_state::SharedState;
use signapps_sharing::routes::sharing_routes;
use signapps_sharing::{ResourceType, SharingEngine};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

pub use state::AppState;

/// Build the chat router using the shared runtime state.
///
/// # Errors
///
/// Returns an error when the shared state cannot be cloned into the
/// required per-service shape.
pub async fn router(shared: SharedState) -> anyhow::Result<Router> {
    let state = build_state(&shared).await?;
    let sharing_engine =
        SharingEngine::new(shared.pool.inner().clone(), CacheService::default_config());

    // Org provisioning consumer — add user to #general on user.created,
    // remove from all channels on user.deactivated.
    provisioning_consumer::spawn(shared.pool.inner().clone());

    Ok(create_router(state, sharing_engine))
}

async fn build_state(shared: &SharedState) -> anyhow::Result<AppState> {
    let pool = shared.pool.inner().clone();
    let jwt_config = (*shared.jwt).clone();
    let event_bus = (*shared.event_bus).clone();
    Ok(AppState::new(pool, jwt_config, event_bus).with_resolver(shared.resolver.clone()))
}

fn create_router(state: AppState, sharing_engine: SharingEngine) -> Router {
    let public_routes = Router::new()
        .route("/health", get(handlers::health::health_check))
        .merge(signapps_common::version::router("signapps-chat"));

    let protected_routes = Router::new()
        // Channels
        .route(
            "/api/v1/channels",
            get(handlers::channels::list_channels).post(handlers::channels::create_channel),
        )
        .route(
            "/api/v1/channels/:id",
            get(handlers::channels::get_channel)
                .put(handlers::channels::update_channel)
                .delete(handlers::channels::delete_channel),
        )
        // Messages
        .route(
            "/api/v1/channels/:id/messages",
            get(handlers::messages::list_messages).post(handlers::messages::send_message),
        )
        .route(
            "/api/v1/channels/:channel_id/messages/:message_id",
            patch(handlers::messages::edit_message).delete(handlers::messages::delete_message),
        )
        // File upload per channel
        .route(
            "/api/v1/channels/:id/upload",
            post(handlers::messages::upload_file),
        )
        // Pins
        .route(
            "/api/v1/channels/:channel_id/pins",
            get(handlers::pins::list_pinned),
        )
        .route(
            "/api/v1/channels/:channel_id/messages/:message_id/pin",
            post(handlers::pins::pin_message),
        )
        .route(
            "/api/v1/channels/:channel_id/messages/:message_id/pin",
            delete(handlers::pins::unpin_message),
        )
        // Search
        .route(
            "/api/v1/channels/:id/search",
            get(handlers::search::search_messages),
        )
        // Export
        .route(
            "/api/v1/channels/:id/export",
            get(handlers::export::export_channel),
        )
        // Read status
        .route(
            "/api/v1/channels/:id/read-status",
            get(handlers::read_status::get_read_status)
                .post(handlers::read_status::mark_channel_read),
        )
        .route(
            "/api/v1/unread-counts",
            get(handlers::read_status::get_all_unread),
        )
        // Reactions
        .route(
            "/api/v1/messages/:id/reactions",
            post(handlers::reactions::add_reaction),
        )
        // Direct Messages
        .route(
            "/api/v1/dms",
            get(handlers::dms::list_dms).post(handlers::dms::create_dm),
        )
        .route("/api/v1/dms/:id", delete(handlers::dms::delete_dm))
        .route(
            "/api/v1/dms/:id/messages",
            get(handlers::dms::list_dm_messages).post(handlers::dms::send_dm_message),
        )
        // Presence
        .route(
            "/api/v1/presence",
            get(handlers::presence::get_presence).post(handlers::presence::set_presence),
        )
        // Meet integration: start a video call from a thread
        .route(
            "/api/v1/chat/threads/:thread_id/start-video-call",
            post(handlers::video_call::start_video_call),
        )
        // WebSocket
        .route("/api/v1/ws", get(handlers::websocket::ws_upgrade))
        .route_layer(middleware::from_fn(tenant_context_middleware))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    let sharing_sub = sharing_routes("chat", ResourceType::Channel).with_state(sharing_engine);

    public_routes
        .merge(protected_routes)
        .merge(sharing_sub)
        .layer(TraceLayer::new_for_http())
        .layer(
            CorsLayer::new()
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
                ]),
        )
        .layer(axum::extract::DefaultBodyLimit::max(50 * 1024 * 1024))
        .with_state(state)
}
