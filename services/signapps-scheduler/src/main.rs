//! SignApps Scheduler Service - CRON Job Management
//!
//! This service manages scheduled jobs including:
//! - Job CRUD operations
//! - CRON expression scheduling
//! - Job execution (host or container)
//! - Run history and statistics

use axum::{
    routing::{delete, get, post, put},
    Router,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod crawlers;
mod handlers;
mod scheduler;

use scheduler::SchedulerService;
use signapps_common::middleware::AuthState;
use signapps_common::{JwtConfig, Result};
use signapps_db::DatabasePool;

/// Application state.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub scheduler: SchedulerService,
    pub jwt_config: JwtConfig,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

/// Service configuration.
#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub jwt_issuer: String,
    pub jwt_audience: String,
    pub job_timeout_seconds: u64,
    pub port: u16,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://signapps:signapps@localhost/signapps".to_string()),
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "dev-secret-change-in-production".to_string()),
            jwt_issuer: std::env::var("JWT_ISSUER")
                .unwrap_or_else(|_| "signapps-identity".to_string()),
            jwt_audience: std::env::var("JWT_AUDIENCE").unwrap_or_else(|_| "signapps".to_string()),
            job_timeout_seconds: std::env::var("JOB_TIMEOUT_SECONDS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(300),
            port: std::env::var("SERVER_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3007),
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "signapps_scheduler=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load .env file
    dotenvy::dotenv().ok();

    // Load configuration
    let config = Config::from_env();

    tracing::info!(
        "Starting SignApps Scheduler Service on port {}",
        config.port
    );

    // Create database pool
    let pool = signapps_db::create_pool(&config.database_url).await?;

    // Create scheduler service
    let scheduler = SchedulerService::new(pool.clone(), config.job_timeout_seconds);

    // Start background scheduler
    let scheduler_clone = Arc::new(scheduler.clone());
    tokio::spawn(async move {
        scheduler_clone.start_scheduler().await;
    });

    // Start background unified RAG Ingestion loop
    let ingestion_pool = pool.clone();
    tokio::spawn(async move {
        crate::scheduler::ingestion::start_ingestion_loop(ingestion_pool).await;
    });

    // Create JWT config
    let jwt_config = JwtConfig {
        secret: config.jwt_secret,
        issuer: config.jwt_issuer,
        audience: config.jwt_audience,
        access_expiration: 3600,
        refresh_expiration: 86400 * 7,
    };

    // Create application state
    let state = AppState {
        pool,
        scheduler,
        jwt_config,
    };

    // Build router
    let app = create_router(state);

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    tracing::info!("Scheduler service listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

fn create_router(state: AppState) -> Router {
    // CORS configuration
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Job routes
    let job_routes = Router::new()
        .route("/", get(handlers::list_jobs))
        .route("/", post(handlers::create_job))
        .route("/stats", get(handlers::get_stats))
        .route("/running", get(handlers::get_running))
        .route("/cleanup", post(handlers::cleanup_runs))
        .route("/{id}", get(handlers::get_job))
        .route("/{id}", put(handlers::update_job))
        .route("/{id}", delete(handlers::delete_job))
        .route("/{id}/enable", post(handlers::enable_job))
        .route("/{id}/disable", post(handlers::disable_job))
        .route("/{id}/run", post(handlers::run_job))
        .route("/{id}/runs", get(handlers::get_job_runs));

    // Run routes
    let run_routes = Router::new().route("/{id}", get(handlers::get_run));

    // Health check
    let health_routes = Router::new().route("/", get(handlers::health_check));

    // Combine all routes
    Router::new()
        .nest("/api/v1/jobs", job_routes)
        .nest("/api/v1/runs", run_routes)
        .nest("/health", health_routes)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
