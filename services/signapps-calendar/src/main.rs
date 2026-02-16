//! SignApps Calendar Service
//! Manages shared calendars, events, recurring meetings, and tasks with hierarchical support

use axum::{
    extract::DefaultBodyLimit,
    http::StatusCode,
    routing::get,
    Router,
};
use dashmap::DashMap;
use signapps_common::middleware::AuthState;
use signapps_common::JwtConfig;
use signapps_db::{create_pool, run_migrations, DatabasePool};
use std::sync::Arc;
use tokio::sync::broadcast;
use tower_http::trace::TraceLayer;
use tracing::info;
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
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    info!("Starting signapps-calendar service");

    // Get configuration
    dotenvy::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:password@localhost:5432/signapps".to_string());
    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "dev_secret_change_in_production_32chars".to_string());
    let server_port = std::env::var("SERVER_PORT")
        .unwrap_or_else(|_| "3011".to_string())
        .parse::<u16>()?;

    // Initialize database
    let pool = create_pool(&database_url).await?;
    run_migrations(&pool).await?;

    info!("Database initialized successfully");

    // Create JWT config
    let jwt_config = JwtConfig {
        secret: jwt_secret,
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
        access_expiration: 900,
        refresh_expiration: 604800,
    };

    // Create application state
    let state = AppState {
        pool,
        jwt_config,
        calendar_docs: Arc::new(DashMap::new()),
        calendar_broadcasts: Arc::new(DashMap::new()),
        presence_manager: Arc::new(PresenceManager::new()),
    };

    info!("Real-time collaboration system initialized");
    info!("Presence tracking system initialized");

    // Initialize and spawn notification scheduler
    let scheduler_config = SchedulerConfig::new();
    let scheduler = NotificationScheduler::new(state.pool.inner().clone(), scheduler_config);

    // Spawn scheduler in background
    tokio::spawn(async move {
        info!("Notification scheduler started");
        scheduler.run().await;
    });

    // Build router
    let app = build_router(state);

    // Start server
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", server_port)).await?;
    info!("Calendar service listening on port {}", server_port);

    axum::serve(listener, app).await?;
    Ok(())
}

fn build_router(state: AppState) -> Router {
    use handlers::{calendars, events, recurrence, timezones, tasks, resources, shares, icalendar, websocket, notifications, push};
    use axum::routing::{delete, post, put};

    Router::new()
        .route("/health", get(health_check))
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
        .route("/api/v1/timezones", get(timezones::list_timezones))
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
        // Web Push notification routes
        .route("/api/v1/notifications/push/vapid-key", get(push::get_vapid_key))
        .route("/api/v1/notifications/push/send", post(push::send_push))
        .layer(DefaultBodyLimit::max(100 * 1024 * 1024))  // 100MB
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

async fn health_check() -> StatusCode {
    StatusCode::OK
}
