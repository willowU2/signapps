//! SignApps Tenant Config Service
//!
//! Per-tenant white-label configuration: logo, primary color, favicon, app name,
//! and raw CSS overrides (admin only).
//! Extracted from signapps-identity (Refactor 34, Phase 6).
//! Port: 3029

mod handlers;

use axum::{
    middleware,
    routing::{delete, get, put},
    Router,
};
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::{
    auth_middleware, require_admin, tenant_context_middleware, AuthState,
};
use signapps_common::JwtConfig;
use signapps_db::DatabasePool;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------

/// Application state shared across tenant-config handlers.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub jwt_config: JwtConfig,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

fn create_router(state: AppState) -> Router {
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

    let public_routes = Router::new().route("/health", get(health_check));

    // Tenant-scoped branding route accessible without admin (used on login page)
    let tenant_routes = Router::new()
        .route(
            "/api/v1/tenants/me/branding",
            get(handlers::branding::get_my_branding),
        )
        .route_layer(middleware::from_fn(tenant_context_middleware))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Admin-only branding and CSS routes
    let admin_routes = Router::new()
        // Branding (WL1) — admin manages all tenants
        .route(
            "/api/v1/tenants/:id/branding",
            get(handlers::branding::get_branding),
        )
        .route(
            "/api/v1/tenants/:id/branding",
            put(handlers::branding::update_branding),
        )
        .route(
            "/api/v1/tenants/:id/branding",
            delete(handlers::branding::reset_branding),
        )
        // CSS override (admin only)
        .route(
            "/api/v1/admin/tenants/:id/css",
            get(handlers::tenant_css::get_css),
        )
        .route(
            "/api/v1/admin/tenants/:id/css",
            put(handlers::tenant_css::set_css),
        )
        .route(
            "/api/v1/admin/tenants/:id/css",
            delete(handlers::tenant_css::clear_css),
        )
        .route_layer(middleware::from_fn(require_admin))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    public_routes
        .merge(tenant_routes)
        .merge(admin_routes)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

async fn health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "ok",
        "service": "signapps-tenant-config",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": signapps_common::healthz::uptime_seconds(),
        "app": {
            "id": "tenant-config",
            "label": "Configuration tenant",
            "description": "Personnalisation du branding et des styles CSS par tenant",
            "icon": "Palette",
            "category": "Administration",
            "color": "text-pink-500",
            "href": "/admin/tenant-config",
            "port": 3029
        }
    }))
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing("signapps_tenant_config");
    load_env();

    let config = ServiceConfig::from_env("signapps-tenant-config", 3029);
    config.log_startup();

    let pool = signapps_db::create_pool(&config.database_url).await?;

    if let Err(e) = signapps_db::run_migrations(&pool).await {
        tracing::warn!(
            "Database migrations could not be completed, continuing anyway: {:?}",
            e
        );
    }

    let jwt_config = JwtConfig::from_env();

    let state = AppState { pool, jwt_config };

    tracing::info!("Tenant Config service ready on port 3029");

    let app = create_router(state);

    signapps_common::bootstrap::run_server(app, &config).await?;

    Ok(())
}
