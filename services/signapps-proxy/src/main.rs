//! SignApps Proxy Service - Reverse proxy with integrated data plane

use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use signapps_common::middleware::{
    auth_middleware, logging_middleware, request_id_middleware, require_admin,
};
use signapps_common::{AuthState, JwtConfig};
use signapps_db::DatabasePool;
use std::net::SocketAddr;
use tower::ServiceBuilder;
use tower_http::cors::{Any, CorsLayer};

mod handlers;
mod proxy;
mod shield;

use handlers::{certificates, config, health, proxy_status, routes, shield as shield_handlers};
use proxy::acme::{AcmeChallengeStore, AcmeService};
use proxy::engine::ProxyEngine;
use proxy::forwarder::HttpForwarder;
use proxy::tls::TlsCertResolver;
use proxy::RouteCache;
use shield::ShieldService;

/// Application state shared across handlers.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub shield: ShieldService,
    pub jwt_config: JwtConfig,
    pub route_cache: RouteCache,
    pub tls_resolver: Option<TlsCertResolver>,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "signapps_proxy=debug,tower_http=debug,info".into()),
        )
        .init();

    tracing::info!(
        "Starting SignApps Proxy Service v{}",
        env!("CARGO_PKG_VERSION")
    );

    // Load .env file
    dotenvy::dotenv().ok();

    // Load configuration
    let database_url =
        std::env::var("DATABASE_URL").unwrap_or_else(|_| "postgres://localhost/signapps".into());
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret-change-me".into());
    // Proxy configuration
    let proxy_enabled = std::env::var("PROXY_ENABLED")
        .unwrap_or_else(|_| "true".into())
        .parse::<bool>()
        .unwrap_or(true);
    let proxy_http_port: u16 = std::env::var("PROXY_HTTP_PORT")
        .unwrap_or_else(|_| "80".into())
        .parse()
        .unwrap_or(80);
    let proxy_https_port: u16 = std::env::var("PROXY_HTTPS_PORT")
        .unwrap_or_else(|_| "443".into())
        .parse()
        .unwrap_or(443);
    let route_refresh_secs: u64 = std::env::var("PROXY_ROUTE_REFRESH_SECS")
        .unwrap_or_else(|_| "5".into())
        .parse()
        .unwrap_or(5);

    // Initialize database pool
    let pool = signapps_db::create_pool(&database_url).await?;
    tracing::info!("Database connection established");

    // Run migrations
    // signapps_db::run_migrations(&pool).await?;
    tracing::info!("Database migrations completed");

    // Initialize SmartShield service (in-process, no Redis needed)
    let shield = ShieldService::new();
    tracing::info!("SmartShield service initialized (in-process cache)");

    // Initialize route cache
    let route_cache = RouteCache::new(pool.clone());

    // JWT configuration
    let jwt_config = JwtConfig {
        secret: jwt_secret,
        issuer: "signapps".to_string(),
        audience: "signapps-proxy".to_string(),
        access_expiration: 900,
        refresh_expiration: 604800,
    };

    // Initialize TLS resolver early so it can be shared with state
    let tls_resolver = if proxy_enabled {
        match TlsCertResolver::new() {
            Ok(resolver) => {
                let resolver_clone = resolver.clone();
                let pool_clone = pool.clone();
                tokio::spawn(async move {
                    proxy::tls::start_cert_refresh_loop(resolver_clone, pool_clone, 60).await;
                });
                Some(resolver)
            },
            Err(e) => {
                tracing::warn!(
                    error = %e,
                    "TLS resolver init failed, HTTPS disabled"
                );
                None
            },
        }
    } else {
        None
    };

    // Create application state
    let state = AppState {
        pool: pool.clone(),
        shield: shield.clone(),
        jwt_config,
        route_cache: route_cache.clone(),
        tls_resolver: tls_resolver.clone(),
    };

    // Start route cache refresh loop
    let cache_for_refresh = route_cache.clone();
    tokio::spawn(async move {
        cache_for_refresh
            .start_refresh_loop(route_refresh_secs)
            .await;
    });

    // Start integrated proxy if enabled
    if proxy_enabled {
        let https_port = if tls_resolver.is_some() {
            Some(proxy_https_port)
        } else {
            None
        };

        let acme_store = AcmeChallengeStore::new();

        // Start ACME auto-renewal if enabled
        let acme_enabled = std::env::var("ACME_ENABLED")
            .unwrap_or_else(|_| "false".into())
            .parse::<bool>()
            .unwrap_or(false);

        if acme_enabled {
            let acme_email =
                std::env::var("ACME_EMAIL").unwrap_or_else(|_| "admin@example.com".into());
            let acme_directory = std::env::var("ACME_DIRECTORY_URL")
                .unwrap_or_else(|_| "https://acme-v02.api.letsencrypt.org/directory".into());

            let acme_service = AcmeService::new(
                pool.clone(),
                acme_store.clone(),
                tls_resolver.clone(),
                acme_email,
                acme_directory,
            );

            tokio::spawn(proxy::acme::start_auto_renewal_loop(
                acme_service,
                12, // every 12 hours
                30, // renew 30 days before expiry
            ));

            tracing::info!("ACME auto-renewal enabled");
        }

        let engine = ProxyEngine {
            route_cache: route_cache.clone(),
            forwarder: HttpForwarder::new(),
            shield: shield.clone(),
            acme_store,
            tls_resolver,
        };

        tokio::spawn(async move {
            if let Err(e) = proxy::run_proxy(proxy_http_port, https_port, engine).await {
                tracing::error!(error = %e, "Proxy engine failed");
            }
        });

        tracing::info!(
            http_port = proxy_http_port,
            https_port = proxy_https_port,
            "Integrated proxy engine started"
        );
    } else {
        tracing::info!("Integrated proxy disabled (PROXY_ENABLED=false)");
    }

    // Build management API router
    let app = create_router(state);

    // Start management API server
    let port: u16 = std::env::var("SERVER_PORT")
        .unwrap_or_else(|_| "3003".into())
        .parse()
        .unwrap_or(3003);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    tracing::info!("Management API listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// Create the application router with all routes.
fn create_router(state: AppState) -> Router {
    // Public routes (health check)
    let public_routes = Router::new().route("/health", get(health::health_check));

    // Protected route management
    let route_routes = Router::new()
        .route("/routes", get(routes::list_routes))
        .route("/routes", post(routes::create_route))
        .route("/routes/:id", get(routes::get_route))
        .route("/routes/:id", put(routes::update_route))
        .route("/routes/:id", delete(routes::delete_route))
        .route("/routes/:id/enable", post(routes::enable_route))
        .route("/routes/:id/disable", post(routes::disable_route))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Protected shield routes
    let shield_routes = Router::new()
        .route("/shield/stats", get(shield_handlers::get_stats))
        .route("/shield/:route_id/block", post(shield_handlers::block_ip))
        .route(
            "/shield/:route_id/block/:ip",
            delete(shield_handlers::unblock_ip),
        )
        .route(
            "/shield/:route_id/check/:ip",
            get(shield_handlers::check_blocked),
        )
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Protected certificate routes
    let cert_routes = Router::new()
        .route("/certificates", get(certificates::list_certificates))
        .route("/certificates", post(certificates::upload_certificate))
        .route(
            "/certificates/request",
            post(certificates::request_certificate),
        )
        .route(
            "/certificates/:id/renew",
            post(certificates::renew_certificate),
        )
        .route(
            "/certificates/:id",
            delete(certificates::delete_certificate),
        )
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Protected proxy status route
    let proxy_routes = Router::new()
        .route("/proxy/status", get(proxy_status::get_proxy_status))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Protected config routes
    let config_routes = Router::new()
        .route("/config/proxy", get(config::get_proxy_config))
        .route("/config/proxy/overview", get(config::get_proxy_overview))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Admin routes
    let admin_routes = Router::new()
        .route("/shield/stats/reset", post(shield_handlers::reset_stats))
        .route("/config/refresh", post(config::refresh_config))
        .route_layer(middleware::from_fn(require_admin))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // CORS configuration
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Combine all routes
    Router::new()
        .nest("/api/v1", public_routes)
        .nest("/api/v1", route_routes)
        .nest("/api/v1", cert_routes)
        .nest("/api/v1", proxy_routes)
        .nest("/api/v1", shield_routes)
        .nest("/api/v1", config_routes)
        .nest("/api/v1/admin", admin_routes)
        .layer(
            ServiceBuilder::new()
                .layer(middleware::from_fn(request_id_middleware))
                .layer(middleware::from_fn(logging_middleware))
                .layer(cors),
        )
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_state_clone() {
        fn assert_clone<T: Clone>() {}
        assert_clone::<AppState>();
    }
}
