//! SignApps Identity Service
//!
//! Authentication, authorization, and user management service.
//! Supports local auth, LDAP/Active Directory, OAuth2, and MFA.

mod auth;
mod handlers;
mod ldap;

use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use signapps_common::middleware::{
    auth_middleware, logging_middleware, request_id_middleware, require_admin, AuthState,
};
use signapps_common::JwtConfig;
use signapps_db::{create_pool, run_migrations, DatabasePool};
use std::net::SocketAddr;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,signapps=debug,sqlx=warn".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting SignApps Identity Service v{}", env!("CARGO_PKG_VERSION"));

    // Load configuration
    dotenvy::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| {
        tracing::warn!("JWT_SECRET not set, using insecure default");
        "dev_secret_change_in_production_32chars".to_string()
    });

    // Create database pool
    let pool = create_pool(&database_url).await?;

    // Run migrations
    run_migrations(&pool).await?;

    // Create JWT config
    let jwt_config = JwtConfig {
        secret: jwt_secret.clone(),
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
        access_expiration: 900,
        refresh_expiration: 604800,
    };

    // Create application state
    let state = AppState {
        pool,
        jwt_secret,
        jwt_config,
    };

    // Build router
    let app = create_router(state);

    // Start server
    let host = std::env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port: u16 = std::env::var("SERVER_PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse()
        .expect("Invalid SERVER_PORT");

    let addr: SocketAddr = format!("{}:{}", host, port).parse()?;
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// Application state shared across handlers.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub jwt_secret: String,
    pub jwt_config: JwtConfig,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

/// Create the main router with all routes.
fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Public routes (no auth required)
    let public_routes = Router::new()
        .route("/health", get(handlers::health::health_check))
        .route("/api/v1/auth/login", post(handlers::auth::login))
        .route("/api/v1/auth/register", post(handlers::auth::register))
        .route("/api/v1/auth/refresh", post(handlers::auth::refresh));

    // Protected routes (auth required)
    let protected_routes = Router::new()
        .route("/api/v1/auth/logout", post(handlers::auth::logout))
        .route("/api/v1/auth/me", get(handlers::auth::me))
        // MFA endpoints
        .route("/api/v1/auth/mfa/setup", post(handlers::mfa::setup))
        .route("/api/v1/auth/mfa/verify", post(handlers::mfa::verify))
        .route("/api/v1/auth/mfa/disable", post(handlers::mfa::disable))
        .route("/api/v1/auth/mfa/status", get(handlers::mfa::status))
        // User profile (self)
        .route("/api/v1/users/me", get(handlers::users::get_me))
        .route("/api/v1/users/me", put(handlers::users::update_me))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Admin routes (auth + admin role required)
    let admin_routes = Router::new()
        // User management
        .route("/api/v1/users", get(handlers::users::list))
        .route("/api/v1/users", post(handlers::users::create))
        .route("/api/v1/users/:id", get(handlers::users::get))
        .route("/api/v1/users/:id", put(handlers::users::update))
        .route("/api/v1/users/:id", delete(handlers::users::delete))
        // LDAP/AD endpoints
        .route("/api/v1/auth/ldap/config", get(handlers::ldap::get_config))
        .route(
            "/api/v1/auth/ldap/config",
            post(handlers::ldap::create_config),
        )
        .route(
            "/api/v1/auth/ldap/config",
            put(handlers::ldap::update_config),
        )
        .route(
            "/api/v1/auth/ldap/test",
            post(handlers::ldap::test_connection),
        )
        .route("/api/v1/auth/ldap/groups", get(handlers::ldap::list_groups))
        .route("/api/v1/auth/ldap/sync", post(handlers::ldap::sync_users))
        // Group management (RBAC)
        .route("/api/v1/groups", get(handlers::groups::list))
        .route("/api/v1/groups", post(handlers::groups::create))
        .route("/api/v1/groups/:id", get(handlers::groups::get))
        .route("/api/v1/groups/:id", put(handlers::groups::update))
        .route("/api/v1/groups/:id", delete(handlers::groups::delete))
        .route(
            "/api/v1/groups/:id/members",
            post(handlers::groups::add_member),
        )
        .route(
            "/api/v1/groups/:id/members/:uid",
            delete(handlers::groups::remove_member),
        )
        // Roles
        .route("/api/v1/roles", get(handlers::roles::list))
        .route("/api/v1/roles", post(handlers::roles::create))
        .route("/api/v1/roles/:id", put(handlers::roles::update))
        .route("/api/v1/roles/:id", delete(handlers::roles::delete))
        // Webhooks
        .route("/api/v1/webhooks", get(handlers::webhooks::list))
        .route("/api/v1/webhooks", post(handlers::webhooks::create))
        .route("/api/v1/webhooks/:id", put(handlers::webhooks::update))
        .route("/api/v1/webhooks/:id", delete(handlers::webhooks::delete))
        .route("/api/v1/webhooks/:id/test", post(handlers::webhooks::test))
        .layer(middleware::from_fn(require_admin))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Combine all routes
    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .merge(admin_routes)
        .layer(middleware::from_fn(logging_middleware))
        .layer(middleware::from_fn(request_id_middleware))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
