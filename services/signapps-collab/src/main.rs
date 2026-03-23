use crate::models::BroadcastMessage;
use axum::{routing::get, Router};
use signapps_cache::CacheService;
use signapps_common::auth::JwtConfig;
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::{
    auth_middleware, logging_middleware, optional_auth_middleware, request_id_middleware,
};
use signapps_db::DatabasePool;
use std::{net::SocketAddr, sync::Arc};
use tokio::sync::broadcast;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

mod handlers;
mod models;
mod utils;

use handlers::health::health_handler;
use handlers::websocket::websocket_handler;
use signapps_common::AiIndexerClient;

#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub jwt_config: JwtConfig,
    pub cache: Arc<CacheService>,
    pub docs: Arc<dashmap::DashMap<String, yrs::Doc>>,
    pub channels: Arc<dashmap::DashMap<String, broadcast::Sender<BroadcastMessage>>>,
    pub indexer: AiIndexerClient,
}

impl signapps_common::middleware::AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize using bootstrap helpers
    init_tracing("signapps_collab");
    load_env();

    let config = ServiceConfig::from_env("signapps-collab", 3013);
    config.log_startup();

    // Initialize database
    let pool = signapps_db::create_pool(&config.database_url).await?;

    // Create JWT config (custom: audience="signapps" for all services)
    let jwt_config = JwtConfig {
        secret: config.jwt_secret.clone(),
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
        indexer: AiIndexerClient::from_env(),
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
        .layer(CorsLayer::new()
            .allow_origin(AllowOrigin::list([
                "http://localhost:3000".parse().unwrap(),
                "http://127.0.0.1:3000".parse().unwrap(),
            ]))
            .allow_credentials(true)
            .allow_methods([axum::http::Method::GET, axum::http::Method::POST, axum::http::Method::PUT, axum::http::Method::PATCH, axum::http::Method::DELETE, axum::http::Method::OPTIONS])
            .allow_headers([axum::http::header::CONTENT_TYPE, axum::http::header::AUTHORIZATION, axum::http::header::ACCEPT, axum::http::header::ORIGIN]))
        .layer(axum::middleware::from_fn_with_state(app_state.clone(), optional_auth_middleware::<AppState>))

        // State
        .with_state(app_state);

    // Run server
    tracing::info!("🤝 signapps-collab ready");

    let addr: std::net::SocketAddr = format!("{}:{}", config.host, config.port).parse().unwrap();
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!(
        "✅ signapps-collab ready at http://localhost:{}",
        config.port
    );
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;
    Ok(())
}
