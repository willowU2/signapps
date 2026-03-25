//! SignApps Metrics Service - System Monitoring
//!
//! This service provides system monitoring including:
//! - CPU, memory, disk, network metrics
//! - Prometheus export endpoint
//! - Health checks
//! - Summary dashboard data

use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use std::sync::Arc;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

mod handlers;
mod metrics;

use metrics::{MetricsCollector, PrometheusExporter};
use signapps_common::middleware::{auth_middleware, require_admin, AuthState};
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

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize using bootstrap helpers
    init_tracing("signapps_metrics");
    load_env();

    let config = ServiceConfig::from_env("signapps-metrics", 3008);
    config.log_startup();

    // Create database pool
    let pool = signapps_db::create_pool(&config.database_url).await?;

    // Create metrics collector
    let collector = MetricsCollector::new();

    // Create Prometheus exporter
    let exporter = Arc::new(PrometheusExporter::new(collector.clone()));

    // Create JWT config (custom: audience="signapps" for all services)
    let jwt_config = JwtConfig {
        secret: config.jwt_secret.clone(),
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
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

    // Start server using bootstrap helper
    signapps_common::bootstrap::run_server(app, &config).await?;

    Ok(())
}

fn create_router(state: AppState) -> Router {
    // CORS configuration
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            "http://localhost:3000".parse().unwrap(),
            "http://127.0.0.1:3000".parse().unwrap(),
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
            axum::http::header::ORIGIN, axum::http::HeaderName::from_static("x-workspace-id"), axum::http::HeaderName::from_static("x-request-id"),
        ]);

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

    // Admin analytics routes
    let analytics_routes = Router::new()
        .route("/overview", get(handlers::analytics::get_overview))
        .route("/storage", get(handlers::analytics::get_storage))
        .route("/activity", get(handlers::analytics::get_activity));

    // Prometheus endpoint
    let prometheus_routes = Router::new().route("/", get(handlers::prometheus_metrics));

    // Health check
    let health_routes = Router::new().route("/", get(handlers::health_check));

    // Public routes (no auth required)
    let public_routes = Router::new()
        .nest("/health", health_routes)
        .nest("/metrics", prometheus_routes);

    // Protected routes (auth required)
    let protected_routes = Router::new()
        .nest("/api/v1/system", metrics_routes)
        .nest("/api/v1/alerts", alert_routes)
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Admin routes (auth + admin role required)
    let admin_routes = Router::new()
        .nest("/api/v1/admin/analytics", analytics_routes)
        .layer(middleware::from_fn(require_admin))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Combine all routes
    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .merge(admin_routes)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
