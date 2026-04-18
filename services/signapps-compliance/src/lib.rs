//! Public library interface for signapps-compliance.
//!
//! Exposes [`router`] so the single-binary runtime (`signapps-platform`)
//! can mount the GDPR / RGPD compliance routes (DPIA, DSAR, data export,
//! retention purge, consent, cookie banner, audit logs) without owning
//! its own pool or JWT config. Spawns the daily retention purge job as a
//! detached tokio task tied to the factory scope.

#![allow(clippy::assertions_on_constants)]

pub mod handlers;

use axum::{
    middleware,
    routing::{get, patch, post, put},
    Router,
};
use signapps_common::middleware::{
    auth_middleware, require_admin, tenant_context_middleware, AuthState,
};
use signapps_common::JwtConfig;
use signapps_db::DatabasePool;
use signapps_service::shared_state::SharedState;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------

/// Application state shared across compliance handlers.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub jwt_config: JwtConfig,
    /// In-memory RGPD data export job store (one active job per user).
    pub data_export: handlers::data_export::DataExportStore,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

/// Build the compliance router using the shared runtime state. Also
/// spawns the daily retention purge job as a detached tokio task.
///
/// # Errors
///
/// Returns an error if shared-state cloning fails (none currently, but reserved).
pub async fn router(shared: SharedState) -> anyhow::Result<Router> {
    let state = build_state(&shared).await?;

    // Spawn daily data retention purge job (CO3).
    let purge_pool = state.pool.clone();
    tokio::spawn(async move {
        handlers::retention_purge::run_daily(purge_pool).await;
    });

    Ok(create_router(state))
}

async fn build_state(shared: &SharedState) -> anyhow::Result<AppState> {
    Ok(AppState {
        pool: shared.pool.clone(),
        jwt_config: (*shared.jwt).clone(),
        data_export: handlers::data_export::DataExportStore::new(),
    })
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn create_router(state: AppState) -> Router {
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
        .merge(signapps_common::version::router("signapps-compliance"));

    let user_routes = Router::new()
        .route(
            "/api/v1/activities",
            get(handlers::activities::list_activities),
        )
        .route(
            "/api/v1/activity/cross-module",
            get(handlers::activities::cross_module_activity),
        )
        .route(
            "/api/v1/users/me/export",
            post(handlers::data_export::request_export),
        )
        .route(
            "/api/v1/users/me/export/status",
            get(handlers::data_export::export_status),
        )
        .route(
            "/api/v1/users/me/export/download",
            get(handlers::data_export::download_export),
        )
        .route_layer(middleware::from_fn(tenant_context_middleware))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    let admin_routes = Router::new()
        .route(
            "/api/v1/audit-logs",
            get(handlers::audit_logs::list_audit_logs),
        )
        .route(
            "/api/v1/audit-logs/export",
            get(handlers::audit_logs::export_audit_logs),
        )
        .route(
            "/api/v1/audit-logs/:id",
            get(handlers::audit_logs::get_audit_log),
        )
        .route("/api/v1/audit", post(handlers::audit_logs::query_audit))
        .route(
            "/api/v1/compliance/dpia",
            post(handlers::compliance::save_dpia),
        )
        .route(
            "/api/v1/compliance/dpia",
            get(handlers::compliance::list_dpias),
        )
        .route(
            "/api/v1/compliance/dsar",
            post(handlers::compliance::create_dsar),
        )
        .route(
            "/api/v1/compliance/dsar",
            get(handlers::compliance::list_dsars),
        )
        .route(
            "/api/v1/compliance/dsar/:id",
            patch(handlers::compliance::update_dsar),
        )
        .route(
            "/api/v1/compliance/retention-policies",
            put(handlers::compliance::save_retention_policies),
        )
        .route(
            "/api/v1/compliance/retention-policies",
            get(handlers::compliance::get_retention_policies),
        )
        .route(
            "/api/v1/compliance/consent",
            put(handlers::compliance::save_consent),
        )
        .route(
            "/api/v1/compliance/consent",
            get(handlers::compliance::get_consent),
        )
        .route(
            "/api/v1/compliance/cookie-banner",
            put(handlers::compliance::save_cookie_banner),
        )
        .route(
            "/api/v1/compliance/cookie-banner",
            get(handlers::compliance::get_cookie_banner),
        )
        .route_layer(middleware::from_fn(require_admin))
        .route_layer(middleware::from_fn(tenant_context_middleware))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    public_routes
        .merge(user_routes)
        .merge(admin_routes)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

pub async fn health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "ok",
        "service": "signapps-compliance",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": signapps_common::healthz::uptime_seconds(),
        "app": {
            "id": "compliance",
            "label": "Compliance",
            "description": "RGPD/GDPR compliance: DPIA, DSAR, data export, retention",
            "icon": "ShieldCheck",
            "category": "Administration",
            "color": "text-emerald-600",
            "href": "/compliance",
            "port": 3032
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
        AppState {
            pool,
            jwt_config,
            data_export: handlers::data_export::DataExportStore::new(),
        }
    }

    #[tokio::test]
    async fn router_builds_successfully() {
        let app = create_router(make_state());
        assert!(std::mem::size_of_val(&app) > 0);
    }

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
