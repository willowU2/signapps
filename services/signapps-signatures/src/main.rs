//! SignApps Signatures Service
//!
//! Electronic signature workflow (envelopes, steps, transitions) and
//! user personal signature/stamp management.
//! Extracted from signapps-identity (Refactor 34, Phase 6).
//! Port: 3028

mod handlers;

use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::{auth_middleware, tenant_context_middleware, AuthState};
use signapps_common::JwtConfig;
use signapps_db::DatabasePool;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------

/// Application state shared across signature handlers.
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
        .merge(signapps_common::version::router("signapps-signatures"));

    // Tenant-scoped signature routes (auth + tenant context required)
    let signature_routes = Router::new()
        // Envelope CRUD
        .route(
            "/api/v1/signatures",
            post(handlers::signatures::create_envelope),
        )
        .route(
            "/api/v1/signatures",
            get(handlers::signatures::list_envelopes),
        )
        .route(
            "/api/v1/signatures/:id",
            get(handlers::signatures::get_envelope),
        )
        .route(
            "/api/v1/signatures/:id/send",
            post(handlers::signatures::send_envelope),
        )
        .route(
            "/api/v1/signatures/:id/void",
            post(handlers::signatures::void_envelope),
        )
        // Steps
        .route(
            "/api/v1/signatures/:id/steps",
            post(handlers::signatures::add_step),
        )
        .route(
            "/api/v1/signatures/:id/steps",
            get(handlers::signatures::list_steps),
        )
        .route(
            "/api/v1/signatures/:id/steps/:step_id/sign",
            post(handlers::signatures::sign_step),
        )
        .route(
            "/api/v1/signatures/:id/steps/:step_id/decline",
            post(handlers::signatures::decline_step),
        )
        // Transitions
        .route(
            "/api/v1/signatures/:id/transitions",
            get(handlers::signatures::list_transitions),
        )
        // User signature/stamp management
        .route(
            "/api/v1/user-signatures",
            get(handlers::user_signatures::list_user_signatures)
                .post(handlers::user_signatures::create_user_signature),
        )
        .route(
            "/api/v1/user-signatures/:id",
            get(handlers::user_signatures::get_user_signature)
                .put(handlers::user_signatures::update_user_signature)
                .delete(handlers::user_signatures::delete_user_signature),
        )
        .route_layer(middleware::from_fn(tenant_context_middleware))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    public_routes
        .merge(signature_routes)
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
        "service": "signapps-signatures",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": signapps_common::healthz::uptime_seconds(),
        "app": {
            "id": "signatures",
            "label": "Signatures",
            "description": "Signature électronique et flux de validation de documents",
            "icon": "PenLine",
            "category": "Documents",
            "color": "text-violet-500",
            "href": "/signatures",
            "port": 3028
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
            .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
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
    init_tracing("signapps_signatures");
    load_env();

    let config = ServiceConfig::from_env("signapps-signatures", 3028);
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

    tracing::info!("Signatures service ready on port 3028");

    let app = create_router(state);

    signapps_common::bootstrap::run_server(app, &config).await?;

    Ok(())
}
