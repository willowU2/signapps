use axum::{
    routing::{delete, get, post, put},
    Router,
};
use signapps_cache::CacheService;
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

mod handlers;
mod models;
mod utils;

use handlers::health::health_handler;
use handlers::types::{board, chat, sheet, slide, text};
use handlers::websocket::websocket_handler;
use signapps_common::AiIndexerClient;

#[derive(Clone)]
pub struct AppState {
    pub pool: signapps_db::DatabasePool,
    pub cache: Arc<CacheService>,
    pub docs: Arc<dashmap::DashMap<String, yrs::Doc>>,
    pub broadcasts: Arc<dashmap::DashMap<String, tokio::sync::broadcast::Sender<Vec<u8>>>>,
    pub indexer: AiIndexerClient,
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

    // Initialize app state
    let app_state = AppState {
        pool,
        cache,
        docs: Arc::new(dashmap::DashMap::new()),
        broadcasts: Arc::new(dashmap::DashMap::new()),
        indexer: AiIndexerClient::from_env(),
    };

    // Build router with document type endpoints
    let app = Router::new()
        // Health check
        .route("/health", get(health_handler))

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

        // Global middleware
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())

        // State
        .with_state(app_state);

    // Run server
    tracing::info!("🎨 signapps-docs ready (Text, Sheet, Slide, Board)");

    let addr: std::net::SocketAddr = format!("{}:{}", config.host, config.port).parse().unwrap();
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("✅ signapps-docs listening at http://localhost:{}", config.port);
    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>()).await?;
    Ok(())
}
