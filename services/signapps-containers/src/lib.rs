//! Public library interface for signapps-containers.
//!
//! Exposes [`router`] so the single-binary runtime (`signapps-platform`)
//! can mount the Docker container management routes (containers, images,
//! networks, volumes, app store, compose, backups, quotas) without owning
//! its own pool or JWT config.
//!
//! # Docker daemon discovery
//!
//! The bollard `Docker::connect_with_local_defaults()` call is lazy — it
//! only initialises connection parameters and never opens a socket. The
//! eager `Docker::ping()` check at startup is gated behind the
//! `CONTAINERS_ENABLED` env flag (default-on). Set `CONTAINERS_ENABLED=false`
//! in environments where Docker is not running (CI smoke tests, dev boxes
//! without Docker installed). When disabled, the `:3002` HTTP API still
//! serves and individual handlers will return 503 / 5xx if they need the
//! daemon.

#![allow(clippy::assertions_on_constants, clippy::new_without_default)]

pub mod backup;
pub mod docker;
pub mod handlers;
pub mod presets;
pub mod store;

use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use dashmap::DashMap;
use handlers::openapi::ContainersApiDoc;
use signapps_common::middleware::{
    auth_middleware, logging_middleware, request_id_middleware, require_admin, AuthState,
};
use signapps_common::{AiIndexerClient, JwtConfig};
use signapps_db::DatabasePool;
use signapps_service::shared_state::SharedState;
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

/// Application state shared across containers handlers.
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

/// Build the containers router using the shared runtime state. Spawns
/// the store-source refresh, auto-update, and backup-scheduler background
/// tasks tied to the factory scope.
///
/// # Errors
///
/// Returns an error if the bollard `Docker::connect_with_local_defaults()`
/// call fails to initialise connection parameters (extremely rare —
/// typically only when the env is unconfigurable). Daemon-down errors
/// surface at handler-call time, not here.
pub async fn router(shared: SharedState) -> anyhow::Result<Router> {
    let state = build_state(&shared).await?;

    // Best-effort eager ping — gated behind CONTAINERS_ENABLED so the
    // single-binary boots cleanly when Docker isn't running.
    let containers_enabled = std::env::var("CONTAINERS_ENABLED")
        .ok()
        .map(|v| !v.eq_ignore_ascii_case("false") && v != "0")
        .unwrap_or(true);

    if containers_enabled {
        match state.docker.ping().await {
            Ok(()) => match state.docker.version().await {
                Ok(version) => tracing::info!(
                    docker_version = version.version.as_deref().unwrap_or("unknown"),
                    "Connected to Docker"
                ),
                Err(e) => tracing::warn!(?e, "Docker version probe failed (non-fatal)"),
            },
            Err(e) => tracing::warn!(
                ?e,
                "Docker ping failed (non-fatal); container handlers will return 5xx"
            ),
        }
    } else {
        tracing::info!("CONTAINERS_ENABLED=false; skipping Docker probe");
    }

    // Refresh app store catalog in background.
    let store_clone = state.store.clone();
    tokio::spawn(async move {
        store_clone.refresh_sources().await;
    });

    // Auto-update background task.
    let docker_clone = state.docker.clone();
    let pool_clone = state.pool.clone();
    tokio::spawn(async move {
        handlers::updates::run_auto_update_task(docker_clone, pool_clone).await;
    });

    // Backup scheduler.
    let backup_pool = state.pool.clone();
    tokio::spawn(async move {
        backup::service::run_backup_scheduler(backup_pool).await;
    });

    Ok(create_router(state))
}

async fn build_state(shared: &SharedState) -> anyhow::Result<AppState> {
    let pool = shared.pool.clone();

    // Docker::connect_with_local_defaults() is lazy — it only sets
    // connection parameters. Daemon presence is verified later by the
    // gated ping inside `router()`.
    let docker = DockerClient::new()
        .map_err(|e| anyhow::anyhow!("Failed to initialise Docker client params: {e}"))?;

    let store = StoreManager::new(pool.clone());

    let app_data_path =
        std::env::var("APP_DATA_PATH").unwrap_or_else(|_| "C:/Prog/signapps-data/apps".to_string());

    // Reuse the shared JWT config — derive the legacy `jwt_secret` string
    // from the env (the field is kept for back-compat with handlers that
    // sign one-off tokens). When `JWT_SECRET` isn't set we fall back to
    // an empty string so the field can still be cloned; handlers that
    // actually need to sign should use `state.jwt_config` instead.
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_default();

    Ok(AppState {
        pool,
        docker,
        jwt_secret,
        jwt_config: (*shared.jwt).clone(),
        store,
        app_data_path,
        install_channels: Arc::new(DashMap::new()),
        indexer: AiIndexerClient::from_env(),
    })
}

/// Create the main router with all routes.
pub fn create_router(state: AppState) -> Router {
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

    let public_routes = Router::new()
        .route("/health", get(handlers::health::health_check))
        .merge(signapps_common::version::router("signapps-containers"));

    let protected_routes = Router::new()
        .route(
            "/api/v1/containers",
            get(handlers::containers::list).post(handlers::containers::create),
        )
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
        .route(
            "/api/v1/compose/preview",
            post(handlers::compose::preview_compose),
        )
        .route(
            "/api/v1/compose/import",
            post(handlers::compose::import_compose),
        )
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
        .route("/api/v1/quotas/me", get(handlers::quotas::get_my_quota))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    let admin_routes = Router::new()
        .route("/api/v1/images", get(handlers::images::list))
        .route("/api/v1/images/pull", post(handlers::images::pull))
        .route("/api/v1/images/:id", delete(handlers::images::delete))
        .route(
            "/api/v1/images/:id/force",
            delete(handlers::images::force_delete),
        )
        .route("/api/v1/store/sources", post(handlers::store::add_source))
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
        .route("/api/v1/networks", get(handlers::networks::list_networks))
        .route("/api/v1/volumes", get(handlers::networks::list_volumes))
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
