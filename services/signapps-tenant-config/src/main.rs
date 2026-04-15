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

    let public_routes = Router::new()
        .route("/health", get(health_check))
        .merge(signapps_common::version::router("signapps-tenant-config"));

    // Tenant-scoped routes (auth + tenant context required)
    let tenant_routes = Router::new()
        .route(
            "/api/v1/tenants/me/branding",
            get(handlers::branding::get_my_branding),
        )
        // WL3: Workspace feature flags GET (moved from identity — Refactor 34 Phase 9)
        // GET /api/v1/workspace/features — routed here via /api/v1/workspace prefix in gateway
        .route(
            "/api/v1/workspace/features",
            get(handlers::workspace_features::get_workspace_features),
        )
        // PUT /api/v1/workspaces/:id/features — also handled here (gateway routes /api/v1/workspace prefix)
        // For the PUT under /api/v1/workspaces (plural), the route is duplicated in identity for
        // backwards-compat since /api/v1/workspaces → identity in the gateway catch-all.
        .route(
            "/api/v1/workspaces/:wid/features",
            put(handlers::workspace_features::update_workspace_features),
        )
        .route_layer(middleware::from_fn(tenant_context_middleware))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Admin-only branding, CSS, and feature flag routes
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
        // Feature flags (moved from identity — Refactor 34 Phase 9)
        .route(
            "/api/v1/admin/feature-flags",
            get(handlers::feature_flags::list).post(handlers::feature_flags::create),
        )
        .route(
            "/api/v1/admin/feature-flags/:id",
            put(handlers::feature_flags::update).delete(handlers::feature_flags::delete),
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
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    fn make_state() -> AppState {
        let pg_pool = sqlx::PgPool::connect_lazy("postgres://fake:fake@localhost/fake")
            .expect("connect_lazy never fails");
        let pool = signapps_db::DatabasePool::new(pg_pool);
        let jwt_config = JwtConfig::hs256("test-secret-that-is-at-least-32-bytes-long".to_string());
        AppState { pool, jwt_config }
    }

    /// Verify the router can be constructed without panicking.
    /// Catches regressions like duplicate route registration or handler signature mismatches.
    #[tokio::test]
    async fn router_builds_successfully() {
        let app = create_router(make_state());
        assert!(std::mem::size_of_val(&app) > 0);
    }

    /// Verify the health endpoint exists and returns 200.
    #[tokio::test]
    async fn health_endpoint_returns_200() {
        let app = create_router(make_state());
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

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
