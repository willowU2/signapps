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
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::{
    auth_middleware, logging_middleware, request_id_middleware, require_admin,
    tenant_context_middleware, AuthState,
};
use signapps_common::JwtConfig;
use signapps_db::{create_pool, run_migrations, DatabasePool};
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize using bootstrap helpers
    init_tracing("signapps_identity");
    load_env();

    let config = ServiceConfig::from_env("signapps-identity", 3001);
    config.log_startup();

    // Create database pool
    let pool = create_pool(&config.database_url).await?;

    // Run global database migrations orchestrator
    run_migrations(&pool).await?;

    // Create in-process cache for token blacklisting
    let cache = signapps_cache::CacheService::new(
        50_000,
        std::time::Duration::from_secs(900), // 15min default (matches access token TTL)
    );

    // Create JWT config (custom: audience="signapps" for all services)
    let jwt_config = JwtConfig {
        secret: config.jwt_secret.clone(),
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
        access_expiration: 900,
        refresh_expiration: 604800,
    };

    // Create application state
    let state = AppState {
        pool,
        jwt_secret: config.jwt_secret.clone(),
        jwt_config,
        cache,
    };

    // Build router
    let app = create_router(state);

    // Start server using bootstrap helper
    signapps_common::bootstrap::run_server(app, &config).await
}

/// Application state shared across handlers.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub jwt_secret: String,
    pub jwt_config: JwtConfig,
    pub cache: signapps_cache::CacheService,
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
        .route("/api/v1/auth/refresh", post(handlers::auth::refresh))
        .route("/api/v1/bootstrap", post(handlers::auth::bootstrap));

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

    // Tenant-scoped routes (auth + tenant context required)
    let tenant_routes = Router::new()
        // Tenant info
        .route("/api/v1/tenant", get(handlers::tenants::get_my_tenant))
        // Workspaces
        .route("/api/v1/workspaces", get(handlers::tenants::list_workspaces))
        .route("/api/v1/workspaces", post(handlers::tenants::create_workspace))
        .route("/api/v1/workspaces/mine", get(handlers::tenants::list_my_workspaces))
        .route("/api/v1/workspaces/:id", get(handlers::tenants::get_workspace))
        .route("/api/v1/workspaces/:id", put(handlers::tenants::update_workspace))
        .route("/api/v1/workspaces/:id", delete(handlers::tenants::delete_workspace))
        .route("/api/v1/workspaces/:id/members", get(handlers::tenants::list_workspace_members))
        .route("/api/v1/workspaces/:id/members", post(handlers::tenants::add_workspace_member))
        .route("/api/v1/workspaces/:id/members/:uid", put(handlers::tenants::update_workspace_member_role))
        .route("/api/v1/workspaces/:id/members/:uid", delete(handlers::tenants::remove_workspace_member))
        // Resource types
        .route("/api/v1/resource-types", get(handlers::resources::list_resource_types))
        .route("/api/v1/resource-types", post(handlers::resources::create_resource_type))
        .route("/api/v1/resource-types/:id", delete(handlers::resources::delete_resource_type))
        // Resources (rooms, equipment, etc.)
        .route("/api/v1/resources", get(handlers::resources::list_resources))
        .route("/api/v1/resources", post(handlers::resources::create_resource))
        .route("/api/v1/resources/:id", get(handlers::resources::get_resource))
        .route("/api/v1/resources/:id", put(handlers::resources::update_resource))
        .route("/api/v1/resources/:id", delete(handlers::resources::delete_resource))
        // Reservations
        .route("/api/v1/reservations", get(handlers::resources::list_reservations))
        .route("/api/v1/reservations", post(handlers::resources::create_reservation))
        .route("/api/v1/reservations/mine", get(handlers::resources::list_my_reservations))
        .route("/api/v1/reservations/pending", get(handlers::resources::list_pending_reservations))
        .route("/api/v1/reservations/:id", get(handlers::resources::get_reservation))
        .route("/api/v1/reservations/:id/status", put(handlers::resources::update_reservation_status))
        .layer(middleware::from_fn(tenant_context_middleware))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Admin routes (auth + admin role required)
    let admin_routes = Router::new()
        // Tenant management (super-admin)
        .route("/api/v1/tenants", get(handlers::tenants::list_tenants))
        .route("/api/v1/tenants", post(handlers::tenants::create_tenant))
        .route("/api/v1/tenants/:id", get(handlers::tenants::get_tenant))
        .route("/api/v1/tenants/:id", put(handlers::tenants::update_tenant))
        .route("/api/v1/tenants/:id", delete(handlers::tenants::delete_tenant))
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
        .route("/api/v1/webhooks/:id", get(handlers::webhooks::get))
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
        .merge(tenant_routes)
        .merge(admin_routes)
        .layer(middleware::from_fn(logging_middleware))
        .layer(middleware::from_fn(request_id_middleware))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
