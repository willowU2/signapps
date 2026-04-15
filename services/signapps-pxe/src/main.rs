mod catalog;
mod dc;
mod dhcp_proxy;
mod handlers;
mod images;
mod models;
mod openapi;
mod tftp;

use axum::{
    routing::{delete, get, post},
    Router,
};
use signapps_common::auth::JwtConfig;
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::{
    logging_middleware, optional_auth_middleware, request_id_middleware,
};
use signapps_db::DatabasePool;
use tokio::sync::watch;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::services::ServeDir;
use tower_http::trace::TraceLayer;

#[derive(Clone)]
/// Application state for PXE + DC infrastructure service.
pub struct AppState {
    pub db: DatabasePool,
    pub jwt_config: JwtConfig,
}

impl signapps_common::middleware::AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

pub async fn health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "ok",
        "service": "signapps-pxe",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": signapps_common::healthz::uptime_seconds(),
        "app": {
            "id": "pxe",
            "label": "PXE Deploy",
            "description": "Déploiement réseau PXE + Domain Controller",
            "icon": "Server",
            "category": "Infrastructure",
            "color": "text-orange-600",
            "href": "/pxe",
            "port": 3016
        }
    }))
}

/// Health endpoint for the Domain Controller subsystem.
pub async fn dc_health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "ok",
        "service": "signapps-dc",
        "subsystem": "domain-controller",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing("signapps_pxe");
    load_env();

    let config = ServiceConfig::from_env("signapps-pxe", 3016);
    config.log_startup();

    // JWT config — auto-detects RS256 or HS256 from environment
    let jwt_config = JwtConfig::from_env();

    let db_pool = signapps_db::create_pool(&config.database_url).await?;
    let app_state = AppState {
        db: db_pool.clone(),
        jwt_config,
    };

    // Ensure HTTP boot directory exists
    let http_boot_dir = "data/pxe/httpboot";
    tokio::fs::create_dir_all(http_boot_dir).await?;
    tokio::fs::create_dir_all("data/pxe/tftpboot/images").await?;

    // Spawn TFTP server
    tokio::spawn(async move {
        if let Err(e) = tftp::start_tftp_server("data/pxe/tftpboot", 69).await {
            tracing::error!("TFTP Server failed: {}", e);
        }
    });

    // Spawn ProxyDHCP server (PX1)
    let proxy_config = dhcp_proxy::ProxyDhcpConfig::default();
    tokio::spawn(async move {
        if let Err(e) = dhcp_proxy::start_proxy_dhcp(proxy_config).await {
            tracing::warn!(
                "ProxyDHCP server not started (may need elevated privileges): {}",
                e
            );
        }
    });

    // Shutdown channel — shared with DC protocol listeners so they stop cleanly
    // when the main Axum server receives its shutdown signal.
    let (shutdown_tx, shutdown_rx) = watch::channel(false);

    // Spawn DC protocol listeners (LDAP, Kerberos KDC, NTP, AD sync, reconciliation).
    // Each listener is an independent tokio task; a listener failure is logged
    // but does NOT kill the PXE REST API — infrastructure is resilient.
    if let Err(e) = dc::spawn_dc_listeners(db_pool, shutdown_rx).await {
        tracing::warn!("DC listeners could not be started: {}", e);
    }

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/dc/health", get(dc_health_check))
        .merge(signapps_common::version::router("signapps-pxe"))
        .nest_service("/boot", ServeDir::new(http_boot_dir))
        .route("/api/v1/pxe/health", get(health_check))
        .route("/api/v1/dc/health", get(dc_health_check))
        // Profiles
        .route(
            "/api/v1/pxe/profiles",
            get(handlers::list_profiles).post(handlers::create_profile),
        )
        .route(
            "/api/v1/pxe/profiles/:id",
            get(handlers::get_profile)
                .put(handlers::update_profile)
                .delete(handlers::delete_profile),
        )
        // PX5: Profile post-deploy hooks
        .route(
            "/api/v1/pxe/profiles/:id/hooks",
            get(images::get_profile_hooks).put(images::update_profile_hooks),
        )
        // Assets
        .route(
            "/api/v1/pxe/assets",
            get(handlers::list_assets).post(handlers::register_asset),
        )
        .route(
            "/api/v1/pxe/assets/:id",
            get(handlers::get_asset)
                .put(handlers::update_asset)
                .delete(handlers::delete_asset),
        )
        // Boot script
        .route("/api/v1/pxe/boot.ipxe", get(handlers::generate_ipxe_script))
        // PX2: Image management
        .route(
            "/api/v1/pxe/images",
            get(images::list_images).post(images::upload_image),
        )
        .route(
            "/api/v1/pxe/images/:id",
            delete(images::delete_image),
        )
        // PX3: Template generation
        .route("/api/v1/pxe/templates/generate", post(images::generate_template))
        // PX4: Deployment progress
        .route("/api/v1/pxe/deployments", get(images::list_deployments))
        .route(
            "/api/v1/pxe/deployments/:mac/progress",
            post(images::update_deployment_progress),
        )
        // PX6: Golden image capture
        .route("/api/v1/pxe/images/capture", post(images::capture_golden_image))
        // Catalog: list and download OS images
        .route("/api/v1/pxe/catalog", get(catalog::list_catalog))
        .route(
            "/api/v1/pxe/catalog/:index/download",
            post(catalog::download_catalog_image),
        )
        .merge(openapi::swagger_router())
        .layer(axum::middleware::from_fn_with_state(
            app_state.clone(),
            optional_auth_middleware::<AppState>,
        ))
        .layer({
            let allowed_origins: Vec<axum::http::HeaderValue> =
                std::env::var("CORS_ALLOWED_ORIGINS")
                    .unwrap_or_else(|_| "http://localhost:3000,http://127.0.0.1:3000".to_string())
                    .split(',')
                    .filter_map(|s| s.trim().parse().ok())
                    .collect();
            CorsLayer::new()
                .allow_origin(AllowOrigin::list(allowed_origins))
                .allow_methods([
                    axum::http::Method::GET,
                    axum::http::Method::POST,
                    axum::http::Method::PUT,
                    axum::http::Method::DELETE,
                    axum::http::Method::PATCH,
                    axum::http::Method::OPTIONS,
                ])
                .allow_headers([
                    axum::http::header::CONTENT_TYPE,
                    axum::http::header::AUTHORIZATION,
                    axum::http::HeaderName::from_static("x-request-id"),
                    axum::http::HeaderName::from_static("x-workspace-id"),
                ])
                .allow_credentials(true)
        })
        .layer(TraceLayer::new_for_http())
        .layer(axum::middleware::from_fn(logging_middleware))
        .layer(axum::middleware::from_fn(request_id_middleware))
        .with_state(app_state);

    // Use run_server_with_shutdown so we can also signal DC listeners on exit.
    let result = signapps_common::bootstrap::run_server_with_shutdown(
        app,
        &config,
        async move {
            // Mirror the same shutdown triggers as run_server (Ctrl+C + SIGTERM on Unix)
            let ctrl_c = async {
                tokio::signal::ctrl_c()
                    .await
                    .expect("Failed to install Ctrl+C handler");
            };

            #[cfg(unix)]
            {
                use tokio::signal::unix::{signal, SignalKind};
                let mut terminate =
                    signal(SignalKind::terminate()).expect("Failed to install SIGTERM handler");
                tokio::select! {
                    _ = ctrl_c => {},
                    _ = terminate.recv() => {},
                }
            }
            #[cfg(not(unix))]
            ctrl_c.await;

            tracing::info!("Shutdown signal received — stopping DC protocol listeners");
            let _ = shutdown_tx.send(true);
        },
    )
    .await;

    tracing::info!("=== signapps-pxe stopped ===");
    result
}
