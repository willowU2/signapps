//! SignApps Integrations Service
//!
//! External integrations — Slack, Teams, Discord, and other third-party connectors.
//! Extracted from signapps-identity (Refactor 34, Phase 7).
//! Port: 3030

mod handlers;

use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::{auth_middleware, require_admin, AuthState};
use signapps_common::JwtConfig;
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
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    public_routes
        .merge(slack_public_routes)
        .merge(slack_admin_routes)
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
// Entry point
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing("signapps_integrations");
    load_env();

    let config = ServiceConfig::from_env("signapps-integrations", 3030);
    config.log_startup();

    let db_pool = signapps_db::create_pool(&config.database_url).await?;

    if let Err(e) = signapps_db::run_migrations(&db_pool).await {
        tracing::warn!(
            "Database migrations could not be completed, continuing anyway: {:?}",
            e
        );
    }

    let pool = db_pool.inner().clone();

    let jwt_config = JwtConfig::from_env();

    let state = AppState { pool, jwt_config };

    tracing::info!("Integrations service ready on port 3030");

    let app = create_router(state);

    signapps_common::bootstrap::run_server(app, &config).await?;

    Ok(())
}
