//! SignApps Containers Service
//!
//! Docker container lifecycle management service.
//! Provides APIs for creating, managing, and monitoring containers.

mod backup;
mod docker;
mod handlers;
mod store;

use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use dashmap::DashMap;
use handlers::openapi::ContainersApiDoc;
use signapps_common::bootstrap::{env_or, init_tracing_with_filter, load_env, ServiceConfig};
use signapps_common::middleware::{
    auth_middleware, logging_middleware, request_id_middleware, require_admin, AuthState,
};
use signapps_common::{AiIndexerClient, JwtConfig};
use signapps_db::{create_pool, DatabasePool};
use std::sync::Arc;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use docker::DockerClient;
use store::types::InstallEvent;
use store::StoreManager;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize using bootstrap helpers (custom filter for bollard)
    init_tracing_with_filter(
        "info,signapps=debug,signapps_containers=debug,bollard=warn,sqlx=warn,tower_http=debug",
    );
    load_env();

    let config = ServiceConfig::from_env("signapps-containers", 3002);
    config.log_startup();

    // Create database pool
    let pool = create_pool(&config.database_url).await?;

    // Create Docker client
    let docker = DockerClient::new()?;

    // Verify Docker connection
    docker.ping().await?;
    let version = docker.version().await?;
    tracing::info!(
        docker_version = version.version.as_deref().unwrap_or("unknown"),
        "Connected to Docker"
    );

    // Create JWT config (custom: audience="signapps" for all services)
    let jwt_config = JwtConfig {
        secret: config.jwt_secret.clone(),
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
        access_expiration: 900,
        refresh_expiration: 604800,
    };

    // Create store manager
    let store = StoreManager::new(pool.clone());

    let app_data_path = env_or("APP_DATA_PATH", "C:/Prog/signapps-data/apps");

    // Create application state
    let state = AppState {
        pool,
        docker,
        jwt_secret: config.jwt_secret.clone(),
        jwt_config,
        store,
        app_data_path,
        install_channels: Arc::new(DashMap::new()),
        indexer: AiIndexerClient::from_env(),
    };

    // Refresh app store catalog in background
    let store_clone = state.store.clone();
    tokio::spawn(async move {
        store_clone.refresh_sources().await;
    });

    // Spawn auto-update background task
    let docker_clone = state.docker.clone();
    let pool_clone = state.pool.clone();
    tokio::spawn(async move {
        handlers::updates::run_auto_update_task(docker_clone, pool_clone).await;
    });

    // Spawn backup scheduler background task
    let backup_pool = state.pool.clone();
    tokio::spawn(async move {
        backup::service::run_backup_scheduler(backup_pool).await;
    });

    // Build router
    let app = create_router(state);

    // Start server using bootstrap helper
    signapps_common::bootstrap::run_server(app, &config).await
}

/// Application state shared across handlers.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub docker: DockerClient,
    pub jwt_secret: String,
    pub jwt_config: JwtConfig,
    pub store: StoreManager,
    pub app_data_path: String,
    pub install_channels: Arc<DashMap<uuid::Uuid, tokio::sync::broadcast::Sender<InstallEvent>>>,
    pub indexer: AiIndexerClient,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

/// Create the main router with all routes.
fn create_router(state: AppState) -> Router {
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

    // Public routes
    let public_routes = Router::new().route("/health", get(handlers::health::health_check));

    // Protected routes (auth required)
    let protected_routes = Router::new()
        .route("/api/v1/containers", get(handlers::containers::list).post(handlers::containers::create))
        // Docker-direct routes (for containers without DB records)
        .route(
            "/api/v1/containers/docker/:docker_id/start",
            post(handlers::containers::start_docker),
        )
        .route(
            "/api/v1/containers/docker/:docker_id/stop",
            post(handlers::containers::stop_docker),
        )
        .route(
            "/api/v1/containers/docker/:docker_id/restart",
            post(handlers::containers::restart_docker),
        )
        .route(
            "/api/v1/containers/docker/:docker_id",
            delete(handlers::containers::remove_docker),
        )
        .route(
            "/api/v1/containers/docker/:docker_id/logs",
            get(handlers::containers::logs_docker),
        )
        .route(
            "/api/v1/containers/docker/:docker_id/stats",
            get(handlers::containers::stats_docker),
        )
        .route(
            "/api/v1/containers/docker/:docker_id/inspect",
            get(handlers::containers::inspect_docker),
        )
        .route("/api/v1/containers/:id", get(handlers::containers::get))
        .route(
            "/api/v1/containers/:id/start",
            post(handlers::containers::start),
        )
        .route(
            "/api/v1/containers/:id/stop",
            post(handlers::containers::stop),
        )
        .route(
            "/api/v1/containers/:id/restart",
            post(handlers::containers::restart),
        )
        .route(
            "/api/v1/containers/:id/update",
            post(handlers::containers::update),
        )
        .route(
            "/api/v1/containers/:id/logs",
            get(handlers::containers::logs),
        )
        .route(
            "/api/v1/containers/:id/stats",
            get(handlers::containers::stats),
        )
        .route(
            "/api/v1/containers/:id",
            delete(handlers::containers::delete),
        )
        // App Store
        .route("/api/v1/store/apps", get(handlers::store::list_apps))
        .route(
            "/api/v1/store/sources/:source_id/apps/:app_id/details",
            get(handlers::store::get_app_details),
        )
        .route("/api/v1/store/install", post(handlers::store::install_app))
        .route(
            "/api/v1/store/install-multi",
            post(handlers::store::install_multi),
        )
        .route(
            "/api/v1/store/install/:id/progress",
            get(handlers::store::install_progress),
        )
        .route(
            "/api/v1/store/check-ports",
            get(handlers::store::check_ports),
        )
        .route("/api/v1/store/sources", get(handlers::store::list_sources))
        // Compose import
        .route(
            "/api/v1/compose/preview",
            post(handlers::compose::preview_compose),
        )
        .route(
            "/api/v1/compose/import",
            post(handlers::compose::import_compose),
        )
        // Updates
        .route(
            "/api/v1/containers/:id/check-update",
            post(handlers::updates::check_update),
        )
        .route(
            "/api/v1/containers/:id/auto-update",
            put(handlers::updates::set_auto_update),
        )
        .route(
            "/api/v1/updates/status",
            get(handlers::updates::updates_status),
        )
        // Backups
        .route(
            "/api/v1/backups",
            get(handlers::backups::list_profiles).post(handlers::backups::create_profile),
        )
        .route(
            "/api/v1/backups/:id",
            get(handlers::backups::get_profile)
                .put(handlers::backups::update_profile)
                .delete(handlers::backups::delete_profile),
        )
        .route(
            "/api/v1/backups/:id/run",
            post(handlers::backups::run_backup),
        )
        .route(
            "/api/v1/backups/:id/snapshots",
            get(handlers::backups::list_snapshots),
        )
        .route(
            "/api/v1/backups/:id/restore",
            post(handlers::backups::restore_snapshot),
        )
        .route(
            "/api/v1/backups/:id/runs",
            get(handlers::backups::list_runs),
        )
        // User's quota
        .route("/api/v1/quotas/me", get(handlers::quotas::get_my_quota))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Admin routes
    let admin_routes = Router::new()
        // Images
        .route("/api/v1/images", get(handlers::images::list))
        .route("/api/v1/images/pull", post(handlers::images::pull))
        .route("/api/v1/images/:id", delete(handlers::images::delete))
        .route(
            "/api/v1/images/:id/force",
            delete(handlers::images::force_delete),
        )
        // Store sources (admin)
        .route(
            "/api/v1/store/sources",
            post(handlers::store::add_source),
        )
        .route(
            "/api/v1/store/sources/validate",
            post(handlers::store::validate_source),
        )
        .route(
            "/api/v1/store/sources/refresh",
            post(handlers::store::refresh_all),
        )
        .route(
            "/api/v1/store/sources/:id",
            delete(handlers::store::delete_source),
        )
        .route(
            "/api/v1/store/sources/:id/refresh",
            post(handlers::store::refresh_source),
        )
        // Networks
        .route("/api/v1/networks", get(handlers::networks::list_networks))
        // Volumes
        .route("/api/v1/volumes", get(handlers::networks::list_volumes))
        // User quotas (admin)
        .route(
            "/api/v1/users/:user_id/quotas",
            get(handlers::quotas::get_user_quota).put(handlers::quotas::update_user_quota),
        )
        .route(
            "/api/v1/users/:user_id/containers",
            get(handlers::containers::list_by_user),
        )
        .layer(middleware::from_fn(require_admin))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    let openapi_routes =
        SwaggerUi::new("/swagger-ui").url("/api/v1/openapi.json", ContainersApiDoc::openapi());

    // Combine all routes
    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .merge(admin_routes)
        .merge(openapi_routes)
        .layer(middleware::from_fn(logging_middleware))
        .layer(middleware::from_fn(request_id_middleware))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
