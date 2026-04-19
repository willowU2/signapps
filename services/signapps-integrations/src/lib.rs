//! Public library interface for signapps-integrations.
//!
//! Exposes [`router`] so the single-binary runtime (`signapps-platform`)
//! can mount the third-party connector routes (Slack, Teams, Discord,
//! automations, extensions, action catalog) without owning its own pool
//! or JWT config.

#![allow(clippy::assertions_on_constants)]

pub mod handlers;

use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use signapps_common::middleware::{
    auth_middleware, require_admin, tenant_context_middleware, AuthState,
};
use signapps_common::JwtConfig;
use signapps_service::shared_state::SharedState;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------

/// Application state shared across integrations handlers.
#[derive(Clone)]
pub struct AppState {
    pub pool: sqlx::PgPool,
    pub jwt_config: JwtConfig,
    /// Shared RBAC resolver injected by the runtime. `None` in tests.
    pub resolver: Option<
        std::sync::Arc<dyn signapps_common::rbac::resolver::OrgPermissionResolver>,
    >,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

/// Build the integrations router using the shared runtime state.
///
/// # Errors
///
/// Returns an error if shared-state cloning fails (none currently, but reserved).
pub async fn router(shared: SharedState) -> anyhow::Result<Router> {
    let state = build_state(&shared).await?;
    Ok(create_router(state))
}

async fn build_state(shared: &SharedState) -> anyhow::Result<AppState> {
    Ok(AppState {
        pool: shared.pool.inner().clone(),
        jwt_config: (*shared.jwt).clone(),
        resolver: shared.resolver.clone(),
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
        .merge(signapps_common::version::router("signapps-integrations"));

    // Slack webhook is public (Slack sends unauthenticated requests)
    let slack_public_routes = Router::new().route(
        "/api/v1/integrations/slack/webhook",
        post(handlers::slack::slack_webhook),
    );

    // Slack config routes require admin auth
    let slack_admin_routes = Router::new()
        .route(
            "/api/v1/integrations/slack/config",
            post(handlers::slack::save_slack_config).get(handlers::slack::get_slack_config),
        )
        .route_layer(middleware::from_fn(require_admin))
        .route_layer(middleware::from_fn(tenant_context_middleware))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Automation, extension, and action catalog routes (authenticated)
    let automation_routes = Router::new()
        .route(
            "/api/v1/automations",
            get(handlers::automations::list_automations)
                .post(handlers::automations::create_automation),
        )
        .route(
            "/api/v1/automations/:id",
            get(handlers::automations::get_automation)
                .put(handlers::automations::update_automation)
                .delete(handlers::automations::delete_automation),
        )
        .route(
            "/api/v1/automations/:id/steps",
            get(handlers::automations::list_steps).post(handlers::automations::add_step),
        )
        .route(
            "/api/v1/automations/:id/steps/:step_id",
            put(handlers::automations::update_step).delete(handlers::automations::delete_step),
        )
        .route(
            "/api/v1/automations/:id/run",
            post(handlers::automations::trigger_run),
        )
        .route(
            "/api/v1/automations/:id/runs",
            get(handlers::automations::list_runs),
        )
        .route(
            "/api/v1/extensions",
            get(handlers::automations::list_extensions)
                .post(handlers::automations::install_extension),
        )
        .route(
            "/api/v1/extensions/:id/approve",
            put(handlers::automations::approve_extension),
        )
        .route(
            "/api/v1/extensions/:id",
            delete(handlers::automations::uninstall_extension),
        )
        .route("/api/v1/actions", get(handlers::automations::list_actions))
        .route_layer(middleware::from_fn(tenant_context_middleware))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    public_routes
        .merge(slack_public_routes)
        .merge(slack_admin_routes)
        .merge(automation_routes)
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
        "service": "signapps-integrations",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": signapps_common::healthz::uptime_seconds(),
        "app": {
            "id": "integrations",
            "label": "Intégrations",
            "description": "Connecteurs tiers — Slack, Teams, Discord",
            "icon": "Plug",
            "category": "Avancé",
            "color": "text-violet-500",
            "href": "/integrations",
            "port": 3030
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
        let pool = sqlx::PgPool::connect_lazy("postgres://fake:fake@localhost/fake")
            .expect("connect_lazy never fails");
        let jwt_config = JwtConfig::hs256("test-secret-that-is-at-least-32-bytes-long".to_string());
        AppState { pool, jwt_config }
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
