use axum::{
    routing::{get, post},
    Router,
};
use signapps_cache::CacheService;
use std::sync::Arc;
use std::net::SocketAddr;
use std::time::Duration;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::info;

mod handlers;
mod models;
mod utils;

use handlers::health::health_handler;
use handlers::websocket::websocket_handler;
use handlers::types::{text, sheet, slide, board};

#[derive(Clone)]
pub struct AppState {
    pub pool: signapps_db::DatabasePool,
    pub cache: Arc<CacheService>,
    pub docs: Arc<dashmap::DashMap<String, yrs::Doc>>,
    // Broadcast channels per document (key: "type::doc_id")
    pub broadcasts: Arc<dashmap::DashMap<String, tokio::sync::broadcast::Sender<Vec<u8>>>>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Get configuration from environment
    let server_port = std::env::var("SERVER_PORT")
        .unwrap_or_else(|_| "3010".to_string())
        .parse::<u16>()?;

    // Initialize database
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:password@localhost:5432/signapps".to_string());
    let pool = signapps_db::create_pool(&database_url).await?;

    // Initialize cache
    let cache = Arc::new(CacheService::new(1000, Duration::from_secs(3600)));

    // Initialize app state
    let app_state = AppState {
        pool,
        cache,
        docs: Arc::new(dashmap::DashMap::new()),
        broadcasts: Arc::new(dashmap::DashMap::new()),
    };

    // Build router with document type endpoints
    let app = Router::new()
        // Health check
        .route("/health", get(health_handler))

        // WebSocket endpoint for real-time collaboration
        .route("/api/v1/docs/:doc_type/:doc_id/ws", get(websocket_handler))

        // Document creation endpoints
        .route("/api/v1/docs/text", post(text::create_document))
        .route("/api/v1/docs/sheet", post(sheet::create_sheet))
        .route("/api/v1/docs/sheet/:doc_id/rows", get(sheet::get_rows))
        .route("/api/v1/docs/slide", post(slide::create_presentation))
        .route("/api/v1/docs/slide/:doc_id/slides", get(slide::get_slides))
        .route("/api/v1/docs/board", post(board::create_board))
        .route("/api/v1/docs/board/:doc_id/columns", get(board::get_columns))

        // Global middleware
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())

        // State
        .with_state(app_state);

    // Run server
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", server_port))
        .await?;

    info!(
        "🎨 signapps-docs listening on port {} (Text, Sheet, Slide, Board)",
        server_port
    );

    let serve = axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    );

    serve.await?;

    Ok(())
}
