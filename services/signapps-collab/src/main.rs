use crate::models::BroadcastMessage;
use axum::{routing::get, Router};
use signapps_cache::CacheService;
use signapps_common::auth::JwtConfig;
use signapps_common::middleware::{
    auth_middleware, logging_middleware, optional_auth_middleware, request_id_middleware,
};
use signapps_db::{create_pool, DatabasePool};
use std::{net::SocketAddr, sync::Arc};
use tokio::sync::broadcast;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::info;

mod handlers;
mod models;
mod utils;

use handlers::health::health_handler;
use handlers::websocket::websocket_handler;

#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub jwt_config: JwtConfig,
    pub cache: Arc<CacheService>,
    pub docs: Arc<dashmap::DashMap<String, yrs::Doc>>,
    pub channels: Arc<dashmap::DashMap<String, broadcast::Sender<BroadcastMessage>>>,
}

impl signapps_common::middleware::AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Load .env file
    dotenvy::dotenv().ok();

    // Get configuration from environment
    let server_port = std::env::var("SERVER_PORT")
        .unwrap_or_else(|_| "3013".to_string())
        .parse::<u16>()?;

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:password@localhost:5432/signapps".to_string());

    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "dev_secret_change_in_production_32chars".to_string());

    // Initialize database
    let pool = create_pool(&database_url).await?;

    info!("Running migrations...");
    // signapps_db::run_migrations(&pool).await?;

    // Create JWT config
    let jwt_config = JwtConfig {
        secret: jwt_secret,
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
        access_expiration: 900,
        refresh_expiration: 604800,
    };

    // Initialize cache
    let cache = Arc::new(CacheService::new(
        1000,
        std::time::Duration::from_secs(3600),
    ));

    // Initialize app state
    let app_state = AppState {
        pool,
        jwt_config,
        cache,
        docs: Arc::new(dashmap::DashMap::new()),
        channels: Arc::new(dashmap::DashMap::new()),
    };

    // Build router
    let app = Router::new()
        // Health check
        .route("/health", get(health_handler))

        // WebSocket endpoint for collaborative editing
        .route("/api/v1/collab/ws/:doc_id",
            get(websocket_handler)
                .layer(axum::middleware::from_fn_with_state(app_state.clone(), auth_middleware::<AppState>))
        )

        // Global middleware
        .layer(axum::middleware::from_fn(request_id_middleware))
        .layer(axum::middleware::from_fn(logging_middleware))
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .layer(axum::middleware::from_fn_with_state(app_state.clone(), optional_auth_middleware::<AppState>))

        // State
        .with_state(app_state)
        .into_make_service_with_connect_info::<SocketAddr>();

    // Run server
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", server_port)).await?;

    info!("🤝 signapps-collab listening on port {}", server_port);

    axum::serve(listener, app).await?;

    Ok(())
}
