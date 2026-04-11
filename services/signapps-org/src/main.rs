//! SignApps Org Service
//!
//! Organizational structure service — nodes, trees, assignments, orgchart.
//! Extracted from signapps-identity (Refactor 34, Phase 5).
//! Port: 3026

mod handlers;
mod middleware;

use axum::{
    middleware as axum_middleware,
    routing::{get, post, put},
    Router,
};
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::{auth_middleware, AuthState};
use signapps_common::JwtConfig;
use signapps_db::DatabasePool;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------

/// Application state shared across org handlers.
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

    let org_routes = Router::new()
        // Org structure — trees
        .route(
            "/api/v1/org/trees",
            get(handlers::org_trees::list_trees).post(handlers::org_trees::create_tree),
        )
        .route(
            "/api/v1/org/trees/:id/full",
            get(handlers::org_trees::get_full_tree),
        )
        // Org structure — nodes
        .route(
            "/api/v1/org/nodes/:id",
            get(handlers::org_nodes::get_node)
                .put(handlers::org_nodes::update_node)
                .delete(handlers::org_nodes::delete_node),
        )
        .route("/api/v1/org/nodes", post(handlers::org_nodes::create_node))
        .route(
            "/api/v1/org/nodes/:id/move",
            post(handlers::org_nodes::move_node),
        )
        .route(
            "/api/v1/org/nodes/:id/children",
            get(handlers::org_nodes::get_children),
        )
        .route(
            "/api/v1/org/nodes/:id/descendants",
            get(handlers::org_nodes::get_descendants),
        )
        .route(
            "/api/v1/org/nodes/:id/ancestors",
            get(handlers::org_nodes::get_ancestors),
        )
        .route(
            "/api/v1/org/nodes/:id/assignments",
            get(handlers::org_nodes::get_node_assignments),
        )
        .route(
            "/api/v1/org/nodes/:id/permissions",
            get(handlers::org_nodes::get_node_permissions)
                .put(handlers::org_nodes::set_node_permissions),
        )
        // Orgchart
        .route(
            "/api/v1/org/orgchart",
            get(handlers::org_nodes::get_orgchart),
        )
        // Org context (authenticated user's position in the org)
        .route(
            "/api/v1/org/context",
            get(handlers::org_context::get_context),
        )
        // Assignments
        .route(
            "/api/v1/assignments",
            post(handlers::assignments::create_assignment),
        )
        .route(
            "/api/v1/assignments/history",
            get(handlers::assignments::list_history),
        )
        .route(
            "/api/v1/assignments/:id",
            put(handlers::assignments::update_assignment)
                .delete(handlers::assignments::end_assignment),
        )
        .route_layer(axum_middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    public_routes
        .merge(org_routes)
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
        "service": "signapps-org",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": signapps_common::healthz::uptime_seconds(),
        "app": {
            "id": "org",
            "label": "Organisation",
            "description": "Structure organisationnelle — noeuds, arbres, affectations, organigramme",
            "icon": "Network",
            "category": "Administration",
            "color": "text-indigo-600",
            "href": "/admin/org-structure",
            "port": 3026
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

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing("signapps_org");
    load_env();

    let config = ServiceConfig::from_env("signapps-org", 3026);
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

    tracing::info!("Org service ready on port 3026");

    let app = create_router(state);

    signapps_common::bootstrap::run_server(app, &config).await?;

    Ok(())
}
