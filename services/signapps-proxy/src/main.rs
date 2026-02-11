//! SignApps Proxy Service - Reverse proxy control plane

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
mod shield;
mod traefik;

use handlers::{config, health, routes, shield as shield_handlers};
use shield::ShieldService;
use traefik::TraefikClient;

/// Application state shared across handlers.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub traefik: TraefikClient,
    pub shield: ShieldService,
    pub jwt_config: JwtConfig,
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

    // Load configuration
    let database_url =
        std::env::var("DATABASE_URL").unwrap_or_else(|_| "postgres://localhost/signapps".into());
    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into());
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret-change-me".into());
    let traefik_api_url =
        std::env::var("TRAEFIK_API_URL").unwrap_or_else(|_| "http://localhost:8080".into());

    // Initialize database pool
    let pool = signapps_db::create_pool(&database_url).await?;
    tracing::info!("Database connection established");

    // Run migrations
    signapps_db::run_migrations(&pool).await?;
    tracing::info!("Database migrations completed");

    // Initialize Traefik client
    let traefik = TraefikClient::new(&traefik_api_url);
    tracing::info!("Traefik client initialized");

    // Initialize SmartShield service
    let shield = ShieldService::new(&redis_url).await?;
    tracing::info!("SmartShield service initialized");

    // JWT configuration
    let jwt_config = JwtConfig {
        secret: jwt_secret,
        issuer: "signapps".to_string(),
        audience: "signapps-proxy".to_string(),
        access_expiration: 900,
        refresh_expiration: 604800,
    };

    // Create application state
    let state = AppState {
        pool,
        traefik,
        shield,
        jwt_config,
    };

    // Build router
    let app = create_router(state);

    // Start server
    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "3000".into())
        .parse()
        .unwrap_or(3000);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    tracing::info!("Listening on {}", addr);

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

    // Protected config routes
    let config_routes = Router::new()
        .route("/config/traefik", get(config::get_traefik_config))
        .route(
            "/config/traefik/overview",
            get(config::get_traefik_overview),
        )
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Admin routes
    let admin_routes = Router::new()
        .route("/shield/stats/reset", post(shield_handlers::reset_stats))
        .route("/config/regenerate", post(config::regenerate_config))
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
