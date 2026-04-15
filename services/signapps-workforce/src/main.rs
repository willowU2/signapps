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

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize using bootstrap helpers
    init_tracing("signapps_workforce");
    load_env();

    let config = ServiceConfig::from_env("signapps-workforce", 3024);
    config.log_startup();

    // Create database pool
    let pool = signapps_db::create_pool(&config.database_url).await?;

    // JWT config — auto-detects RS256 or HS256 from environment
    let jwt_config = JwtConfig::from_env();

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
        .route("/nodes/:id", get(handlers::org::get_node))
        .route("/nodes/:id", put(handlers::org::update_node))
        .route("/nodes/:id", delete(handlers::org::delete_node))
        .route(
            "/nodes/:id/recursive",
            delete(handlers::org::delete_node_recursive),
        )
        .route("/nodes/:id/move", post(handlers::org::move_node))
        .route("/nodes/:id/children", get(handlers::org::get_children))
        .route(
            "/nodes/:id/descendants",
            get(handlers::org::get_descendants),
        )
        .route("/nodes/:id/ancestors", get(handlers::org::get_ancestors))
        .route(
            "/nodes/:id/effective-policy",
            get(handlers::policies::resolve_node),
        )
        .route("/node-types", get(handlers::org::list_node_types))
        .route("/node-types", post(handlers::org::create_node_type))
        .route("/node-types/:id", delete(handlers::org::delete_node_type))
        // Board routes (batch endpoint BEFORE parameterized routes)
        .route("/nodes/boards", get(handlers::boards::list_all_boards))
        .route("/nodes/:id/board", get(handlers::boards::get_board))
        .route("/nodes/:id/board", post(handlers::boards::create_board))
        .route("/nodes/:id/board", put(handlers::boards::update_board))
        .route("/nodes/:id/board", delete(handlers::boards::delete_board))
        .route(
            "/nodes/:id/board/members",
            post(handlers::boards::add_member),
        )
        .route(
            "/nodes/:id/board/members/:member_id",
            put(handlers::boards::update_member),
        )
        .route(
            "/nodes/:id/board/members/:member_id",
            delete(handlers::boards::remove_member),
        )
        .route(
            "/nodes/:id/effective-board",
            get(handlers::boards::get_effective_board),
        )
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // AD domain routes
    let ad_routes = Router::new()
        .route("/domains", get(handlers::ad::list_domains))
        .route("/domains", post(handlers::ad::create_domain))
        .route("/domains/:id", delete(handlers::ad::delete_domain))
        .route("/domains/:id/dns/zones", get(handlers::ad::list_dns_zones))
        .route("/domains/:id/keys", get(handlers::ad::list_keys))
        .route("/domains/:id/computers", get(handlers::ad::list_computers))
        .route("/domains/:id/gpos", get(handlers::ad::list_gpos))
        .route("/dns/zones/:zone_id/records", get(handlers::ad::list_dns_records))
        .route("/status", get(handlers::ad::dc_status))
        // ── Infrastructure extensions ──
        .route("/domains/:id/certificates", get(handlers::ad::list_certificates))
        .route("/domains/:id/dhcp/scopes", get(handlers::ad::list_dhcp_scopes))
        .route("/dhcp/scopes/:id/leases", get(handlers::ad::list_dhcp_leases))
        .route("/domains/:id/deploy/profiles", get(handlers::ad::list_deploy_profiles))
        .route("/deploy/profiles/:id/history", get(handlers::ad::list_deploy_history))
        // ── Infrastructure CRUD ──
        .route("/domains/:id/dhcp/scopes", post(handlers::ad::create_dhcp_scope))
        .route("/dhcp/scopes/:id", delete(handlers::ad::delete_dhcp_scope))
        .route("/domains/:id/deploy/profiles", post(handlers::ad::create_deploy_profile))
        .route("/deploy/profiles/:id", delete(handlers::ad::delete_deploy_profile))
        .route("/domains/:id/config", put(handlers::ad::update_domain_config))
        // ── Certificate lifecycle ──
        .route("/domains/:id/certificates", post(handlers::ad::issue_certificate))
        .route("/certificates/:id/revoke", post(handlers::ad::revoke_certificate))
        .route("/certificates/:id/renew", post(handlers::ad::renew_certificate))
        // ── DHCP reservations ──
        .route("/dhcp/scopes/:id/reservations", get(handlers::ad::list_dhcp_reservations))
        .route("/dhcp/scopes/:id/reservations", post(handlers::ad::create_dhcp_reservation))
        .route("/dhcp/reservations/:id", delete(handlers::ad::delete_dhcp_reservation))
        // ── Deploy assignments ──
        .route("/deploy/profiles/:id/assignments", get(handlers::ad::list_deploy_assignments))
        .route("/deploy/profiles/:id/assignments", post(handlers::ad::create_deploy_assignment))
        .route("/deploy/assignments/:id", delete(handlers::ad::delete_deploy_assignment))
        // ── AD Sync ──
        .route("/domains/:id/sync/stats", get(handlers::ad_sync::sync_queue_stats))
        .route("/domains/:id/sync/events", get(handlers::ad_sync::list_sync_events))
        .route("/domains/:id/ad-ous", get(handlers::ad_sync::list_ad_ous))
        .route("/domains/:id/ad-users", get(handlers::ad_sync::list_ad_users))
        .route("/domains/:id/dc-sites", get(handlers::ad_sync::list_dc_sites))
        .route("/org-nodes/:id/mail-domain", put(handlers::ad_sync::set_node_mail_domain))
        .route("/org-nodes/:id/mail-domain", delete(handlers::ad_sync::remove_node_mail_domain))
        .route("/sync/reconcile", post(handlers::ad_sync::trigger_reconciliation))
        // ── Phase 5: mail aliases & shared mailboxes ──
        .route(
            "/ad-users/:id/mail-aliases",
            get(handlers::ad_sync::list_user_mail_aliases),
        )
        .route(
            "/domains/:id/shared-mailboxes",
            get(handlers::ad_sync::list_shared_mailboxes),
        )
        .route(
            "/shared-mailboxes/:id/config",
            put(handlers::ad_sync::update_shared_mailbox_config),
        )
        // ── Phase 3: DC Lifecycle ──
        .route(
            "/domains/:id/dc-sites",
            post(handlers::ad_sync::promote_dc),
        )
        .route(
            "/dc-sites/:id/demote",
            post(handlers::ad_sync::demote_dc),
        )
        .route(
            "/domains/:id/fsmo/transfer",
            post(handlers::ad_sync::transfer_fsmo),
        )
        // ── Phase 4: Snapshots ──
        .route(
            "/domains/:id/snapshots",
            get(handlers::ad_sync::list_snapshots),
        )
        .route(
            "/domains/:id/snapshots",
            post(handlers::ad_sync::create_snapshot),
        )
        .route(
            "/snapshots/:id/preview",
            post(handlers::ad_sync::restore_preview),
        )
        .route(
            "/snapshots/:id/restore",
            post(handlers::ad_sync::restore_execute),
        )
        // ── Update endpoints ──
        .route("/domains/:id", put(handlers::ad::update_domain))
        .route("/deploy/profiles/:id", put(handlers::ad::update_deploy_profile))
        .route("/dhcp/scopes/:id", put(handlers::ad::update_dhcp_scope))
        // ── Maintenance & Monitoring ──
        .route("/dhcp/leases/expire", post(handlers::ad::expire_dhcp_leases))
        .route("/certificates/expiring", get(handlers::ad::check_expiring_certificates))
        .route("/health/infrastructure", get(handlers::ad::infrastructure_health))
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
        .route("/:id", get(handlers::employees::get_employee))
        .route("/:id", put(handlers::employees::update_employee))
        .route("/:id", delete(handlers::employees::delete_employee))
        .route("/:id/link-user", post(handlers::employees::link_user))
        .route("/:id/unlink-user", post(handlers::employees::unlink_user))
        .route("/:id/functions", get(handlers::employees::get_functions))
        .route("/:id/functions", put(handlers::employees::update_functions))
        .route(
            "/by-node/:node_id",
            get(handlers::employees::list_by_org_node),
        )
        .route("/search", get(handlers::employees::search_employees))
        .route("/:id/memberof", get(handlers::groups::get_person_groups))
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
        .route("/:id", put(handlers::employees::update_function_definition))
        .route(
            "/:id",
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

    // Group routes
    let group_routes = Router::new()
        .route("/", get(handlers::groups::list_groups))
        .route("/", post(handlers::groups::create_group))
        .route("/:id", get(handlers::groups::get_group))
        .route("/:id", put(handlers::groups::update_group))
        .route("/:id", delete(handlers::groups::delete_group))
        .route("/:id/members", post(handlers::groups::add_member))
        .route(
            "/:id/members/:member_id",
            delete(handlers::groups::remove_member),
        )
        .route(
            "/:id/effective-members",
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
        .route("/:id", get(handlers::policies::get_policy))
        .route("/:id", put(handlers::policies::update_policy))
        .route("/:id", delete(handlers::policies::delete_policy))
        .route("/:id/links", post(handlers::policies::add_link))
        .route(
            "/:id/links/:link_id",
            delete(handlers::policies::remove_link),
        )
        .route(
            "/resolve/:person_id",
            get(handlers::policies::resolve_person),
        )
        .route(
            "/resolve/node/:node_id",
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
        .route("/:id", put(handlers::delegations::update_delegation))
        .route("/:id", delete(handlers::delegations::revoke_delegation))
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

    // AD Provisioning routes
    let ad_provision_routes = Router::new()
        // bulk BEFORE /:person_id to avoid path-param conflict
        .route("/bulk", post(handlers::ad_provisioning::bulk_provision))
        .route("/:person_id", post(handlers::ad_provisioning::provision_person))
        .route("/:person_id/preview", get(handlers::ad_provisioning::preview_provision))
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // AD Delegation routes (manager-scoped)
    let ad_delegation_routes = Router::new()
        .route("/my-team/ad-accounts", get(handlers::ad_delegation::my_team_ad_accounts))
        .route("/my-team/computers", get(handlers::ad_delegation::my_team_computers))
        .route("/my-team/gpo", get(handlers::ad_delegation::my_team_gpo))
        .route("/my-team/ad-accounts/:id/disable", post(handlers::ad_delegation::disable_account))
        .route("/my-team/ad-accounts/:id/enable", post(handlers::ad_delegation::enable_account))
        .route(
            "/my-team/ad-accounts/:id/reset-password",
            post(handlers::ad_delegation::reset_password),
        )
        .route("/my-team/ad-accounts/:id/move", put(handlers::ad_delegation::move_account))
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // AD GPO resolution routes
    let ad_gpo_routes = Router::new()
        // /hierarchy/:node_id BEFORE /:node_id to avoid conflict
        .route("/hierarchy/:node_id", get(handlers::ad_gpo::gpo_hierarchy))
        .route("/no-inherit/:node_id", put(handlers::ad_gpo::toggle_no_inherit))
        .route("/:node_id", get(handlers::ad_gpo::effective_gpo))
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
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
        .route(
            "/leaves/:id/reject",
            post(handlers::my_team::reject_leave),
        )
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

    // Combine all routes
    Router::new()
        .merge(signapps_common::version::router("signapps-workforce"))
        .nest("/api/v1/workforce/ad", ad_routes)
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
        .nest("/api/v1/lms", lms_routes)
        .nest("/api/v1/workforce/supply-chain", supply_chain_routes)
        .nest("/api/v1/workforce/expenses", expenses_routes)
        .nest("/api/v1/workforce/timesheet", timesheet_routes)
        .nest("/api/v1/workforce/my-team", my_team_routes)
        .nest("/api/v1/workforce/ad/provision", ad_provision_routes)
        .nest("/api/v1/workforce/ad/delegation", ad_delegation_routes)
        .nest("/api/v1/workforce/ad/gpo", ad_gpo_routes)
        .nest("/health", health_routes)
        .merge(handlers::openapi::swagger_router())
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
