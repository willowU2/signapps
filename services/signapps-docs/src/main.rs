use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use signapps_cache::CacheService;
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::auth_middleware;
use signapps_common::{AuthState, JwtConfig};
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

mod handlers;
mod models;
mod utils;

use handlers::classify::classify_document;
use handlers::designs::{create_design, delete_design, get_design, list_designs, update_design};
use handlers::health::health_handler;
use handlers::macros::{create_macro, delete_macro, list_macros, update_macro};
use handlers::notes::{create_note, delete_note, list_notes, update_note};
use handlers::templates::{create_template, delete_template, get_template, list_templates};
use handlers::types::{board, chat, sheet, slide, text};
use handlers::websocket::websocket_handler;
use signapps_common::AiIndexerClient;

#[derive(Clone)]
/// Application state for  service.
pub struct AppState {
    pub pool: signapps_db::DatabasePool,
    pub cache: Arc<CacheService>,
    pub docs: Arc<dashmap::DashMap<String, yrs::Doc>>,
    pub broadcasts: Arc<dashmap::DashMap<String, tokio::sync::broadcast::Sender<Vec<u8>>>>,
    pub indexer: AiIndexerClient,
    pub jwt_config: JwtConfig,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize using bootstrap helpers
    init_tracing("signapps_docs");
    load_env();

    let config = ServiceConfig::from_env("signapps-docs", 3010);
    config.log_startup();

    // Initialize database
    let pool = signapps_db::create_pool(&config.database_url).await?;

    // Initialize cache
    let cache = Arc::new(CacheService::new(1000, Duration::from_secs(3600)));

    // Initialize JWT config
    let jwt_config = config.jwt_config();

    // Initialize app state
    let app_state = AppState {
        pool,
        cache,
        docs: Arc::new(dashmap::DashMap::new()),
        broadcasts: Arc::new(dashmap::DashMap::new()),
        indexer: AiIndexerClient::from_env(),
        jwt_config,
    };

    // Build router with document type endpoints
    // Public routes (no auth required)
    let public_routes = Router::new().route("/health", get(health_handler));

    // Protected routes (auth required)
    let protected_routes = Router::new()
        // WebSocket endpoint for real-time collaboration
        .route("/api/v1/docs/:doc_type/:doc_id/ws", get(websocket_handler))
        // y-websocket sends connections to /{base}/{roomname} without /ws suffix
        .route("/api/v1/docs/:doc_type/:doc_id", get(websocket_handler))

        // Document creation endpoints
        .route("/api/v1/docs/text", post(text::create_document))
        .route("/api/v1/docs/sheet", post(sheet::create_sheet))
        .route("/api/v1/docs/sheet/:doc_id/rows", get(sheet::get_rows))
        .route("/api/v1/docs/slide", post(slide::create_presentation))
        .route("/api/v1/docs/slide/:doc_id/slides", get(slide::get_slides))
        .route("/api/v1/docs/board", post(board::create_board))
        .route("/api/v1/docs/board/:doc_id/columns", get(board::get_columns))
        // Chat channels
        .route("/api/v1/docs/chat", post(chat::create_channel))
        .route("/api/v1/channels", get(chat::get_channels))
        .route("/api/v1/channels/:channel_id", get(chat::get_channel))
        .route("/api/v1/channels/:channel_id", put(chat::update_channel))
        .route("/api/v1/channels/:channel_id", delete(chat::delete_channel))
        // Channel members
        .route("/api/v1/channels/:channel_id/members", get(chat::get_channel_members))
        .route("/api/v1/channels/:channel_id/members", post(chat::add_channel_member))
        .route("/api/v1/channels/:channel_id/members/:user_id", delete(chat::remove_channel_member))
        // Direct messages
        .route("/api/v1/dms", get(chat::get_direct_messages))
        .route("/api/v1/dms", post(chat::create_direct_message))
        .route("/api/v1/dms/:id", delete(chat::delete_direct_message))
        // Channel read status (unread counts)
        .route("/api/v1/channels/:channel_id/read-status", get(chat::get_channel_read_status))
        .route("/api/v1/channels/:channel_id/read-status", post(chat::mark_channel_read))
        .route("/api/v1/channels/:channel_id/increment-unread", post(chat::increment_unread_count))
        .route("/api/v1/unread-counts", get(chat::get_all_unread_counts))

        // Document templates
        .route("/api/v1/docs/templates", get(list_templates))
        .route("/api/v1/docs/templates", post(create_template))
        .route("/api/v1/docs/templates/:id", get(get_template))
        .route("/api/v1/docs/templates/:id", delete(delete_template))
        // Sheet macros
        .route("/api/v1/docs/:doc_id/macros", get(list_macros))
        .route("/api/v1/docs/:doc_id/macros", post(create_macro))
        .route("/api/v1/docs/:doc_id/macros/:macro_id", put(update_macro))
        .route("/api/v1/docs/:doc_id/macros/:macro_id", delete(delete_macro))
        // Design files
        .route("/api/v1/designs", get(list_designs))
        .route("/api/v1/designs", post(create_design))
        .route("/api/v1/designs/:id", get(get_design))
        .route("/api/v1/designs/:id", put(update_design))
        .route("/api/v1/designs/:id", delete(delete_design))
        // Document classification (IDEA-106)
        .route("/api/v1/docs/classify", post(classify_document))
        // Quick notes (Drive sidebar)
        .route("/api/v1/keep/notes", get(list_notes))
        .route("/api/v1/keep/notes", post(create_note))
        .route("/api/v1/keep/notes/:id", put(update_note))
        .route("/api/v1/keep/notes/:id", delete(delete_note))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            auth_middleware::<AppState>,
        ));

    let app = public_routes
        .merge(protected_routes)
        // Global middleware
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::new()
            .allow_origin(AllowOrigin::list([
                "http://localhost:3000".parse().expect("valid origin"),
                "http://127.0.0.1:3000".parse().expect("valid origin"),
            ]))
            .allow_credentials(true)
            .allow_methods([axum::http::Method::GET, axum::http::Method::POST, axum::http::Method::PUT, axum::http::Method::PATCH, axum::http::Method::DELETE, axum::http::Method::OPTIONS])
            .allow_headers([axum::http::header::CONTENT_TYPE, axum::http::header::AUTHORIZATION, axum::http::header::ACCEPT, axum::http::header::ORIGIN, axum::http::HeaderName::from_static("x-workspace-id"), axum::http::HeaderName::from_static("x-request-id")]))
        .layer(axum::extract::DefaultBodyLimit::max(100 * 1024 * 1024)) // 100MB for large docs
        // State
        .with_state(app_state);

    // Run server
    tracing::info!("🎨 signapps-docs ready (Text, Sheet, Slide, Board)");

    let addr: std::net::SocketAddr = format!("{}:{}", config.host, config.port)
        .parse()
        .expect("server address is valid");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!(
        "✅ signapps-docs listening at http://localhost:{}",
        config.port
    );
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(signapps_common::graceful_shutdown())
    .await?;
    Ok(())
}
