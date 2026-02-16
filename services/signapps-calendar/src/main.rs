//! SignApps Calendar Service
//! Manages shared calendars, events, recurring meetings, and tasks with hierarchical support

use axum::{
    extract::DefaultBodyLimit,
    http::StatusCode,
    routing::get,
    Extension, Router,
};
use signapps_db::{create_pool, run_migrations};
use std::sync::Arc;
use tower_http::trace::TraceLayer;
use tracing::info;

mod error;
pub use error::CalendarError;

// Services and handlers will be added in Phase 2
// mod handlers;
// mod services;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    info!("Starting signapps-calendar service");

    // Get configuration
    dotenvy::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:password@localhost:5432/signapps".to_string());
    let server_port = std::env::var("SERVER_PORT")
        .unwrap_or_else(|_| "3011".to_string())
        .parse::<u16>()?;

    // Initialize database
    let pool = create_pool(&database_url).await?;
    run_migrations(&pool).await?;

    info!("Database initialized successfully");

    // Build router
    let app = build_router(Arc::new(pool));

    // Start server
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", server_port)).await?;
    info!("Calendar service listening on port {}", server_port);

    axum::serve(listener, app).await?;
    Ok(())
}

fn build_router(pool: Arc<signapps_db::DatabasePool>) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .layer(DefaultBodyLimit::max(100 * 1024 * 1024))  // 100MB
        .layer(TraceLayer::new_for_http())
        .layer(Extension(pool))
}

async fn health_check() -> StatusCode {
    StatusCode::OK
}
