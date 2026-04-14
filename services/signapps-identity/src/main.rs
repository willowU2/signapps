//! SignApps Identity Service
//!
//! Authentication, authorization, and user management service.
//! Supports local auth, LDAP/Active Directory, OAuth2, and MFA.

mod auth;
mod handlers;
mod ldap;
mod middleware;
mod refresh_job;
mod services;
mod webhook_dispatcher;

use axum::{
    middleware as axum_middleware,
    routing::{delete, get, patch, post, put},
    Router,
};
use handlers::admin_security;
use handlers::oauth::OAuthEngineState;
use handlers::openapi::IdentityApiDoc;
use std::sync::Arc;

use anyhow::Context as _;
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::{
    auth_middleware, logging_middleware, request_id_middleware, require_admin,
    security_headers_middleware, tenant_context_middleware, AuthState,
};
use signapps_common::pg_events::PgEventBus;
use signapps_common::rate_limit::{RateLimiter, RateLimiterConfig};
use signapps_common::JwtConfig;
use signapps_db::{create_pool, run_migrations, DatabasePool};
use signapps_keystore::{Keystore, KeystoreBackend};
use signapps_oauth::{Catalog, EngineV2, EngineV2Config, PgConfigStore};
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

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

    // Create JWT config — auto-detects RS256 (JWT_PRIVATE_KEY_PEM + JWT_PUBLIC_KEY_PEM)
    // or HS256 (JWT_SECRET) from environment variables.
    // JwtConfig::from_env() panics with a clear message if no key material is found.
    let jwt_config = JwtConfig::from_env();

    // Spawn webhook event dispatcher background task (WH1)
    {
        let dispatcher_pool = pool.clone();
        tokio::spawn(async move {
            webhook_dispatcher::run(dispatcher_pool).await;
        });
    }

    // NOTE: Retention purge job moved to signapps-compliance service (port 3032).

    // Load the keystore from environment — fails fast if KEYSTORE_MASTER_KEY is absent.
    let keystore = Arc::new(
        Keystore::init(KeystoreBackend::EnvVar)
            .await
            .context("failed to initialize signapps-keystore — is KEYSTORE_MASTER_KEY set?")?,
    );
    tracing::info!("keystore initialized");

    // ── OAuth Engine v2 (P3T9) ──────────────────────────────────────────────
    //
    // OAUTH_STATE_SECRET is a 32-byte hex-encoded HMAC key used to sign and
    // verify FlowState tokens (anti-CSRF). In development, if the variable is
    // absent we fall back to a zero-byte placeholder so the service still boots.
    //
    // WARNING: Never use the all-zero fallback in production. Set
    // OAUTH_STATE_SECRET to `openssl rand -hex 32` in your .env.
    let oauth_state_secret = match std::env::var("OAUTH_STATE_SECRET") {
        Ok(hex_val) => hex::decode(&hex_val).unwrap_or_else(|e| {
            tracing::warn!(
                error = %e,
                "OAUTH_STATE_SECRET is not valid hex — falling back to zero secret (dev only)"
            );
            vec![0u8; 32]
        }),
        Err(_) => {
            tracing::warn!(
                "OAUTH_STATE_SECRET not set — using zero-byte placeholder (dev only, \
                 NOT safe for production)"
            );
            vec![0u8; 32]
        },
    };

    let catalog = Arc::new(
        Catalog::load_embedded().context("failed to load embedded OAuth provider catalog")?,
    );
    tracing::info!(providers = catalog.len(), "OAuth catalog loaded");

    let configs: Arc<dyn signapps_oauth::ConfigStore> =
        Arc::new(PgConfigStore::new(pool.inner().clone()));

    let callback_base_url = std::env::var("OAUTH_CALLBACK_BASE_URL")
        .unwrap_or_else(|_| "http://localhost:3001".to_string());

    let engine = EngineV2::new(EngineV2Config {
        catalog: Arc::clone(&catalog),
        configs: Arc::clone(&configs),
        state_secret: oauth_state_secret.clone(),
        callback_base_url,
    });

    let oauth_engine_state = Arc::new(OAuthEngineState {
        engine,
        catalog,
        configs,
        state_secret: oauth_state_secret,
    });
    tracing::info!("OAuth engine v2 initialized");
    // ── End OAuth Engine v2 ─────────────────────────────────────────────────

    // Initialize the event bus for publishing OAuth events (Plan 4 / P4T8).
    let event_bus = Arc::new(PgEventBus::new(
        pool.inner().clone(),
        "signapps-identity".to_string(),
    ));

    // Create application state
    let state = AppState {
        pool,
        jwt_secret: config.jwt_secret.clone(),
        jwt_config,
        cache,
        keystore,
        security_policies: handlers::admin_security::SecurityPoliciesStore::new(),
        active_sessions: handlers::admin_security::ActiveSessionsStore::new(),
        login_attempts: handlers::admin_security::LoginAttemptsStore::new(),
        migration: handlers::migration::MigrationStore::new(),
        oauth_engine_state,
        event_bus,
    };

    // Spawn periodic OAuth token refresh job (Plan 5 / P5T4).
    refresh_job::spawn(state.clone());
    tracing::info!("oauth refresh job spawned");

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
    /// Master keystore — used by OAuth credential resolver (Plan 3 / P3T10).
    pub keystore: Arc<Keystore>,
    /// In-memory security policies store (admin-managed).
    pub security_policies: handlers::admin_security::SecurityPoliciesStore,
    /// In-memory active sessions store.
    pub active_sessions: handlers::admin_security::ActiveSessionsStore,
    /// In-memory recent failed login attempts store.
    pub login_attempts: handlers::admin_security::LoginAttemptsStore,
    /// In-memory migration job store (V2-15).
    pub migration: handlers::migration::MigrationStore,
    /// OAuth2/OIDC engine state — wired in P3T9, credential resolver added in P3T10.
    pub oauth_engine_state: Arc<OAuthEngineState>,
    /// Event bus for publishing platform events (Plan 4 / P4T8).
    pub event_bus: Arc<PgEventBus>,
    // data_export moved to signapps-compliance service (port 3032)
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
            "http://localhost:3000".parse().expect("valid CORS origin"),
            "http://127.0.0.1:3000".parse().expect("valid CORS origin"),
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
            .layer(axum_middleware::from_fn(move |req, next| {
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
            .layer(axum_middleware::from_fn(move |req, next| {
                let limiter = password_reset_limiter_clone.clone();
                async move {
                    signapps_common::rate_limit::rate_limit_middleware(limiter, req, next).await
                }
            }));

    // OpenAPI spec + Swagger UI (utoipa code-first)
    let openapi_routes =
        SwaggerUi::new("/swagger-ui").url("/api/v1/openapi.json", IdentityApiDoc::openapi());

    // OAuth routes — public (browser redirect flows must be reachable without auth)
    let oauth_routes = Router::new()
        // GET /api/v1/oauth/providers — list embedded catalog
        .route(
            "/api/v1/oauth/providers",
            get(handlers::oauth::list_providers),
        )
        // POST /api/v1/oauth/{provider}/start — initiate authorization flow
        .route(
            "/api/v1/oauth/:provider/start",
            post(handlers::oauth::start_flow),
        )
        // GET /api/v1/oauth/{provider}/callback — handle provider redirect
        .route(
            "/api/v1/oauth/:provider/callback",
            get(handlers::oauth::callback),
        )
        // POST /api/v1/oauth/internal/refresh — service-to-identity lazy refresh
        // Auth via X-Internal-Token shared secret (OAUTH_INTERNAL_TOKEN env var),
        // NOT JWT — intentionally on public_routes.
        .route(
            "/api/v1/oauth/internal/refresh",
            post(handlers::oauth::internal_refresh::internal_refresh),
        );

    // Public routes (no auth required)
    let public_routes = Router::new()
        .merge(openapi_routes)
        .merge(oauth_routes)
        .route("/health", get(handlers::health::health_check))
        // JWKS endpoint — public, no auth required.
        // Exposes the RS256 public key(s) so other services can validate tokens
        // without calling back into the identity service (stateless validation).
        .route("/.well-known/jwks.json", get(handlers::jwks::jwks_handler))
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
        // Context selection (Unified Person Model — Task 4)
        .route("/api/v1/auth/contexts", get(handlers::auth::list_contexts))
        .route("/api/v1/auth/select-context", post(handlers::auth::select_context))
        .route("/api/v1/auth/switch-context", post(handlers::auth::switch_context))
        .route("/api/v1/auth/current-context", get(handlers::auth::current_context))
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
        .route("/api/v1/users/me/preferences/:section", patch(handlers::preferences::patch_preferences))
        .route("/api/v1/users/me/preferences/conflicts", get(handlers::preferences::check_conflicts))
        .route("/api/v1/users/me/preferences/reset", post(handlers::preferences::reset_preferences))
        .route("/api/v1/users/me/preferences/export", get(handlers::preferences::export_preferences))
        .route("/api/v1/users/me/preferences/import", post(handlers::preferences::import_preferences))
        // RGPD data export moved to signapps-compliance service (port 3032)
        // Activities moved to signapps-compliance service (port 3032).
        // Gateway forwards /api/v1/activities and /api/v1/activity/* → signapps-compliance:3032.
        // Audit logs moved to signapps-compliance service (port 3032).
        // Gateway forwards /api/v1/audit-logs/* and /api/v1/audit → signapps-compliance:3032.
        // Entity links — SYNC-CROSSLINKS
        .route(
            "/api/v1/links",
            get(handlers::entity_links::find_links).post(handlers::entity_links::create_link),
        )
        .route(
            "/api/v1/links/:id",
            delete(handlers::entity_links::remove_link),
        )
        // Session management (AQ-SESSMGT)
        .route("/api/v1/auth/sessions", get(handlers::sessions::list))
        .route("/api/v1/auth/sessions", delete(handlers::sessions::revoke_all))
        .route("/api/v1/auth/sessions/:id", delete(handlers::sessions::revoke))
        // API key management (AQ-APIKEY)
        .route("/api/v1/api-keys", get(handlers::api_keys::list))
        .route("/api/v1/api-keys", post(handlers::api_keys::create))
        .route("/api/v1/api-keys/:id", delete(handlers::api_keys::revoke))
        .route("/api/v1/api-keys/:id", patch(handlers::api_keys::patch))
        // Extended user profile (onboarding, streak)
        .route("/api/v1/users/me/profile", get(handlers::user_profile::get_profile))
        .route("/api/v1/users/me/profile", patch(handlers::user_profile::patch_profile))
        // Recent docs
        .route("/api/v1/users/me/recent-docs", get(handlers::user_profile::list_recent_docs))
        .route("/api/v1/users/me/recent-docs", post(handlers::user_profile::upsert_recent_doc))
        // Activity history
        .route("/api/v1/users/me/history", get(handlers::user_profile::list_history))
        .route("/api/v1/users/me/history", post(handlers::user_profile::add_history))
        // Streak check-in
        .route("/api/v1/users/me/streak/checkin", post(handlers::user_profile::streak_checkin))
        // AQ-GUES: Guest access token routes (auth required to create/list/revoke)
        .route("/api/v1/guest-tokens", post(handlers::guest_tokens::create_guest_token))
        .route("/api/v1/guest-tokens", get(handlers::guest_tokens::list_guest_tokens))
        .route("/api/v1/guest-tokens/:id", delete(handlers::guest_tokens::revoke_guest_token))
        // P6T3: User OAuth connection list + disconnect (JWT only, no admin guard)
        .route(
            "/api/v1/account/oauth-connections",
            get(handlers::oauth::account_connections::list_connections),
        )
        .route(
            "/api/v1/account/oauth-connections/:source_table/:id/disconnect",
            post(handlers::oauth::account_connections::disconnect),
        )
        // CO1/CO2/CO4: Compliance endpoints moved to signapps-compliance service (port 3032).
        // Gateway forwards /api/v1/compliance/* and /api/v1/users/me/export/* → signapps-compliance:3032.
        // Persons moved to signapps-contacts service (port 3021).
        // Org structure + Assignments moved to signapps-org service (port 3026).
        // Gateway forwards /api/v1/org/* and /api/v1/assignments/* → signapps-org:3026.
        // Sites moved to signapps-it-assets service (port 3022).
        // Gateway forwards /api/v1/sites/* → signapps-it-assets:3022.
        // Unified trash (cross-module soft-delete tracking)
        // NOTE: gateway /api/v1/trash routes to storage (file trash).
        // Unified trash uses /api/v1/unified-trash to avoid collision.
        .route(
            "/api/v1/unified-trash",
            get(handlers::trash::list_trash)
                .post(handlers::trash::create_trash)
                .delete(handlers::trash::purge_expired),
        )
        .route(
            "/api/v1/unified-trash/:id/restore",
            post(handlers::trash::restore_trash),
        )
        .route(
            "/api/v1/unified-trash/:id",
            delete(handlers::trash::delete_trash),
        )
        // Cross-module bookmarks (favorites)
        .route(
            "/api/v1/bookmarks",
            get(handlers::bookmarks::list_bookmarks).post(handlers::bookmarks::create_bookmark),
        )
        .route(
            "/api/v1/bookmarks/:id",
            delete(handlers::bookmarks::delete_bookmark),
        )
        // Bookmark collections
        .route(
            "/api/v1/bookmark-collections",
            get(handlers::bookmarks::list_collections).post(handlers::bookmarks::create_collection),
        )
        .route(
            "/api/v1/bookmark-collections/:id",
            delete(handlers::bookmarks::delete_collection),
        )
        // Help Center — FAQ articles and support tickets
        .route("/api/v1/help/faq", get(handlers::help::list_faq))
        .route("/api/v1/help/faq/:id", get(handlers::help::get_faq))
        .route(
            "/api/v1/help/tickets",
            get(handlers::help::list_tickets).post(handlers::help::create_ticket),
        )
        // Dashboard widget layouts
        .route("/api/v1/dashboard/layout", get(handlers::dashboard::get_layout).put(handlers::dashboard::save_layout))
        .route("/api/v1/dashboard/widgets/summary", get(handlers::dashboard::widgets_summary))
        // Keep notes
        .route(
            "/api/v1/keep/notes",
            get(handlers::keep::list_notes).post(handlers::keep::create_note),
        )
        .route(
            "/api/v1/keep/notes/:id",
            put(handlers::keep::update_note).delete(handlers::keep::delete_note),
        )
        .route(
            "/api/v1/keep/notes/:id/restore",
            post(handlers::keep::restore_note),
        )
        .route(
            "/api/v1/keep/labels",
            get(handlers::keep::list_labels).post(handlers::keep::create_label),
        )
        .route(
            "/api/v1/keep/labels/:id",
            delete(handlers::keep::delete_label),
        )
        .layer(axum_middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Tenant-scoped routes (auth + tenant context required)
    let tenant_routes = Router::new()
        // Tenant info
        .route("/api/v1/tenant", get(handlers::tenants::get_my_tenant))
        // WL1: Branding for current tenant (used by frontend on startup)
        .route("/api/v1/tenants/me/branding", get(handlers::branding::get_my_branding))
        // WL3: GET workspace features moved to signapps-tenant-config service (port 3029).
        // Gateway routes /api/v1/workspace/* (singular) → signapps-tenant-config:3029.
        // PUT /api/v1/workspaces/:id/features stays here (gateway /api/v1/workspaces → identity).
        .route("/api/v1/workspaces/:wid/features", put(handlers::workspace_features::update_workspace_features))
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
        // Resources/reservations moved to signapps-it-assets service (port 3022).
        // Gateway forwards /api/v1/resources/* and /api/v1/reservations/* → signapps-it-assets:3022.
        // Signatures + user-signatures moved to signapps-signatures service (port 3028).
        // Gateway forwards /api/v1/signatures/* and /api/v1/user-signatures/* → signapps-signatures:3028.
        .layer(axum_middleware::from_fn(tenant_context_middleware))
        .layer(axum_middleware::from_fn_with_state(
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
        // Webhooks moved to signapps-webhooks service (port 3027)
        // Gateway forwards /api/v1/webhooks/* → signapps-webhooks:3027
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
        // Feature flags moved to signapps-tenant-config service (port 3029).
        // Gateway forwards /api/v1/admin/feature-flags/* → signapps-tenant-config:3029.
        // Tenant CSS override moved to signapps-tenant-config service (port 3029)
        // Gateway forwards /api/v1/admin/tenants/:id/css → signapps-tenant-config:3029
        // WL1: Tenant branding (admin manages all tenants' branding) — kept in identity
        // because /api/v1/tenants/:id/branding shares prefix with tenant CRUD routes
        .route("/api/v1/tenants/:id/branding", get(handlers::branding::get_branding))
        .route("/api/v1/tenants/:id/branding", put(handlers::branding::update_branding))
        .route("/api/v1/tenants/:id/branding", delete(handlers::branding::reset_branding))
        // Database backup moved to signapps-backup service (port 3031).
        // Gateway forwards /api/v1/admin/backup* → signapps-backup:3031.
        // OAuth provider admin CRUD (P6T1)
        .route(
            "/api/v1/admin/oauth-providers",
            get(handlers::admin::oauth_providers::list_providers),
        )
        .route(
            "/api/v1/admin/oauth-providers/:key",
            get(handlers::admin::oauth_providers::get_provider),
        )
        .route(
            "/api/v1/admin/oauth-providers/:key",
            post(handlers::admin::oauth_providers::upsert_provider),
        )
        .route(
            "/api/v1/admin/oauth-providers/:key",
            delete(handlers::admin::oauth_providers::delete_provider),
        )
        // P6T2: smoke-test endpoint — runs engine.start, returns authorization_url, no persist
        .route(
            "/api/v1/admin/oauth-providers/:key/test",
            post(handlers::admin::oauth_providers::test_provider),
        )
        // P6T3: per-provider queue counters
        .route(
            "/api/v1/admin/oauth-providers/:key/stats",
            get(handlers::admin::oauth_providers::provider_stats),
        )
        .layer(axum_middleware::from_fn(require_admin))
        .layer(axum_middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Supply Chain routes moved to signapps-workforce service (port 3024).
    // Gateway forwards /api/v1/supply-chain/* → signapps-workforce:3024/api/v1/workforce/supply-chain/*.

    // LMS routes moved to signapps-workforce service (port 3024).
    // Gateway forwards /api/v1/lms/* → signapps-workforce:3024/api/v1/lms/*.

    // Comms routes (protected)
    let comms_routes = Router::new()
        .route(
            "/api/v1/comms/announcements",
            get(handlers::comms::list_announcements).post(handlers::comms::create_announcement),
        )
        .route(
            "/api/v1/comms/announcements/:id/read",
            post(handlers::comms::mark_read),
        )
        .route(
            "/api/v1/comms/announcements/:id/acknowledge",
            post(handlers::comms::acknowledge),
        )
        .route(
            "/api/v1/comms/polls",
            get(handlers::comms::list_polls).post(handlers::comms::create_poll),
        )
        .route(
            "/api/v1/comms/polls/:id/vote",
            post(handlers::comms::cast_vote),
        )
        .route(
            "/api/v1/comms/polls/:id/results",
            get(handlers::comms::poll_results),
        )
        .route(
            "/api/v1/comms/news-feed",
            get(handlers::comms::list_news).post(handlers::comms::create_news),
        )
        .layer(axum_middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Search routes (protected)
    let search_routes = Router::new()
        .route("/api/v1/search", get(handlers::search::global_search))
        .route(
            "/api/v1/search/suggestions",
            get(handlers::search::suggestions),
        )
        .route(
            "/api/v1/search/history",
            get(handlers::search::list_history).delete(handlers::search::clear_history),
        )
        .route(
            "/api/v1/search/saved",
            get(handlers::search::list_saved).post(handlers::search::create_saved),
        )
        .route(
            "/api/v1/search/saved/:id",
            delete(handlers::search::delete_saved),
        )
        .layer(axum_middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Reports routes (protected)
    let reports_routes = Router::new()
        .route(
            "/api/v1/reports",
            get(handlers::reports::list_reports).post(handlers::reports::create_report),
        )
        .route(
            "/api/v1/reports/:id",
            put(handlers::reports::update_report).delete(handlers::reports::delete_report),
        )
        .route(
            "/api/v1/reports/:id/execute",
            post(handlers::reports::execute_report),
        )
        .route(
            "/api/v1/reports/:id/executions",
            get(handlers::reports::list_executions),
        )
        .layer(axum_middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Accounting routes moved to signapps-billing service (port 8096).
    // Gateway forwards /api/v1/accounting/* → signapps-billing:8096.

    // Org structure routes moved to signapps-org service (port 3026).
    // Gateway forwards /api/v1/org/* and /api/v1/assignments/* → signapps-org:3026.

    // Vault routes moved to signapps-vault service (port 3025).
    // Gateway forwards /api/v1/vault/* → signapps-vault:3025.

    // CRM routes moved to signapps-contacts service (port 3021).
    // Gateway forwards /api/v1/crm/* → signapps-contacts:3021.

    // Company + person-company affiliation routes (Unified Person Model — Task 5)
    let company_routes = Router::new()
        .route(
            "/api/v1/companies",
            get(handlers::companies::list_companies).post(handlers::companies::create_company),
        )
        .route(
            "/api/v1/companies/:id",
            get(handlers::companies::get_company)
                .put(handlers::companies::update_company)
                .delete(handlers::companies::deactivate_company),
        )
        .route(
            "/api/v1/companies/:id/persons",
            get(handlers::companies::list_company_persons)
                .post(handlers::companies::add_company_person),
        )
        .route(
            "/api/v1/companies/:cid/persons/:pid",
            delete(handlers::companies::remove_company_person),
        )
        .route(
            "/api/v1/persons/:id/companies",
            get(handlers::companies::list_person_companies),
        )
        .route(
            "/api/v1/person-companies/:id",
            put(handlers::companies::update_affiliation),
        )
        .layer(axum_middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Combine all routes
    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .merge(tenant_routes)
        .merge(admin_routes)
        .merge(comms_routes)
        .merge(search_routes)
        .merge(reports_routes)
        .merge(company_routes)
        .layer(axum_middleware::from_fn(logging_middleware))
        .layer(axum_middleware::from_fn(request_id_middleware))
        .layer(axum_middleware::from_fn(security_headers_middleware))
        .layer(TraceLayer::new_for_http())
        .layer(axum::extract::DefaultBodyLimit::max(10 * 1024 * 1024))
        .layer(cors)
        .with_state(state)
}
