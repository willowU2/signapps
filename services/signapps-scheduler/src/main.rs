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
use tokio::sync::broadcast;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

mod crawlers;
mod handlers;
mod scheduler;

use scheduler::SchedulerService;
use signapps_common::middleware::AuthState;
use signapps_common::{JwtConfig, Result};
use signapps_db::DatabasePool;

#[derive(Clone, Debug, serde::Serialize)]
pub struct NotificationMessage {
    pub user_id: uuid::Uuid,
    pub title: String,
    pub message: String,
    pub action_url: Option<String>,
}

/// Application state.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub scheduler: SchedulerService,
    pub jwt_config: JwtConfig,
    pub tx_notifications: broadcast::Sender<NotificationMessage>,
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
    let job_timeout_seconds: u64 = env_or("JOB_TIMEOUT_SECONDS", "300").parse().unwrap_or(300);

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
    let (tx_notifications, _) = broadcast::channel(100);
    
    let state = AppState {
        pool,
        scheduler,
        jwt_config,
        tx_notifications,
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
        .route("/", post(handlers::calendars::create_calendar))
        .route("/{id}", get(handlers::calendars::get_calendar))
        .route("/{id}", put(handlers::calendars::update_calendar))
        .route("/{id}", delete(handlers::calendars::delete_calendar))
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Event routes (require tenant context)
    let event_routes = Router::new()
        .route("/{id}", get(handlers::events::get_event))
        .route("/{id}", put(handlers::events::update_event))
        .route("/{id}", delete(handlers::events::delete_event))
        // Attendees nested inside event limits
        .route("/{id}/attendees", get(handlers::events::list_attendees))
        .route("/{id}/attendees", post(handlers::events::add_attendee))
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Calendar nested routes for events
    // Required to match: POST /api/v1/calendars/:calendar_id/events
    let calendar_event_routes = Router::new()
        .route("/", get(handlers::events::list_events))
        .route("/", post(handlers::events::create_event))
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Attendee routes (require tenant context)
    // Matches PUT /api/v1/attendees/:attendee_id/rsvp and DELETE /api/v1/attendees/:attendee_id
    let attendee_routes = Router::new()
        .route("/{id}", delete(handlers::events::remove_attendee))
        .route("/{id}/rsvp", put(handlers::events::update_rsvp))
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
        .route("/", get(handlers::projects::list))
        .route("/", post(handlers::projects::create))
        .route("/{id}", get(handlers::projects::get_by_id))
        .route("/{id}", put(handlers::projects::update))
        .route("/{id}", delete(handlers::projects::delete))
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Task routes (require tenant context)
    let task_routes = Router::new()
        .route("/", get(handlers::tasks::list))
        .route("/", post(handlers::tasks::create))
        .route("/{id}", get(handlers::tasks::get_by_id))
        .route("/{id}", put(handlers::tasks::update))
        .route("/{id}", delete(handlers::tasks::delete))
        // Task attachments
        .route("/{id}/attachments", get(handlers::tasks::list_attachments))
        .route("/{id}/attachments", post(handlers::tasks::add_attachment))
        .route(
            "/{id}/attachments/{attachment_id}",
            delete(handlers::tasks::delete_attachment),
        )
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // TimeItem routes (Unified Scheduling API - require tenant context)
    let time_item_routes = Router::new()
        .route("/", get(handlers::time_items::list_time_items))
        .route("/", post(handlers::time_items::create_time_item))
        .route("/availability", post(handlers::time_items::query_users_events))
        .route("/{id}", get(handlers::time_items::get_time_item))
        .route("/{id}", put(handlers::time_items::update_time_item))
        .route("/{id}", delete(handlers::time_items::delete_time_item))
        .route("/{id}/move", post(handlers::time_items::move_time_item))
        .route("/{id}/status", put(handlers::time_items::update_time_item_status))
        .route("/{id}/children", get(handlers::time_items::list_children))
        .route("/{id}/share", post(handlers::time_items::share_time_item))
        // Users/Participants
        .route("/{id}/users", get(handlers::time_items::list_time_item_users))
        .route("/{id}/users", post(handlers::time_items::add_time_item_user))
        .route("/{id}/users/{user_id}", delete(handlers::time_items::remove_time_item_user))
        .route("/{id}/rsvp", put(handlers::time_items::update_rsvp))
        // Groups
        .route("/{id}/groups", get(handlers::time_items::list_time_item_groups))
        .route("/{id}/groups", post(handlers::time_items::add_time_item_group))
        .route("/{id}/groups/{group_id}", delete(handlers::time_items::remove_time_item_group))
        // Dependencies
        .route("/{id}/dependencies", get(handlers::time_items::list_dependencies))
        .route("/{id}/dependencies", post(handlers::time_items::add_dependency))
        .route("/{id}/dependencies/{depends_on_id}", delete(handlers::time_items::remove_dependency))
        // Recurrence
        .route("/{id}/recurrence", get(handlers::time_items::get_recurrence))
        .route("/{id}/recurrence", delete(handlers::time_items::delete_recurrence))
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Scheduling Resources routes
    let scheduling_resource_routes = Router::new()
        .route("/", get(handlers::time_items::list_scheduling_resources))
        .route("/", post(handlers::time_items::create_scheduling_resource))
        .route("/{id}", get(handlers::time_items::get_scheduling_resource))
        .route(
            "/{id}",
            delete(handlers::time_items::delete_scheduling_resource),
        )
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Scheduling Templates routes
    let template_routes = Router::new()
        .route("/", get(handlers::time_items::list_templates))
        .route("/", post(handlers::time_items::create_template))
        .route("/{id}", get(handlers::time_items::get_template))
        .route("/{id}", delete(handlers::time_items::delete_template))
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Scheduling Preferences routes
    let preferences_routes = Router::new()
        .route("/", get(handlers::time_items::get_preferences))
        .route("/", put(handlers::time_items::update_preferences))
        .layer(axum::middleware::from_fn(
            signapps_common::middleware::tenant_context_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            signapps_common::middleware::auth_middleware::<AppState>,
        ));

    // Notifications routes
    let notifications_routes = Router::new()
        .route("/stream", get(handlers::notifications::sse_handler))
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
        .nest("/api/v1/calendars/{calendar_id}/events", calendar_event_routes)
        .nest("/api/v1/events", event_routes)
        .nest("/api/v1/attendees", attendee_routes)
        .nest("/api/v1/resources", resource_routes)
        .nest("/api/v1/projects", project_routes)
        .nest("/api/v1/tasks", task_routes)
        // Unified Scheduling API
        .nest("/api/v1/time-items", time_item_routes)
        .nest("/api/v1/scheduling/resources", scheduling_resource_routes)
        .nest("/api/v1/scheduling/templates", template_routes)
        .nest("/api/v1/scheduling/preferences", preferences_routes)
        .nest("/api/v1/notifications", notifications_routes)
        .nest("/health", health_routes)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
