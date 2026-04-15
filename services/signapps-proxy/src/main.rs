//! SignApps Proxy Service - Reverse proxy with integrated data plane

use axum::{
    middleware,
    routing::{any, delete, get, post, put},
    Router,
};
use signapps_common::bootstrap::{env_or, init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::{
    auth_middleware, logging_middleware, request_id_middleware, require_admin,
};
use signapps_common::{AuthState, JwtConfig};
use signapps_db::DatabasePool;
use tower::ServiceBuilder;
use tower_http::compression::CompressionLayer;
use tower_http::cors::{AllowOrigin, CorsLayer};

mod app_middleware;
mod handlers;
mod proxy;
mod shield;

use app_middleware::hostname_router::{hostname_router_middleware, HostnameRouterState};
use app_middleware::maintenance::{maintenance_middleware, MaintenanceState};
use handlers::{
    certificates, config, health, openapi, proxy_status, routes, shield as shield_handlers,
    vault_browse,
};
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

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize using bootstrap helpers
    init_tracing("signapps_proxy");
    load_env();

    let config = ServiceConfig::from_env("signapps-proxy", 3003);
    config.log_startup();

    // Proxy-specific configuration
    let proxy_enabled: bool = env_or("PROXY_ENABLED", "true").parse().unwrap_or(true);
    let proxy_http_port: u16 = env_or("PROXY_HTTP_PORT", "80").parse().unwrap_or(80);
    let proxy_https_port: u16 = env_or("PROXY_HTTPS_PORT", "443").parse().unwrap_or(443);
    let route_refresh_secs: u64 = env_or("PROXY_ROUTE_REFRESH_SECS", "5").parse().unwrap_or(5);

    // Initialize database pool
    let pool = signapps_db::create_pool(&config.database_url).await?;
    tracing::info!("Database connection established");

    // Initialize SmartShield service (in-process, no Redis needed)
    let shield = ShieldService::new();
    tracing::info!("SmartShield service initialized (in-process cache)");

    // Initialize route cache
    let route_cache = RouteCache::new(pool.clone());

    // JWT config — auto-detects RS256 or HS256 from environment
    let jwt_config = JwtConfig::from_env();

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
        let acme_enabled: bool = env_or("ACME_ENABLED", "false").parse().unwrap_or(false);

        if acme_enabled {
            let acme_email = env_or("ACME_EMAIL", "admin@example.com");
            let acme_directory = env_or(
                "ACME_DIRECTORY_URL",
                "https://acme-v02.api.letsencrypt.org/directory",
            );

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

    // Maintenance middleware state (reads the `maintenance_flags` DB row,
    // shared with signapps-deploy since P3c.3).
    let maintenance_state = MaintenanceState {
        pool: (*pool).clone(),
        env: env_or("SIGNAPPS_ENV", "prod"),
    };

    // Build management API router
    let app = create_router(state, maintenance_state);

    // Start management API server using bootstrap helper
    signapps_common::bootstrap::run_server(app, &config).await
}

/// Create the application router with all routes.
fn create_router(state: AppState, maintenance_state: MaintenanceState) -> Router {
    // Public routes (health check)
    let public_routes = Router::new().route("/health", get(health::health_check));

    // Admin route management (CRUD on proxy routes requires admin)
    let route_routes = Router::new()
        .route("/routes", get(routes::list_routes))
        .route("/routes", post(routes::create_route))
        .route("/routes/:id", get(routes::get_route))
        .route("/routes/:id", put(routes::update_route))
        .route("/routes/:id", delete(routes::delete_route))
        .route("/routes/:id/enable", post(routes::enable_route))
        .route("/routes/:id/disable", post(routes::disable_route))
        .route_layer(middleware::from_fn(require_admin))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Admin shield routes (block/unblock IP requires admin)
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
        .route_layer(middleware::from_fn(require_admin))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Admin certificate routes (certificate management requires admin)
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
        .route_layer(middleware::from_fn(require_admin))
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

    // Root-level health check (outside /api/v1 nest so it's reachable at /health)
    let root_health = Router::new().route("/health", get(health::health_check));

    // Vault browse proxy routes (public — authenticated via session token in URL)
    let vault_routes = Router::new()
        .route("/proxy/vault/:token", any(vault_browse::vault_browse))
        .route(
            "/proxy/vault/:token/*path",
            any(vault_browse::vault_browse_sub),
        );

    // Combine all routes
    Router::new()
        .merge(openapi::swagger_router())
        .merge(signapps_common::version::router("signapps-proxy"))
        .merge(root_health)
        .merge(vault_routes)
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
                // Brotli-first compression (falls back to gzip/deflate per Accept-Encoding)
                .layer(CompressionLayer::new())
                .layer(cors),
        )
        // Maintenance mode: intercepts traffic when `deploy:maintenance:{env}` = "1"
        // (added before hostname_router so it runs CLOSER to the handler;
        // hostname_router runs FIRST on the request and injects BackendCluster
        // into extensions, which maintenance then reads).
        .layer(middleware::from_fn_with_state(
            maintenance_state,
            maintenance_middleware,
        ))
        // Hostname-based routing: inspects Host header and inserts
        // BackendCluster into request extensions. Runs BEFORE maintenance
        // on the request path (axum layer order: last-added runs first).
        .layer(middleware::from_fn_with_state(
            HostnameRouterState::default(),
            hostname_router_middleware,
        ))
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
