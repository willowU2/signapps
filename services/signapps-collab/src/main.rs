use axum::{
    extract::ConnectInfo,
    routing::get,
    Router,
};
use signapps_common::middleware::{
    auth_middleware,
    logging_middleware,
    request_id_middleware,
};
use signapps_db::create_pool;
use signapps_cache::CacheService;
use std::sync::Arc;
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::info;

mod handlers;
mod models;
mod utils;

use handlers::websocket::websocket_handler;
use handlers::health::health_handler;

#[derive(Clone)]
pub struct AppState {
    pub pool: sqlx::PgPool,
    pub cache: Arc<CacheService>,
    pub docs: Arc<dashmap::DashMap<String, yrs::Doc>>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Get configuration from environment
    let server_port = std::env::var("SERVER_PORT")
        .unwrap_or_else(|_| "3010".to_string())
        .parse::<u16>()?;

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:password@localhost:5432/signapps".to_string());

    // Initialize database
    let pool = create_pool(&database_url).await?;

    info!("Running migrations...");
    signapps_db::run_migrations(&pool).await?;

    // Initialize cache
    let cache = Arc::new(CacheService::new());

    // Initialize app state
    let app_state = AppState {
        pool: pool.clone(),
        cache,
        docs: Arc::new(dashmap::DashMap::new()),
    };

    // Build router
    let app = Router::new()
        // Health check
        .route("/health", get(health_handler))

        // WebSocket endpoint for collaborative editing
        .route("/api/v1/collab/ws/:doc_id",
            get(websocket_handler)
                .layer(axum::middleware::from_fn(auth_middleware))
        )

        // Global middleware
        .layer(request_id_middleware())
        .layer(logging_middleware())
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .layer(axum::middleware::from_fn(signapps_common::middleware::optional_auth_middleware))

        // State
        .with_state(app_state)
        .into_make_service_with_connect_info::<SocketAddr>();

    // Run server
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", server_port))
        .await?;

    info!(
        "🤝 signapps-collab listening on port {}",
        server_port
    );

    axum::serve(listener, app)
        .with_connect_info::<SocketAddr>()
        .await?;

    Ok(())
}
