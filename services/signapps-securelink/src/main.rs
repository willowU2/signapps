//! SignApps SecureLink Service - Web Tunnel VPN (One-Click, No Config Required)
//!
//! This service provides:
//! - Web tunnels for accessing home services without opening ports
//! - Relay/beacon server connections
//! - DNS with ad-blocking
//!
//! Runs standalone without database - perfect for home servers.

use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use signapps_common::bootstrap::{init_tracing, load_env};
use signapps_common::middleware::auth_middleware;
use signapps_common::{AuthState, JwtConfig};
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

mod dns;
mod handlers;
mod tunnel;

// Only import VPN module if mesh VPN is needed (optional)
#[cfg(feature = "mesh-vpn")]
mod vpn;

use dns::{Blocklist as DnsBlocklist, DnsConfig as DnsServiceConfig, DnsStats};
use tunnel::{TunnelClient, TunnelClientConfig};

/// A single traffic data point (one per minute, rolling window of 60 minutes).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct TrafficPoint {
    /// ISO-8601 timestamp.
    pub timestamp: String,
    /// Bytes received since the last tick.
    pub bytes_in: u64,
    /// Bytes sent since the last tick.
    pub bytes_out: u64,
}

/// Application state (standalone mode - no database required).
#[derive(Clone)]
pub struct AppState {
    /// Tunnel client for web VPN connections.
    pub tunnel_client: TunnelClient,
    /// DNS service configuration.
    pub dns_config: Arc<RwLock<DnsServiceConfig>>,
    /// DNS blocklists.
    pub blocklists: Arc<RwLock<Vec<DnsBlocklist>>>,
    /// DNS statistics.
    pub dns_stats: Arc<RwLock<DnsStats>>,
    /// Rolling traffic history (last 60 minutes, one point per minute).
    pub traffic_history: Arc<RwLock<std::collections::VecDeque<TrafficPoint>>>,
    /// JWT configuration for auth middleware.
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
    pub port: u16,
    /// Default relay URL (optional - can be configured via API).
    pub default_relay_url: Option<String>,
    /// Tunnel reconnection delay in seconds.
    pub tunnel_reconnect_delay: u64,
    /// Maximum tunnel reconnection delay in seconds.
    pub tunnel_max_reconnect_delay: u64,
    /// Tunnel ping interval in seconds.
    pub tunnel_ping_interval: u64,
    /// Enable ad-blocking by default.
    pub adblock_enabled: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            port: 3006, // Different port to avoid conflict with frontend
            default_relay_url: None,
            tunnel_reconnect_delay: 1,
            tunnel_max_reconnect_delay: 60,
            tunnel_ping_interval: 30,
            adblock_enabled: true,
        }
    }
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            port: std::env::var("SERVER_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3006),
            default_relay_url: std::env::var("DEFAULT_RELAY_URL").ok(),
            tunnel_reconnect_delay: std::env::var("TUNNEL_RECONNECT_DELAY")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(1),
            tunnel_max_reconnect_delay: std::env::var("TUNNEL_MAX_RECONNECT_DELAY")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(60),
            tunnel_ping_interval: std::env::var("TUNNEL_PING_INTERVAL")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(30),
            adblock_enabled: std::env::var("ADBLOCK_ENABLED")
                .map(|v| v == "true" || v == "1")
                .unwrap_or(true),
        }
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Initialize using bootstrap helpers
    init_tracing("signapps_securelink");
    load_env();

    // Load configuration
    let config = Config::from_env();

    tracing::info!("🚀 Starting SignApps SecureLink (Standalone Mode)");
    tracing::info!("   Port: {}", config.port);
    tracing::info!(
        "   Ad-blocking: {}",
        if config.adblock_enabled {
            "enabled"
        } else {
            "disabled"
        }
    );

    // Create tunnel client
    let tunnel_config = TunnelClientConfig {
        reconnect_delay: std::time::Duration::from_secs(config.tunnel_reconnect_delay),
        max_reconnect_delay: std::time::Duration::from_secs(config.tunnel_max_reconnect_delay),
        ping_interval: std::time::Duration::from_secs(config.tunnel_ping_interval),
        ..Default::default()
    };
    let tunnel_client = TunnelClient::new(tunnel_config);

    // Create DNS config with defaults
    let dns_config = DnsServiceConfig {
        adblock_enabled: config.adblock_enabled,
        ..Default::default()
    };

    // Default blocklists
    let default_blocklists = vec![
        DnsBlocklist {
            id: uuid::Uuid::new_v4(),
            name: "Steven Black Hosts".to_string(),
            url: "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts".to_string(),
            enabled: true,
            domain_count: 0,
            last_updated: None,
        },
        DnsBlocklist {
            id: uuid::Uuid::new_v4(),
            name: "AdAway".to_string(),
            url: "https://adaway.org/hosts.txt".to_string(),
            enabled: true,
            domain_count: 0,
            last_updated: None,
        },
    ];

    // Initialize JWT config from environment
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| {
        if cfg!(debug_assertions) {
            tracing::warn!("JWT_SECRET not set, using insecure dev default");
            "dev_secret_change_in_production_32chars".to_string()
        } else {
            panic!("JWT_SECRET must be set in production");
        }
    });
    let jwt_config = JwtConfig {
        secret: jwt_secret,
        issuer: "signapps".to_string(),
        audience: "signapps-securelink".to_string(),
        access_expiration: 900,
        refresh_expiration: 604800,
    };

    // Create application state
    let state = AppState {
        tunnel_client,
        dns_config: Arc::new(RwLock::new(dns_config)),
        blocklists: Arc::new(RwLock::new(default_blocklists)),
        dns_stats: Arc::new(RwLock::new(DnsStats::default())),
        traffic_history: Arc::new(RwLock::new(std::collections::VecDeque::with_capacity(60))),
        jwt_config,
    };

    // Spawn background task: record one traffic data point per minute.
    {
        let history = state.traffic_history.clone();
        tokio::spawn(async move {
            let mut ticker = tokio::time::interval(tokio::time::Duration::from_secs(60));
            loop {
                ticker.tick().await;
                let ts = chrono::Utc::now().to_rfc3339();
                let point = TrafficPoint {
                    timestamp: ts,
                    bytes_in: 0,
                    bytes_out: 0,
                };
                let mut h = history.write().await;
                if h.len() >= 60 {
                    h.pop_front();
                }
                h.push_back(point);
            }
        });
    }

    // Build router
    let app = create_router(state);

    // Start server
    let addr: std::net::SocketAddr = format!("0.0.0.0:{}", config.port)
        .parse()
        .expect("server address is valid");
    tracing::info!("✅ SecureLink ready at http://localhost:{}", config.port);
    tracing::info!("   Health: http://localhost:{}/health", config.port);
    tracing::info!("   API: http://localhost:{}/api/v1/tunnels", config.port);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(signapps_common::graceful_shutdown())
        .await?;

    Ok(())
}

fn create_router(state: AppState) -> Router {
    // CORS configuration (allow all for local development)
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            "http://localhost:3000".parse().expect("valid origin"),
            "http://127.0.0.1:3000".parse().expect("valid origin"),
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

    // Tunnel routes (web VPN - main feature)
    let tunnel_routes = Router::new()
        .route("/", get(handlers::list_tunnels))
        .route("/", post(handlers::create_tunnel))
        .route("/bulk", post(handlers::bulk_tunnel_action))
        .route("/{id}", get(handlers::get_tunnel))
        .route("/{id}", delete(handlers::delete_tunnel))
        .route("/{id}/status", get(handlers::get_tunnel_status))
        .route("/{id}/reconnect", post(handlers::reconnect_tunnel))
        .route("/quick", post(handlers::quick_connect));

    // Relay routes (web VPN)
    let relay_routes = Router::new()
        .route("/", get(handlers::list_relays))
        .route("/", post(handlers::create_relay))
        .route("/{id}", get(handlers::get_relay))
        .route("/{id}", delete(handlers::delete_relay))
        .route("/{id}/test", post(handlers::test_relay))
        .route("/{id}/connect", post(handlers::connect_relay))
        .route("/{id}/disconnect", post(handlers::disconnect_relay))
        .route("/{id}/stats", get(handlers::get_relay_stats));

    // DNS routes
    let dns_routes = Router::new()
        .route("/config", get(handlers::get_dns_config))
        .route("/config", put(handlers::update_dns_config))
        .route("/blocklists", get(handlers::list_blocklists))
        .route("/blocklists", post(handlers::add_blocklist))
        .route("/blocklists/{id}", get(handlers::get_blocklist))
        .route("/blocklists/{id}", delete(handlers::delete_blocklist))
        .route(
            "/blocklists/{id}/refresh",
            post(handlers::refresh_blocklist),
        )
        .route("/records", get(handlers::list_dns_records))
        .route("/records", post(handlers::add_dns_record))
        .route("/records", delete(handlers::delete_dns_record))
        .route("/stats", get(handlers::get_dns_stats))
        .route("/stats/reset", post(handlers::reset_dns_stats))
        .route("/query", post(handlers::query_dns))
        .route("/cache/flush", post(handlers::flush_dns_cache));

    // Dashboard routes (public)
    let dashboard_routes = Router::new()
        .route("/stats", get(handlers::dashboard_stats))
        .route("/traffic", get(handlers::dashboard_traffic));

    // Health check (public)
    let health_routes = Router::new().route("/", get(handlers::health_check_standalone));

    // Public routes (no auth required)
    let public_routes = Router::new()
        .nest("/health", health_routes)
        .nest("/api/v1/dashboard", dashboard_routes);

    // Protected routes (auth required)
    let protected_routes = Router::new()
        .nest("/api/v1/tunnels", tunnel_routes)
        .nest("/api/v1/relays", relay_routes)
        .nest("/api/v1/dns", dns_routes)
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Swagger UI (unauthenticated)
    let swagger = SwaggerUi::new("/swagger-ui")
        .url(
            "/api-docs/openapi.json",
            handlers::openapi::SecurelinkApiDoc::openapi(),
        );

    // Combine all routes
    public_routes
        .merge(protected_routes)
        .merge(swagger)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
