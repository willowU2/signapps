//! SignApps Workforce Service — HR-pure subset (post S1 cutover).
//!
//! After the S1 org+RBAC refonte (2026-04-18) this service keeps only
//! HR domains: attendance, audit, coverage, expenses, learning, LMS,
//! my-team, supply chain, timesheets, validation. Everything related to
//! the organizational hierarchy (nodes, persons, assignments, policies,
//! boards, groups, delegations, AD) now lives in `signapps-org`.
//!
//! Exposes [`router`] so the single-binary runtime (`signapps-platform`)
//! can mount the workforce routes without owning its own pool.

#![allow(clippy::assertions_on_constants)]
// Pre-existing lints in handler modules inherited from when this crate was
// bin-only (compiled as `--bin` so clippy on the lib never reached them).
#![allow(clippy::type_complexity)]
#![allow(clippy::useless_vec)]

pub mod handlers;
pub mod services;

use axum::{
    routing::{delete, get, post, put},
    Router,
};
use signapps_common::middleware::AuthState;
use signapps_common::JwtConfig;
use signapps_db::DatabasePool;
use signapps_service::shared_state::SharedState;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

/// Application state.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub jwt_config: JwtConfig,
    /// HTTP client for internal cross-service calls (e.g. to signapps-scheduler)
    pub http_client: reqwest::Client,
    /// Base URL of the scheduler service (env: SCHEDULER_URL, default: http://localhost:3007/api/v1)
    pub scheduler_base_url: String,
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

/// Build the workforce router using the shared runtime state.
///
/// # Errors
///
/// Returns an error if the inter-service HTTP client cannot be built.
pub async fn router(shared: SharedState) -> anyhow::Result<Router> {
    let state = build_state(&shared).await?;
    Ok(create_router(state))
}

async fn build_state(shared: &SharedState) -> anyhow::Result<AppState> {
    let http_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;
    let scheduler_base_url = std::env::var("SCHEDULER_URL")
        .unwrap_or_else(|_| "http://localhost:3007/api/v1".to_string());

    Ok(AppState {
        pool: shared.pool.clone(),
        jwt_config: (*shared.jwt).clone(),
        http_client,
        scheduler_base_url,
        resolver: shared.resolver.clone(),
    })
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

    // Coverage template routes
    let coverage_template_routes = Router::new()
        .route("/", get(handlers::coverage::list_templates))
        .route("/", post(handlers::coverage::create_template))
        .route("/:id", get(handlers::coverage::get_template))
        .route("/:id", put(handlers::coverage::update_template))
        .route("/:id", delete(handlers::coverage::delete_template))
        .route(
            "/:id/duplicate",
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
        .route("/:id", get(handlers::coverage::get_rule))
        .route("/:id", put(handlers::coverage::update_rule))
        .route("/:id", delete(handlers::coverage::delete_rule))
        .route(
            "/by-node/:node_id",
            get(handlers::coverage::get_rules_by_node),
        )
        .route(
            "/effective/:node_id",
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
        .route("/courses/:id", get(handlers::learning::get_course))
        .route(
            "/courses/:id/progress",
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

    // Audit routes (read-only queries over the canonical audit log)
    let audit_routes = Router::new()
        .route("/", get(handlers::audit::query_audit))
        .route(
            "/entity/:entity_type/:entity_id",
            get(handlers::audit::entity_history),
        )
        .route("/actor/:actor_id", get(handlers::audit::actor_history))
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // LMS routes (extracted from signapps-identity)
    let lms_routes = Router::new()
        .route(
            "/courses",
            get(handlers::lms::list_courses).post(handlers::lms::create_course),
        )
        .route(
            "/courses/:id",
            get(handlers::lms::get_course).patch(handlers::lms::patch_course),
        )
        .route(
            "/progress",
            get(handlers::lms::list_progress).post(handlers::lms::track_progress),
        )
        .route(
            "/discussions",
            get(handlers::lms::list_discussions).post(handlers::lms::create_discussion),
        )
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Supply Chain routes (extracted from signapps-identity)
    let supply_chain_routes = Router::new()
        .route(
            "/purchase-orders",
            get(handlers::supply_chain::list_purchase_orders)
                .post(handlers::supply_chain::create_purchase_order),
        )
        .route(
            "/purchase-orders/:id",
            get(handlers::supply_chain::get_purchase_order)
                .patch(handlers::supply_chain::patch_purchase_order)
                .delete(handlers::supply_chain::delete_purchase_order),
        )
        .route(
            "/warehouses",
            get(handlers::supply_chain::list_warehouses)
                .post(handlers::supply_chain::create_warehouse),
        )
        .route("/inventory", get(handlers::supply_chain::list_inventory))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Expenses routes (CRUD + approval workflow)
    let expenses_routes = Router::new()
        .route("/", get(handlers::expenses::list_expenses))
        .route("/", post(handlers::expenses::create_expense))
        .route("/:id", put(handlers::expenses::update_expense))
        .route("/:id", delete(handlers::expenses::delete_expense))
        .route("/:id/submit", post(handlers::expenses::submit_expense))
        .route("/:id/approve", post(handlers::expenses::approve_expense))
        .route("/:id/reject", post(handlers::expenses::reject_expense))
        .route("/:id/mark-paid", post(handlers::expenses::mark_paid))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Timesheet routes (CRUD + timer start/stop + stats)
    let timesheet_routes = Router::new()
        .route("/", get(handlers::timesheet::list_entries))
        .route("/", post(handlers::timesheet::create_entry))
        .route("/start", post(handlers::timesheet::start_timer))
        .route("/stop", post(handlers::timesheet::stop_timer))
        .route("/stats", get(handlers::timesheet::get_stats))
        .route("/:id", put(handlers::timesheet::update_entry))
        .route("/:id", delete(handlers::timesheet::delete_entry))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // My Team routes (manager/direct-reports resolution)
    let my_team_routes = Router::new()
        .route("/", get(handlers::my_team::get_my_team))
        .route("/extended", get(handlers::my_team::get_extended_team))
        .route("/manager", get(handlers::my_team::get_manager))
        .route("/peers", get(handlers::my_team::get_peers))
        .route("/summary", get(handlers::my_team::get_team_summary))
        .route(
            "/pending-actions",
            get(handlers::my_team::get_pending_actions),
        )
        .route(
            "/leaves/:id/approve",
            post(handlers::my_team::approve_leave),
        )
        .route("/leaves/:id/reject", post(handlers::my_team::reject_leave))
        .route(
            "/timesheets/:id/approve",
            post(handlers::my_team::approve_timesheet),
        )
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Combine all routes — HR-only after S1 cutover.
    Router::new()
        .merge(signapps_common::version::router("signapps-workforce"))
        .nest("/api/v1/workforce/attendance", attendance_routes)
        .nest(
            "/api/v1/workforce/coverage/templates",
            coverage_template_routes,
        )
        .nest("/api/v1/workforce/coverage/rules", coverage_rule_routes)
        .nest("/api/v1/workforce/validate", validation_routes)
        .nest("/api/v1/workforce/audit", audit_routes)
        .nest("/api/v1/learning", learning_routes)
        .nest("/api/v1/lms", lms_routes)
        .nest("/api/v1/workforce/supply-chain", supply_chain_routes)
        .nest("/api/v1/workforce/expenses", expenses_routes)
        .nest("/api/v1/workforce/timesheet", timesheet_routes)
        .nest("/api/v1/workforce/my-team", my_team_routes)
        .nest("/health", health_routes)
        .merge(handlers::openapi::swagger_router())
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
