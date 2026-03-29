mod handlers;
mod models;
mod tftp;

use axum::{routing::get, Router};
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
    // Initialize using bootstrap helpers
    init_tracing("signapps_pxe");
    load_env();

    let config = ServiceConfig::from_env("signapps-pxe", 3016);
    config.log_startup();

    // JWT configuration (custom: audience="signapps" for all services)
    let jwt_config = JwtConfig {
        secret: config.jwt_secret.clone(),
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
        access_expiration: 900,
        refresh_expiration: 604800,
    };

    // Database
    let db_pool = signapps_db::create_pool(&config.database_url).await?;
    let app_state = AppState {
        db: db_pool,
        jwt_config,
    };

    // Ensure HTTP boot directory exists
    let http_boot_dir = "data/pxe/httpboot";
    tokio::fs::create_dir_all(http_boot_dir).await?;

    // Spawn TFTP server in the background
    tokio::spawn(async move {
        if let Err(e) = tftp::start_tftp_server("data/pxe/tftpboot", 69).await {
            tracing::error!("TFTP Server failed: {}", e);
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
        .layer(axum::middleware::from_fn_with_state(
            app_state.clone(),
            optional_auth_middleware::<AppState>,
        ))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .layer(axum::middleware::from_fn(logging_middleware))
        .layer(axum::middleware::from_fn(request_id_middleware))
        .with_state(app_state);

    // Start server using bootstrap helper
    signapps_common::bootstrap::run_server(app, &config).await
}
