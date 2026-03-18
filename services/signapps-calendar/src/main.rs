//! SignApps Calendar Service
//! Manages shared calendars, events, recurring meetings, and tasks with hierarchical support

use axum::{extract::DefaultBodyLimit, http::StatusCode, middleware, routing::get, Router};
use dashmap::DashMap;
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::{auth_middleware, AuthState};
use signapps_common::JwtConfig;
use signapps_db::DatabasePool;
use std::sync::Arc;
use tokio::sync::broadcast;
use tower_http::trace::TraceLayer;
use yrs::Doc;

use crate::services::presence::PresenceManager;
use crate::services::{NotificationScheduler, SchedulerConfig};

mod error;
pub use error::CalendarError;

mod handlers;
mod services;

/// Application state shared across all handlers.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub jwt_config: JwtConfig,
    /// In-memory Yrs documents for real-time collaboration
    pub calendar_docs: Arc<DashMap<String, Arc<Doc>>>,
    /// Broadcast channels for calendar updates
    pub calendar_broadcasts: Arc<DashMap<String, broadcast::Sender<Vec<u8>>>>,
    /// Presence tracking for active users
    pub presence_manager: Arc<PresenceManager>,
    /// Client for pushing indexing requests to signapps-ai
    pub ai_client: Arc<crate::services::ai_service::AiServiceClient>,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize using bootstrap helpers
    init_tracing("signapps_calendar");
    load_env();

    let config = ServiceConfig::from_env("signapps-calendar", 3011);
    config.log_startup();

    // Initialize database
    let pool = signapps_db::create_pool(&config.database_url).await?;
    tracing::info!("Database initialized successfully");

    // Create JWT config (custom: audience="signapps" for all services)
    let jwt_config = JwtConfig {
        secret: config.jwt_secret.clone(),
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
        access_expiration: 900,
        refresh_expiration: 604800,
    };

    let state = AppState {
        pool: pool.clone(),
        jwt_config,
        calendar_docs: Arc::new(DashMap::new()),
        calendar_broadcasts: Arc::new(DashMap::new()),
        presence_manager: Arc::new(PresenceManager::new()),
        ai_client: Arc::new(crate::services::ai_service::AiServiceClient::new()),
    };

    tracing::info!("Real-time collaboration system initialized");
    tracing::info!("Presence tracking system initialized");

    // Initialize and spawn notification scheduler
    let scheduler_config = SchedulerConfig::new();
    let scheduler = NotificationScheduler::new(state.pool.inner().clone(), scheduler_config);

    // Spawn scheduler in background
    tokio::spawn(async move {
        tracing::info!("Notification scheduler started");
        scheduler.run().await;
    });

    // Build router
    let app = build_router(state);

    // Start server using bootstrap helper
    signapps_common::bootstrap::run_server(app, &config).await
}

fn build_router(state: AppState) -> Router {
    use axum::routing::{delete, post, put};
    use handlers::{
        calendars, events, external_sync, icalendar, notifications, push, recurrence, resources,
        shares, tasks, timezones, websocket,
    };

    // Public routes (no auth required)
    let public_routes = Router::new()
        .route("/health", get(health_check))
        .route(
            "/api/v1/notifications/push/vapid-key",
            get(push::get_vapid_key),
        )
        .route("/api/v1/timezones", get(timezones::list_timezones));

    // Protected routes (auth required)
    let protected_routes = Router::new()
        // Calendar CRUD routes
        .route("/api/v1/calendars", post(calendars::create_calendar))
        .route("/api/v1/calendars", get(calendars::list_calendars))
        .route("/api/v1/calendars/:id", get(calendars::get_calendar))
        .route("/api/v1/calendars/:id", put(calendars::update_calendar))
        .route("/api/v1/calendars/:id", delete(calendars::delete_calendar))
        // Calendar members (sharing) routes
        .route("/api/v1/calendars/:id/members", get(calendars::list_members))
        .route("/api/v1/calendars/:id/members", post(calendars::add_member))
        .route("/api/v1/calendars/:id/members/:user_id", delete(calendars::remove_member))
        .route("/api/v1/calendars/:id/members/:user_id", put(calendars::update_member_role))
        // Share endpoints (alternative routes)
        .route("/api/v1/calendars/:calendar_id/shares", post(shares::share_calendar))
        .route("/api/v1/calendars/:calendar_id/shares/:user_id", delete(shares::unshare_calendar))
        .route("/api/v1/calendars/:calendar_id/shares/:user_id", put(shares::update_permission))
        .route("/api/v1/calendars/:calendar_id/shares", get(shares::get_members))
        .route("/api/v1/calendars/:calendar_id/shares/:user_id/check", get(shares::check_permission))
        // Event CRUD routes
        .route("/api/v1/calendars/:calendar_id/events", post(events::create_event))
        .route("/api/v1/calendars/:calendar_id/events", get(events::list_events))
        .route("/api/v1/events/:id", get(events::get_event))
        .route("/api/v1/events/:id", put(events::update_event))
        .route("/api/v1/events/:id", delete(events::delete_event))
        // Event attendees routes
        .route("/api/v1/events/:event_id/attendees", post(events::add_attendee))
        .route("/api/v1/events/:event_id/attendees", get(events::list_attendees))
        .route("/api/v1/attendees/:attendee_id/rsvp", put(events::update_rsvp))
        .route("/api/v1/attendees/:attendee_id", delete(events::remove_attendee))
        // Recurrence routes
        .route("/api/v1/events/:event_id/instances", get(recurrence::get_event_instances))
        .route("/api/v1/events/:event_id/exceptions", post(recurrence::create_exception))
        .route("/api/v1/rrule/validate", post(recurrence::validate_rrule))
        // Timezone routes
        .route("/api/v1/timezones/validate", post(timezones::validate_timezone))
        .route("/api/v1/timezones/convert", post(timezones::convert_timezone))
        // Task routes
        .route("/api/v1/calendars/:calendar_id/tasks", post(tasks::create_task))
        .route("/api/v1/calendars/:calendar_id/tasks", get(tasks::list_root_tasks))
        .route("/api/v1/tasks/:id", get(tasks::get_task))
        .route("/api/v1/tasks/:id", put(tasks::update_task))
        .route("/api/v1/tasks/:id/move", put(tasks::move_task))
        .route("/api/v1/tasks/:id/complete", post(tasks::complete_task))
        .route("/api/v1/tasks/:id", delete(tasks::delete_task))
        .route("/api/v1/tasks/:task_id/children", get(tasks::list_children))
        .route("/api/v1/calendars/:calendar_id/tasks/tree", get(tasks::get_task_tree))
        .route("/api/v1/calendars/:calendar_id/tasks/info", get(tasks::get_task_tree_info))
        // Resource routes
        .route("/api/v1/resources", post(resources::create_resource))
        .route("/api/v1/resources", get(resources::list_resources))
        .route("/api/v1/resources/:id", get(resources::get_resource))
        .route("/api/v1/resources/:id", put(resources::update_resource))
        .route("/api/v1/resources/:id", delete(resources::delete_resource))
        .route("/api/v1/resources/type/:resource_type", get(resources::list_resources_by_type))
        .route("/api/v1/resources/availability", post(resources::check_availability))
        .route("/api/v1/resources/:resource_id/book", post(resources::book_resources))
        // iCalendar import/export routes
        .route("/api/v1/calendars/:calendar_id/export", get(icalendar::export_calendar))
        .route("/api/v1/calendars/:calendar_id/feed.ics", get(icalendar::get_calendar_feed))
        .route("/api/v1/calendars/:calendar_id/import", post(icalendar::import_calendar))
        .route("/api/v1/icalendar/validate", post(icalendar::validate_icalendar))
        // Real-time collaboration WebSocket routes
        .route("/api/v1/calendars/:calendar_id/ws", get(websocket::websocket_handler))
        // Notification preferences routes
        .route("/api/v1/notifications/preferences", get(notifications::get_preferences))
        .route("/api/v1/notifications/preferences", put(notifications::update_preferences))
        // Push subscription routes
        .route("/api/v1/notifications/subscriptions/push", post(notifications::subscribe_push))
        .route("/api/v1/notifications/subscriptions/push", get(notifications::list_push_subscriptions))
        .route("/api/v1/notifications/subscriptions/push/:subscription_id", delete(notifications::unsubscribe_push))
        // Notification history and management routes
        .route("/api/v1/notifications/history", get(notifications::get_notification_history))
        .route("/api/v1/notifications/:notification_id/resend", post(notifications::resend_notification))
        .route("/api/v1/notifications/unread-count", get(notifications::get_unread_count))
        // Web Push send (admin)
        .route("/api/v1/notifications/push/send", post(push::send_push))
        // External Calendar Sync - Provider Connections
        .route("/api/v1/external-sync/connections", get(external_sync::list_connections))
        .route("/api/v1/external-sync/connections/:id", get(external_sync::get_connection))
        .route("/api/v1/external-sync/oauth/init", post(external_sync::init_oauth))
        .route("/api/v1/external-sync/oauth/callback", post(external_sync::handle_oauth_callback))
        .route("/api/v1/external-sync/connections/:id/refresh", post(external_sync::refresh_connection))
        .route("/api/v1/external-sync/connections/:id", delete(external_sync::disconnect_provider))
        // External Calendar Sync - External Calendars
        .route("/api/v1/external-sync/connections/:connection_id/calendars", get(external_sync::list_external_calendars))
        .route("/api/v1/external-sync/connections/:connection_id/discover", post(external_sync::discover_calendars))
        // External Calendar Sync - Sync Configs
        .route("/api/v1/external-sync/configs", get(external_sync::list_sync_configs))
        .route("/api/v1/external-sync/configs", post(external_sync::create_sync_config))
        .route("/api/v1/external-sync/configs/:id", put(external_sync::update_sync_config))
        .route("/api/v1/external-sync/configs/:id", delete(external_sync::delete_sync_config))
        .route("/api/v1/external-sync/configs/:id/sync", post(external_sync::trigger_sync))
        // External Calendar Sync - Logs & Conflicts
        .route("/api/v1/external-sync/configs/:config_id/logs", get(external_sync::list_sync_logs))
        .route("/api/v1/external-sync/configs/:config_id/conflicts", get(external_sync::list_conflicts))
        .route("/api/v1/external-sync/configs/:config_id/conflicts/:conflict_id", put(external_sync::resolve_conflict))
        .route("/api/v1/external-sync/configs/:config_id/conflicts/resolve-all", post(external_sync::resolve_all_conflicts))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    use tower_http::cors::{Any, CorsLayer};
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any)
        .expose_headers(Any);

    public_routes
        .merge(protected_routes)
        .layer(DefaultBodyLimit::max(100 * 1024 * 1024))  // 100MB
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}

async fn health_check() -> StatusCode {
    StatusCode::OK
}
