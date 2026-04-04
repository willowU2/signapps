//! SignApps Workforce Service - Organizational Structure & Workforce Planning
//!
//! This service manages workforce planning including:
//! - Organizational hierarchy (TreeList with closure table)
//! - Employee management (distinct from Users)
//! - Coverage rules and templates (trames)
//! - Validation engine for scheduling gaps and leave simulation

use axum::{
    routing::{delete, get, post, put},
    Router,
};
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

mod handlers;
mod services;

use signapps_common::middleware::AuthState;
use signapps_common::{JwtConfig, Result};
use signapps_db::DatabasePool;

/// Application state.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub jwt_config: JwtConfig,
    /// HTTP client for internal cross-service calls (e.g. to signapps-scheduler)
    pub http_client: reqwest::Client,
    /// Base URL of the scheduler service (env: SCHEDULER_URL, default: http://localhost:3007/api/v1)
    pub scheduler_base_url: String,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize using bootstrap helpers
    init_tracing("signapps_workforce");
    load_env();

    let config = ServiceConfig::from_env("signapps-workforce", 3024);
    config.log_startup();

    // Create database pool
    let pool = signapps_db::create_pool(&config.database_url).await?;

    // Create JWT config
    let jwt_config = JwtConfig {
        secret: config.jwt_secret.clone(),
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
        access_expiration: 3600,
        refresh_expiration: 86400 * 7,
    };

    // Inter-service HTTP client for scheduler cross-calls
    let http_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .expect("Failed to build reqwest client");
    let scheduler_base_url = std::env::var("SCHEDULER_URL")
        .unwrap_or_else(|_| "http://localhost:3007/api/v1".to_string());

    // Create application state
    let state = AppState {
        pool,
        jwt_config,
        http_client,
        scheduler_base_url,
    };

    // Build router
    let app = create_router(state);

    // Start server using bootstrap helper
    signapps_common::bootstrap::run_server(app, &config).await?;

    Ok(())
}

fn create_router(state: AppState) -> Router {
    // CORS configuration
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            "http://localhost:3000".parse().expect("valid origin"),
            "http://127.0.0.1:3000".parse().expect("valid origin"),
        ]))
        .allow_credentials(true)
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
        ]);

    // Health check
    let health_routes = Router::new().route("/", get(handlers::health_check));

    // Organizational tree routes
    let org_routes = Router::new()
        .route("/tree", get(handlers::org::get_tree))
        .route("/nodes", post(handlers::org::create_node))
        .route("/nodes/{id}", get(handlers::org::get_node))
        .route("/nodes/{id}", put(handlers::org::update_node))
        .route("/nodes/{id}", delete(handlers::org::delete_node))
        .route(
            "/nodes/{id}/recursive",
            delete(handlers::org::delete_node_recursive),
        )
        .route("/nodes/{id}/move", post(handlers::org::move_node))
        .route("/nodes/{id}/children", get(handlers::org::get_children))
        .route(
            "/nodes/{id}/descendants",
            get(handlers::org::get_descendants),
        )
        .route("/nodes/{id}/ancestors", get(handlers::org::get_ancestors))
        .route(
            "/nodes/{id}/effective-policy",
            get(handlers::policies::resolve_node),
        )
        .route("/node-types", get(handlers::org::list_node_types))
        .route("/node-types", post(handlers::org::create_node_type))
        .route("/node-types/{id}", delete(handlers::org::delete_node_type))
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Employee routes
    let employee_routes = Router::new()
        .route("/", get(handlers::employees::list_employees))
        .route("/", post(handlers::employees::create_employee))
        .route("/import", post(handlers::employees::import_employees))
        .route("/{id}", get(handlers::employees::get_employee))
        .route("/{id}", put(handlers::employees::update_employee))
        .route("/{id}", delete(handlers::employees::delete_employee))
        .route("/{id}/link-user", post(handlers::employees::link_user))
        .route("/{id}/unlink-user", post(handlers::employees::unlink_user))
        .route("/{id}/functions", get(handlers::employees::get_functions))
        .route(
            "/{id}/functions",
            put(handlers::employees::update_functions),
        )
        .route(
            "/by-node/{node_id}",
            get(handlers::employees::list_by_org_node),
        )
        .route("/search", get(handlers::employees::search_employees))
        .route("/{id}/memberof", get(handlers::groups::get_person_groups))
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Function definition routes
    let function_routes = Router::new()
        .route("/", get(handlers::employees::list_function_definitions))
        .route("/", post(handlers::employees::create_function_definition))
        .route(
            "/{id}",
            put(handlers::employees::update_function_definition),
        )
        .route(
            "/{id}",
            delete(handlers::employees::delete_function_definition),
        )
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Coverage template routes
    let coverage_template_routes = Router::new()
        .route("/", get(handlers::coverage::list_templates))
        .route("/", post(handlers::coverage::create_template))
        .route("/{id}", get(handlers::coverage::get_template))
        .route("/{id}", put(handlers::coverage::update_template))
        .route("/{id}", delete(handlers::coverage::delete_template))
        .route(
            "/{id}/duplicate",
            post(handlers::coverage::duplicate_template),
        )
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Coverage rule routes (applied to org nodes)
    let coverage_rule_routes = Router::new()
        .route("/", get(handlers::coverage::list_rules))
        .route("/", post(handlers::coverage::create_rule))
        .route("/{id}", get(handlers::coverage::get_rule))
        .route("/{id}", put(handlers::coverage::update_rule))
        .route("/{id}", delete(handlers::coverage::delete_rule))
        .route(
            "/by-node/{node_id}",
            get(handlers::coverage::get_rules_by_node),
        )
        .route(
            "/effective/{node_id}",
            get(handlers::coverage::get_effective_coverage),
        )
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Learning routes
    let learning_routes = Router::new()
        .route("/courses", get(handlers::learning::list_courses))
        .route("/courses/{id}", get(handlers::learning::get_course))
        .route(
            "/courses/{id}/progress",
            put(handlers::learning::update_progress),
        )
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // HR2: Attendance routes
    let attendance_routes = Router::new()
        .route("/clock-in", post(handlers::attendance::clock_in))
        .route("/clock-out", post(handlers::attendance::clock_out))
        .route("/", get(handlers::attendance::list_attendance))
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Validation routes
    let validation_routes = Router::new()
        .route("/coverage", post(handlers::validation::validate_coverage))
        .route("/gaps", get(handlers::validation::analyze_gaps))
        .route(
            "/leave-simulation",
            post(handlers::validation::simulate_leave),
        )
        .route(
            "/shift-simulation",
            post(handlers::validation::simulate_shift_change),
        )
        .route("/conflicts", get(handlers::validation::get_conflicts))
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Group routes
    let group_routes = Router::new()
        .route("/", get(handlers::groups::list_groups))
        .route("/", post(handlers::groups::create_group))
        .route("/{id}", get(handlers::groups::get_group))
        .route("/{id}", put(handlers::groups::update_group))
        .route("/{id}", delete(handlers::groups::delete_group))
        .route("/{id}/members", post(handlers::groups::add_member))
        .route(
            "/{id}/members/{member_id}",
            delete(handlers::groups::remove_member),
        )
        .route(
            "/{id}/effective-members",
            get(handlers::groups::get_effective_members),
        )
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Policy routes
    let policy_routes = Router::new()
        .route("/", get(handlers::policies::list_policies))
        .route("/", post(handlers::policies::create_policy))
        .route("/simulate", post(handlers::policies::simulate_policy))
        .route("/{id}", get(handlers::policies::get_policy))
        .route("/{id}", put(handlers::policies::update_policy))
        .route("/{id}", delete(handlers::policies::delete_policy))
        .route("/{id}/links", post(handlers::policies::add_link))
        .route(
            "/{id}/links/{link_id}",
            delete(handlers::policies::remove_link),
        )
        .route(
            "/resolve/{person_id}",
            get(handlers::policies::resolve_person),
        )
        .route(
            "/resolve/node/{node_id}",
            get(handlers::policies::resolve_node),
        )
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Delegation routes
    let delegation_routes = Router::new()
        .route("/", get(handlers::delegations::list_delegations))
        .route("/", post(handlers::delegations::create_delegation))
        .route("/{id}", put(handlers::delegations::update_delegation))
        .route("/{id}", delete(handlers::delegations::revoke_delegation))
        .route("/my", get(handlers::delegations::my_delegations))
        .route("/granted", get(handlers::delegations::granted_delegations))
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Audit routes
    let audit_routes = Router::new()
        .route("/", get(handlers::audit::query_audit))
        .route(
            "/entity/{entity_type}/{entity_id}",
            get(handlers::audit::entity_history),
        )
        .route("/actor/{actor_id}", get(handlers::audit::actor_history))
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Combine all routes
    Router::new()
        .nest("/api/v1/workforce/org", org_routes)
        .nest("/api/v1/workforce/employees", employee_routes)
        .nest("/api/v1/workforce/attendance", attendance_routes)
        .nest("/api/v1/workforce/functions", function_routes)
        .nest(
            "/api/v1/workforce/coverage/templates",
            coverage_template_routes,
        )
        .nest("/api/v1/workforce/coverage/rules", coverage_rule_routes)
        .nest("/api/v1/workforce/validate", validation_routes)
        .nest("/api/v1/workforce/groups", group_routes)
        .nest("/api/v1/workforce/policies", policy_routes)
        .nest("/api/v1/workforce/delegations", delegation_routes)
        .nest("/api/v1/workforce/audit", audit_routes)
        .nest("/api/v1/learning", learning_routes)
        .nest("/health", health_routes)
        .merge(handlers::openapi::swagger_router())
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
