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
use handlers::admin_security;
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::{
    auth_middleware, logging_middleware, request_id_middleware, require_admin,
    security_headers_middleware, tenant_context_middleware, AuthState,
};
use signapps_common::rate_limit::{RateLimiter, RateLimiterConfig};
use signapps_common::JwtConfig;
use signapps_db::{create_pool, run_migrations, DatabasePool};
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
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
    if let Err(e) = run_migrations(&pool).await {
        tracing::warn!(
            "Database migrations could not be completed, continuing anyway: {:?}",
            e
        );
    }

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
        security_policies: handlers::admin_security::SecurityPoliciesStore::new(),
        active_sessions: handlers::admin_security::ActiveSessionsStore::new(),
        login_attempts: handlers::admin_security::LoginAttemptsStore::new(),
        migration: handlers::migration::MigrationStore::new(),
        data_export: handlers::data_export::DataExportStore::new(),
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
    /// In-memory security policies store (admin-managed).
    pub security_policies: handlers::admin_security::SecurityPoliciesStore,
    /// In-memory active sessions store.
    pub active_sessions: handlers::admin_security::ActiveSessionsStore,
    /// In-memory recent failed login attempts store.
    pub login_attempts: handlers::admin_security::LoginAttemptsStore,
    /// In-memory migration job store (V2-15).
    pub migration: handlers::migration::MigrationStore,
    /// In-memory RGPD data export job store (V3-02).
    pub data_export: handlers::data_export::DataExportStore,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }

    fn check_token_blacklist(
        &self,
        token: &str,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = bool> + Send + '_>> {
        let cache = self.cache.clone();
        let key = format!("blacklist:{}", token);
        Box::pin(async move { cache.get(&key).await.is_some() })
    }
}

/// Create the main router with all routes.
fn create_router(state: AppState) -> Router {
    // Rate limiters for sensitive auth endpoints
    let login_limiter = RateLimiter::new(RateLimiterConfig {
        max_tokens: 5.0,
        refill_rate: 5.0 / 60.0, // 5 requests per minute
    });
    let password_reset_limiter = RateLimiter::new(RateLimiterConfig {
        max_tokens: 3.0,
        refill_rate: 3.0 / 60.0, // 3 requests per minute
    });
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            "http://localhost:3000".parse().unwrap(),
            "http://127.0.0.1:3000".parse().unwrap(),
        ]))
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
        ])
        .allow_credentials(true);

    // Rate-limited login route (5 req/min per IP)
    let login_limiter_clone = login_limiter.clone();
    let login_routes =
        Router::new()
            .route("/api/v1/auth/login", post(handlers::auth::login))
            .layer(middleware::from_fn(move |req, next| {
                let limiter = login_limiter_clone.clone();
                async move {
                    signapps_common::rate_limit::rate_limit_middleware(limiter, req, next).await
                }
            }));

    // Rate-limited password-reset route (3 req/min per IP)
    let password_reset_limiter_clone = password_reset_limiter.clone();
    let password_reset_routes =
        Router::new()
            .route(
                "/api/v1/auth/password-reset",
                post(handlers::auth::password_reset),
            )
            .route(
                "/api/v1/auth/password-reset/confirm",
                post(handlers::auth::password_reset_confirm),
            )
            .layer(middleware::from_fn(move |req, next| {
                let limiter = password_reset_limiter_clone.clone();
                async move {
                    signapps_common::rate_limit::rate_limit_middleware(limiter, req, next).await
                }
            }));

    // Public routes (no auth required)
    let public_routes = Router::new()
        .route("/health", get(handlers::health::health_check))
        // OpenAPI spec — machine-readable API documentation
        .route("/api/v1/openapi.json", get(handlers::openapi::openapi_spec))
        .route("/api/v1/auth/register", post(handlers::auth::register))
        .route("/api/v1/auth/refresh", post(handlers::auth::refresh))
        .route("/api/v1/bootstrap", post(handlers::auth::bootstrap))
        // AQ-GUES: Public token validation (no auth required — used by guest viewers)
        .route("/api/v1/guest-tokens/validate", post(handlers::guest_tokens::validate_guest_token))
        .merge(login_routes)
        .merge(password_reset_routes);

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
        // User preferences
        .route("/api/v1/users/me/preferences", get(handlers::preferences::get_preferences))
        .route("/api/v1/users/me/preferences/sync", post(handlers::preferences::sync_preferences))
        .route("/api/v1/users/me/preferences/:section", axum::routing::patch(handlers::preferences::patch_preferences))
        .route("/api/v1/users/me/preferences/conflicts", get(handlers::preferences::check_conflicts))
        .route("/api/v1/users/me/preferences/reset", post(handlers::preferences::reset_preferences))
        .route("/api/v1/users/me/preferences/export", get(handlers::preferences::export_preferences))
        .route("/api/v1/users/me/preferences/import", post(handlers::preferences::import_preferences))
        // RGPD data export (V3-02)
        .route("/api/v1/users/me/export", post(handlers::data_export::request_export))
        .route("/api/v1/users/me/export/status", get(handlers::data_export::export_status))
        .route("/api/v1/users/me/export/download", get(handlers::data_export::download_export))
        // Activities
        .route("/api/v1/activities", get(handlers::activities::list_activities))
        // Session management (AQ-SESSMGT)
        .route("/api/v1/auth/sessions", get(handlers::sessions::list))
        .route("/api/v1/auth/sessions", delete(handlers::sessions::revoke_all))
        .route("/api/v1/auth/sessions/:id", delete(handlers::sessions::revoke))
        // API key management (AQ-APIKEY)
        .route("/api/v1/api-keys", get(handlers::api_keys::list))
        .route("/api/v1/api-keys", post(handlers::api_keys::create))
        .route("/api/v1/api-keys/:id", delete(handlers::api_keys::revoke))
        // AQ-GUES: Guest access token routes (auth required to create/list/revoke)
        .route("/api/v1/guest-tokens", post(handlers::guest_tokens::create_guest_token))
        .route("/api/v1/guest-tokens", get(handlers::guest_tokens::list_guest_tokens))
        .route("/api/v1/guest-tokens/:id", delete(handlers::guest_tokens::revoke_guest_token))
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
        // Signature workflow
        .route("/api/v1/signatures", post(handlers::signatures::create_envelope))
        .route("/api/v1/signatures", get(handlers::signatures::list_envelopes))
        .route("/api/v1/signatures/:id", get(handlers::signatures::get_envelope))
        .route("/api/v1/signatures/:id/send", post(handlers::signatures::send_envelope))
        .route("/api/v1/signatures/:id/void", post(handlers::signatures::void_envelope))
        .route("/api/v1/signatures/:id/steps", post(handlers::signatures::add_step))
        .route("/api/v1/signatures/:id/steps", get(handlers::signatures::list_steps))
        .route("/api/v1/signatures/:id/steps/:step_id/sign", post(handlers::signatures::sign_step))
        .route("/api/v1/signatures/:id/steps/:step_id/decline", post(handlers::signatures::decline_step))
        .route("/api/v1/signatures/:id/transitions", get(handlers::signatures::list_transitions))
        // User signature/stamp management (AQ-SIGRT)
        .route("/api/v1/user-signatures", get(handlers::user_signatures::list_user_signatures).post(handlers::user_signatures::create_user_signature))
        .route("/api/v1/user-signatures/:id", get(handlers::user_signatures::get_user_signature).put(handlers::user_signatures::update_user_signature).delete(handlers::user_signatures::delete_user_signature))
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
        .route("/api/v1/users/:id/tenant", put(handlers::users::set_tenant))
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
            get(handlers::groups::list_members),
        )
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
        // Security policies (V2-10)
        .route(
            "/api/v1/admin/security/policies",
            get(admin_security::get_policies),
        )
        .route(
            "/api/v1/admin/security/policies",
            put(admin_security::update_policies),
        )
        .route(
            "/api/v1/admin/security/sessions",
            get(admin_security::list_sessions),
        )
        .route(
            "/api/v1/admin/security/sessions/:id",
            delete(admin_security::revoke_session),
        )
        .route(
            "/api/v1/admin/security/login-attempts",
            get(admin_security::list_login_attempts),
        )
        // Bulk user management (V3-09)
        .route(
            "/api/v1/admin/users/import",
            post(handlers::bulk_users::import_users),
        )
        .route(
            "/api/v1/admin/users/export",
            get(handlers::bulk_users::export_users),
        )
        .route(
            "/api/v1/admin/users/bulk-action",
            post(handlers::bulk_users::bulk_action),
        )
        // Migration wizard (V2-15)
        .route(
            "/api/v1/admin/migration/start",
            post(handlers::migration::start_migration),
        )
        .route(
            "/api/v1/admin/migration/status",
            get(handlers::migration::get_migration_status),
        )
        .route(
            "/api/v1/admin/migration/cancel",
            post(handlers::migration::cancel_migration),
        )
        // IP Allowlist (AQ-IPWL)
        .route(
            "/api/v1/admin/security/ip-allowlist",
            get(handlers::ip_allowlist::get),
        )
        .route(
            "/api/v1/admin/security/ip-allowlist",
            put(handlers::ip_allowlist::update),
        )
        // Security events (AQ-SECEVT)
        .route(
            "/api/v1/admin/security/events",
            get(handlers::security_events::list),
        )
        .route(
            "/api/v1/admin/security/events/summary",
            get(handlers::security_events::summary),
        )
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
        .layer(middleware::from_fn(security_headers_middleware))
        .layer(TraceLayer::new_for_http())
        .layer(axum::extract::DefaultBodyLimit::max(10 * 1024 * 1024))
        .layer(cors)
        .with_state(state)
}
