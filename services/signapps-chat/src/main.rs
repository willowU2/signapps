//! SignApps Chat Service
//! Real-time messaging with channels, messages, reactions, threads, pins,
//! DMs, presence, search, file attachments and export.
//! Channels and messages are persisted in PostgreSQL (chat schema).
//! DMs, presence, and read-status remain in-memory (no user-facing persistence yet).

use axum::{
    middleware,
    routing::{delete, get, patch, post},
    Router,
};
use signapps_cache::CacheService;
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::auth_middleware;
use signapps_common::pg_events::PgEventBus;
use signapps_sharing::routes::sharing_routes;
use signapps_sharing::{ResourceType, SharingEngine};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

mod handlers;
mod state;
mod types;

pub use state::AppState;

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

fn create_router(state: AppState, sharing_engine: SharingEngine) -> Router {
    let public_routes = Router::new().route("/health", get(handlers::health::health_check));

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
        .route("/api/v1/channels/:id/upload", post(handlers::messages::upload_file))
        // Pins (IDEA-132)
        .route("/api/v1/channels/:channel_id/pins", get(handlers::pins::list_pinned))
        .route(
            "/api/v1/channels/:channel_id/messages/:message_id/pin",
            post(handlers::pins::pin_message),
        )
        .route(
            "/api/v1/channels/:channel_id/messages/:message_id/pin",
            delete(handlers::pins::unpin_message),
        )
        // Search (IDEA-138)
        .route("/api/v1/channels/:id/search", get(handlers::search::search_messages))
        // Export (IDEA-142)
        .route("/api/v1/channels/:id/export", get(handlers::export::export_channel))
        // Read status (IDEA-140)
        .route(
            "/api/v1/channels/:id/read-status",
            get(handlers::read_status::get_read_status)
                .post(handlers::read_status::mark_channel_read),
        )
        .route("/api/v1/unread-counts", get(handlers::read_status::get_all_unread))
        // Reactions (IDEA-131)
        .route("/api/v1/messages/:id/reactions", post(handlers::reactions::add_reaction))
        // Direct Messages (IDEA-137)
        .route(
            "/api/v1/dms",
            get(handlers::dms::list_dms).post(handlers::dms::create_dm),
        )
        .route("/api/v1/dms/:id", delete(handlers::dms::delete_dm))
        .route(
            "/api/v1/dms/:id/messages",
            get(handlers::dms::list_dm_messages).post(handlers::dms::send_dm_message),
        )
        // Presence (IDEA-136)
        .route(
            "/api/v1/presence",
            get(handlers::presence::get_presence).post(handlers::presence::set_presence),
        )
        // WebSocket
        .route("/api/v1/ws", get(handlers::websocket::ws_upgrade))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Sharing sub-router: State<SharingEngine> — separate from AppState.
    let sharing_sub = sharing_routes("chat", ResourceType::Channel)
        .with_state(sharing_engine);

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

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing("signapps_chat");
    load_env();

    let config = ServiceConfig::from_env("signapps-chat", 3020);
    config.log_startup();

    let db_pool = signapps_db::create_pool(&config.database_url)
        .await
        .expect("Failed to connect to Postgres");
    tracing::info!("Database pool created");

    let event_bus = PgEventBus::new(db_pool.inner().clone(), "signapps-chat".to_string());

    let jwt_config = config.jwt_config();
    let state = AppState::new(db_pool.inner().clone(), jwt_config, event_bus);
    tracing::info!("Chat service initialized with PostgreSQL persistence");

    let sharing_engine =
        SharingEngine::new(db_pool.inner().clone(), CacheService::default_config());

    let app = create_router(state, sharing_engine);

    signapps_common::bootstrap::run_server(app, &config).await?;

    Ok(())
}
