//! SignApps SecureLink Service - VPN Mesh Network Management
//!
//! This service manages the mesh VPN network including:
//! - Device enrollment and certificate management
//! - Network configuration generation
//! - Device status monitoring

use axum::{
    routing::{delete, get, post},
    Router,
};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod handlers;
mod vpn;

use signapps_common::{JwtConfig, Result};
use signapps_common::middleware::AuthState;
use signapps_db::DatabasePool;
use vpn::{CryptoService, VpnService};

/// Application state.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub vpn: VpnService,
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
    pub ca_path: String,
    pub config_path: String,
    pub network_prefix: String,
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
            jwt_audience: std::env::var("JWT_AUDIENCE")
                .unwrap_or_else(|_| "signapps".to_string()),
            ca_path: std::env::var("VPN_CA_PATH")
                .unwrap_or_else(|_| "/var/lib/signapps/vpn/ca".to_string()),
            config_path: std::env::var("VPN_CONFIG_PATH")
                .unwrap_or_else(|_| "/var/lib/signapps/vpn".to_string()),
            network_prefix: std::env::var("VPN_NETWORK_PREFIX")
                .unwrap_or_else(|_| "10.42.0".to_string()),
            port: std::env::var("PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3005),
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "signapps_securelink=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let config = Config::from_env();

    tracing::info!("Starting SignApps SecureLink Service on port {}", config.port);

    // Create database pool
    let pool = signapps_db::create_pool(&config.database_url).await?;

    // Create crypto service
    let crypto = CryptoService::new(&config.ca_path, &config.config_path);

    // Create VPN service
    let vpn = VpnService::new(
        pool.clone(),
        crypto,
        &config.config_path,
        &config.network_prefix,
    );

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
        vpn,
        jwt_config,
    };

    // Build router
    let app = create_router(state);

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    tracing::info!("SecureLink service listening on {}", addr);

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

    // Device routes
    let device_routes = Router::new()
        .route("/", get(handlers::list_devices))
        .route("/enroll", post(handlers::enroll_device))
        .route("/heartbeat", post(handlers::device_heartbeat))
        .route("/{id}", get(handlers::get_device))
        .route("/{id}", delete(handlers::delete_device))
        .route("/{id}/config", get(handlers::get_device_config))
        .route("/{id}/block", post(handlers::block_device))
        .route("/{id}/unblock", post(handlers::unblock_device));

    // VPN routes
    let vpn_routes = Router::new()
        .route("/init", post(handlers::init_vpn))
        .route("/status", get(handlers::get_vpn_status))
        .route("/ca", get(handlers::get_ca_certificate))
        .route("/regenerate", post(handlers::regenerate_configs));

    // Health check
    let health_routes = Router::new()
        .route("/", get(handlers::health_check));

    // Combine all routes
    Router::new()
        .nest("/api/v1/devices", device_routes)
        .nest("/api/v1/vpn", vpn_routes)
        .nest("/health", health_routes)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
