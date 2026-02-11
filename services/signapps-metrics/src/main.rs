//! SignApps Metrics Service - System Monitoring
//!
//! This service provides system monitoring including:
//! - CPU, memory, disk, network metrics
//! - Prometheus export endpoint
//! - Health checks
//! - Summary dashboard data

use axum::{
    routing::{delete, get, post, put},
    Router,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod handlers;
mod metrics;

use metrics::{MetricsCollector, PrometheusExporter};
use signapps_common::middleware::AuthState;
use signapps_common::{JwtConfig, Result};
use signapps_db::DatabasePool;

/// Application state.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub collector: MetricsCollector,
    pub exporter: Arc<PrometheusExporter>,
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
            port: std::env::var("SERVER_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3008),
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "signapps_metrics=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load .env file
    dotenvy::dotenv().ok();

    // Load configuration
    let config = Config::from_env();

    tracing::info!("Starting SignApps Metrics Service on port {}", config.port);

    // Create database pool
    let pool = signapps_db::create_pool(&config.database_url).await?;

    // Create metrics collector
    let collector = MetricsCollector::new();

    // Create Prometheus exporter
    let exporter = Arc::new(PrometheusExporter::new(collector.clone()));

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
        collector,
        exporter,
        jwt_config,
    };

    // Build router
    let app = create_router(state);

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    tracing::info!("Metrics service listening on {}", addr);

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

    // Metrics routes
    let metrics_routes = Router::new()
        .route("/", get(handlers::get_all_metrics))
        .route("/summary", get(handlers::get_summary))
        .route("/cpu", get(handlers::get_cpu_metrics))
        .route("/memory", get(handlers::get_memory_metrics))
        .route("/disk", get(handlers::get_disk_metrics))
        .route("/network", get(handlers::get_network_metrics))
        .route("/stream", get(handlers::metrics_stream));

    // Alert routes
    let alert_routes = Router::new()
        .route("/", get(handlers::alerts::list_alerts))
        .route("/", post(handlers::alerts::create_alert))
        .route("/active", get(handlers::alerts::get_active_alerts))
        .route("/events", get(handlers::alerts::list_alert_events))
        .route("/:id", get(handlers::alerts::get_alert))
        .route("/:id", put(handlers::alerts::update_alert))
        .route("/:id", delete(handlers::alerts::delete_alert))
        .route(
            "/:id/acknowledge",
            post(handlers::alerts::acknowledge_alert),
        );

    // Prometheus endpoint
    let prometheus_routes = Router::new().route("/", get(handlers::prometheus_metrics));

    // Health check
    let health_routes = Router::new().route("/", get(handlers::health_check));

    // Combine all routes
    Router::new()
        .nest("/api/v1/metrics", metrics_routes)
        .nest("/api/v1/alerts", alert_routes)
        .nest("/metrics", prometheus_routes)
        .nest("/health", health_routes)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
