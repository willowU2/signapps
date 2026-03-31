mod dhcp_proxy;
mod handlers;
mod images;
mod models;
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
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;
use tower_http::trace::TraceLayer;

#[derive(Clone)]
/// Application state for  service.
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
        "uptime_seconds": signapps_common::healthz::uptime_seconds()
    }))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing("signapps_pxe");
    load_env();

    let config = ServiceConfig::from_env("signapps-pxe", 3016);
    config.log_startup();

    let jwt_config = JwtConfig {
        secret: config.jwt_secret.clone(),
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
        access_expiration: 900,
        refresh_expiration: 604800,
    };

    let db_pool = signapps_db::create_pool(&config.database_url).await?;
    let app_state = AppState {
        db: db_pool,
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

    let app = Router::new()
        .route("/health", get(health_check))
        .nest_service("/boot", ServeDir::new(http_boot_dir))
        .route("/api/v1/pxe/health", get(health_check))
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
        .layer(axum::middleware::from_fn_with_state(
            app_state.clone(),
            optional_auth_middleware::<AppState>,
        ))
        .layer(
            CorsLayer::new()
                .allow_origin(tower_http::cors::Any)
                .allow_methods([
                    axum::http::Method::GET, axum::http::Method::POST, axum::http::Method::PUT,
                    axum::http::Method::DELETE, axum::http::Method::PATCH, axum::http::Method::OPTIONS,
                ])
                .allow_headers([
                    axum::http::header::CONTENT_TYPE,
                    axum::http::header::AUTHORIZATION,
                    axum::http::HeaderName::from_static("x-request-id"),
                    axum::http::HeaderName::from_static("x-workspace-id"),
                ])
        )
        .layer(TraceLayer::new_for_http())
        .layer(axum::middleware::from_fn(logging_middleware))
        .layer(axum::middleware::from_fn(request_id_middleware))
        .with_state(app_state);

    signapps_common::bootstrap::run_server(app, &config).await
}
