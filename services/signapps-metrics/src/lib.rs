//! Public library interface for signapps-metrics.
//!
//! Exposes [`router`] so the single-binary runtime can mount the
//! monitoring/metrics routes (system metrics, Prometheus export, alerts,
//! analytics, status page) without owning its own pool.

// Pre-existing test scaffolding patterns inherited from when this crate
// was bin-only (compiled as `--bin` so `--tests` never reached the
// per-handler `mod tests`). Allowed at the lib level rather than
// rewriting every handler stub.
#![allow(clippy::assertions_on_constants)]

pub mod handlers;
pub mod metrics;

use std::sync::Arc;

use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use signapps_common::middleware::{auth_middleware, require_admin, AuthState};
use signapps_common::JwtConfig;
use signapps_db::DatabasePool;
use signapps_service::shared_state::SharedState;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

use metrics::{MetricsCollector, PrometheusExporter};

/// Application state for the metrics service.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub collector: MetricsCollector,
    pub exporter: Arc<PrometheusExporter>,
    pub jwt_config: JwtConfig,
    /// Shared RBAC resolver injected by the runtime. `None` in tests.
    pub resolver: Option<Arc<dyn signapps_common::rbac::resolver::OrgPermissionResolver>>,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

/// Build the metrics router using the shared runtime state.
///
/// # Errors
///
/// Returns an error if shared-state cloning fails (none currently, but reserved).
pub async fn router(shared: SharedState) -> anyhow::Result<Router> {
    let state = build_state(&shared).await?;
    Ok(create_router(state))
}

async fn build_state(shared: &SharedState) -> anyhow::Result<AppState> {
    let collector = MetricsCollector::new();
    let exporter = Arc::new(PrometheusExporter::new(collector.clone()));

    Ok(AppState {
        pool: shared.pool.clone(),
        collector,
        exporter,
        jwt_config: (*shared.jwt).clone(),
        resolver: shared.resolver.clone(),
    })
}

fn create_router(state: AppState) -> Router {
    // CORS configuration
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            "http://localhost:3000".parse().expect("valid CORS origin"),
            "http://127.0.0.1:3000".parse().expect("valid CORS origin"),
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
            axum::http::header::ORIGIN,
            axum::http::HeaderName::from_static("x-workspace-id"),
            axum::http::HeaderName::from_static("x-request-id"),
        ]);

    // Metrics routes
    let metrics_routes = Router::new()
        .route("/", get(handlers::get_all_metrics))
        .route("/summary", get(handlers::get_summary))
        .route("/cpu", get(handlers::get_cpu_metrics))
        .route("/memory", get(handlers::get_memory_metrics))
        .route("/disk", get(handlers::get_disk_metrics))
        .route("/network", get(handlers::get_network_metrics))
        .route("/stream", get(handlers::metrics_stream))
        // IF2: Slow query monitoring
        .route("/slow-queries", get(handlers::slow_queries::list_slow_queries))
        // IF3: DB pool stats
        .route("/pool-stats", get(handlers::pool_stats::get_pool_stats));

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
        .nest("/metrics", prometheus_routes)
        .merge(signapps_common::version::router("signapps-metrics"));

    // A/B Testing Experiments routes
    let experiment_routes = Router::new()
        .route(
            "/api/v1/experiments",
            get(handlers::experiments::list_experiments)
                .post(handlers::experiments::create_experiment),
        )
        .route(
            "/api/v1/experiments/:id",
            put(handlers::experiments::update_experiment)
                .delete(handlers::experiments::delete_experiment),
        );

    // ESG routes
    let esg_routes = Router::new()
        .route(
            "/api/v1/esg/scores",
            get(handlers::esg::get_esg_scores).put(handlers::esg::upsert_esg_score),
        )
        .route(
            "/api/v1/esg/quarterly",
            get(handlers::esg::get_esg_quarterly).put(handlers::esg::upsert_esg_quarterly),
        );

    // Status page routes (auth required — read endpoints)
    let status_routes = Router::new()
        .route(
            "/api/v1/status/services",
            get(handlers::status::list_services),
        )
        .route("/api/v1/status/history", get(handlers::status::get_history))
        .route(
            "/api/v1/status/incidents",
            get(handlers::status::list_incidents),
        );

    // Protected routes (auth required)
    let protected_routes = Router::new()
        .nest("/api/v1/system", metrics_routes)
        .nest("/api/v1/alerts", alert_routes)
        .merge(experiment_routes)
        .merge(esg_routes)
        .merge(status_routes)
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // API quota routes (admin-protected)
    let quota_routes = Router::new()
        .route(
            "/api/v1/metrics/api-quota",
            get(handlers::api_quota::list_api_quotas),
        )
        .route(
            "/api/v1/metrics/api-quota/:user_id",
            get(handlers::api_quota::get_user_api_quota),
        );

    // Admin routes (auth + admin role required)
    let admin_routes = Router::new()
        .nest("/api/v1/admin/analytics", analytics_routes)
        .merge(quota_routes)
        // Status incidents — admin only for creation
        .route("/api/v1/status/incidents", post(handlers::status::create_incident))
        .layer(middleware::from_fn(require_admin))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Combine all routes
    Router::new()
        .merge(handlers::openapi::swagger_router())
        .merge(public_routes)
        .merge(protected_routes)
        .merge(admin_routes)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
