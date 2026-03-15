//! SignApps Scheduler Service - CRON Job Management
//!
//! This service manages scheduled jobs including:
//! - Job CRUD operations
//! - CRON expression scheduling
//! - Job execution (host or container)
//! - Run history and statistics

use axum::{
    routing::{delete, get, post, put},
    Router,
};
use signapps_common::bootstrap::{env_or, init_tracing, load_env, ServiceConfig};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

mod crawlers;
mod handlers;
mod scheduler;

use scheduler::SchedulerService;
use signapps_common::middleware::AuthState;
use signapps_common::{JwtConfig, Result};
use signapps_db::DatabasePool;

/// Application state.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub scheduler: SchedulerService,
    pub jwt_config: JwtConfig,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize using bootstrap helpers
    init_tracing("signapps_scheduler");
    load_env();

    let config = ServiceConfig::from_env("signapps-scheduler", 3007);
    config.log_startup();

    // Scheduler-specific config
    let job_timeout_seconds: u64 = env_or("JOB_TIMEOUT_SECONDS", "300")
        .parse()
        .unwrap_or(300);

    // Create database pool
    let pool = signapps_db::create_pool(&config.database_url).await?;

    // Create scheduler service
    let scheduler = SchedulerService::new(pool.clone(), job_timeout_seconds);

    // Start background scheduler
    let scheduler_clone = Arc::new(scheduler.clone());
    tokio::spawn(async move {
        scheduler_clone.start_scheduler().await;
    });

    // Start background unified RAG Ingestion loop
    let ingestion_pool = pool.clone();
    tokio::spawn(async move {
        crate::scheduler::ingestion::start_ingestion_loop(ingestion_pool).await;
    });

    // Create JWT config (custom: audience="signapps" for all services)
    let jwt_config = JwtConfig {
        secret: config.jwt_secret.clone(),
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
        access_expiration: 3600,
        refresh_expiration: 86400 * 7,
    };

    // Create application state
    let state = AppState {
        pool,
        scheduler,
        jwt_config,
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
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Job routes
    let job_routes = Router::new()
        .route("/", get(handlers::list_jobs))
        .route("/", post(handlers::create_job))
        .route("/stats", get(handlers::get_stats))
        .route("/running", get(handlers::get_running))
        .route("/cleanup", post(handlers::cleanup_runs))
        .route("/{id}", get(handlers::get_job))
        .route("/{id}", put(handlers::update_job))
        .route("/{id}", delete(handlers::delete_job))
        .route("/{id}/enable", post(handlers::enable_job))
        .route("/{id}/disable", post(handlers::disable_job))
        .route("/{id}/run", post(handlers::run_job))
        .route("/{id}/runs", get(handlers::get_job_runs));

    // Run routes
    let run_routes = Router::new().route("/{id}", get(handlers::get_run));

    // Health check
    let health_routes = Router::new().route("/", get(handlers::health_check));

    // Tenant routes
    let tenant_routes = Router::new()
        .route("/", get(handlers::tenants::list_tenants))
        .route("/{id}", get(handlers::tenants::get_tenant));

    // Workspace routes (require tenant context)
    let workspace_routes = Router::new()
        .route("/", get(handlers::workspaces::list_workspaces))
        .route("/{id}", get(handlers::workspaces::get_workspace))
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // User routes (require tenant context)
    let user_routes = Router::new()
        .route("/", get(handlers::users::list_users))
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Calendar routes (require tenant context)
    let calendar_routes = Router::new()
        .route("/", get(handlers::calendars::list_calendars))
        .route("/{id}", get(handlers::calendars::get_calendar))
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Event routes (require tenant context)
    let event_routes = Router::new()
        .route("/", get(handlers::events::list_events))
        .route("/{id}", get(handlers::events::get_event))
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Resource routes (require tenant context)
    let resource_routes = Router::new()
        .route("/", get(handlers::resources::list_resources))
        .route("/{id}", get(handlers::resources::get_resource))
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Project routes (require tenant context)
    let project_routes = Router::new()
        .route("/", get(handlers::projects::list_projects))
        .route("/{id}", get(handlers::projects::get_project))
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Task routes (require tenant context)
    let task_routes = Router::new()
        .route("/", get(handlers::tasks::list_tasks))
        .route("/{id}", get(handlers::tasks::get_task))
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Combine all routes
    Router::new()
        .nest("/api/v1/jobs", job_routes)
        .nest("/api/v1/runs", run_routes)
        .nest("/api/v1/tenants", tenant_routes)
        .nest("/api/v1/workspaces", workspace_routes)
        .nest("/api/v1/users", user_routes)
        .nest("/api/v1/calendars", calendar_routes)
        .nest("/api/v1/events", event_routes)
        .nest("/api/v1/resources", resource_routes)
        .nest("/api/v1/projects", project_routes)
        .nest("/api/v1/tasks", task_routes)
        .nest("/health", health_routes)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
