//! SignApps Calendar Service
//! Manages shared calendars, events, recurring meetings, and tasks with hierarchical support

use axum::{extract::DefaultBodyLimit, middleware, Router};
use dashmap::DashMap;
use handlers::openapi::CalendarApiDoc;
use signapps_cache::CacheService;
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::{auth_middleware, tenant_context_middleware, AuthState};
use signapps_common::pg_events::{PgEventBus, PlatformEvent};
use signapps_common::JwtConfig;
use signapps_db::DatabasePool;
use signapps_sharing::routes::sharing_routes;
use signapps_sharing::{ResourceType, SharingEngine};
use std::sync::Arc;
use tokio::sync::broadcast;
use tower_http::trace::TraceLayer;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;
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
    /// PostgreSQL-backed event bus for cross-service events
    pub event_bus: PgEventBus,
    /// Unified sharing / permission engine
    pub sharing: SharingEngine,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

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

    // JWT config — auto-detects RS256 or HS256 from environment
    let jwt_config = JwtConfig::from_env();

    let event_bus = PgEventBus::new(pool.inner().clone(), "signapps-calendar".to_string());

    // Initialize sharing engine — drives all calendar sharing/permission operations
    let sharing_engine = SharingEngine::new(pool.inner().clone(), CacheService::default_config());

    let state = AppState {
        pool: pool.clone(),
        jwt_config,
        calendar_docs: Arc::new(DashMap::new()),
        calendar_broadcasts: Arc::new(DashMap::new()),
        presence_manager: Arc::new(PresenceManager::new()),
        ai_client: Arc::new(crate::services::ai_service::AiServiceClient::new()),
        event_bus,
        sharing: sharing_engine.clone(),
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

    // Spawn cross-service event listener (mail.received → auto ICS import)
    let cal_listener_pool = pool.inner().clone();
    let cal_bus = PgEventBus::new(cal_listener_pool.clone(), "signapps-calendar".to_string());
    tokio::spawn(async move {
        if let Err(e) = cal_bus
            .listen("calendar-consumer", move |event| {
                let p = cal_listener_pool.clone();
                Box::pin(async move { handle_cross_event(&p, event).await })
            })
            .await
        {
            tracing::error!("Calendar event listener crashed: {}", e);
        }
    });

    // Build router
    let app = build_router(state, sharing_engine);

    // Start server using bootstrap helper
    signapps_common::bootstrap::run_server(app, &config).await
}

fn build_router(state: AppState, sharing_engine: SharingEngine) -> Router {
    use axum::routing::{any, delete, get, post, put};
    use handlers::{
        approval, caldav, calendars, categories, cron_jobs, events, external_sync, floor_plans,
        icalendar, layers, leave, meeting_suggestions, notifications, ooo, polls, presence, push,
        recurrence, resources, shares, tasks, timesheets, timezones, websocket,
    };

    // OpenAPI docs routes
    let openapi_routes =
        SwaggerUi::new("/swagger-ui").url("/api/v1/openapi.json", CalendarApiDoc::openapi());

    // Public routes (no auth required)
    let public_routes = Router::new()
        .merge(openapi_routes)
        .route("/health", get(health_check))
        .route(
            "/api/v1/notifications/push/vapid-key",
            get(push::get_vapid_key),
        )
        .route("/api/v1/timezones", get(timezones::list_timezones))
        // AQ-CALSYNC: CalDAV well-known discovery (public — client redirects to auth)
        .route(
            "/.well-known/caldav",
            any(caldav::options_handler),
        );

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
        // SYNC-CALENDAR-TZ: user preferred timezone
        .route(
            "/api/v1/timezones/me",
            get(timezones::get_user_timezone).put(timezones::set_user_timezone),
        )
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
        // FloorPlan routes
        .route("/api/v1/floorplans", post(floor_plans::create_floor_plan))
        .route("/api/v1/floorplans", get(floor_plans::list_floor_plans))
        .route("/api/v1/floorplans/:id", get(floor_plans::get_floor_plan))
        .route("/api/v1/floorplans/:id", put(floor_plans::update_floor_plan))
        .route("/api/v1/floorplans/:id", delete(floor_plans::delete_floor_plan))
        .route("/api/v1/resources/type/:resource_type", get(resources::list_resources_by_type))
        .route("/api/v1/resources/availability", post(resources::check_availability))
        .route("/api/v1/resources/:resource_id/book", post(resources::book_resources))
        // Meeting time suggestions (IDEA-105)
        .route(
            "/api/v1/calendar/meeting-suggestions",
            post(meeting_suggestions::suggest_meeting_times),
        )
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
        // AQ-CALSYNC: CalDAV RFC 4791 endpoints
        .route("/caldav/principals/:user_id", any(caldav::propfind_principal))
        .route("/caldav/calendars/:calendar_id", any(caldav::propfind_calendar))
        .route("/caldav/calendars/:calendar_id/report", post(caldav::report_calendar))
        .route("/caldav/calendars/:calendar_id/events/:event_id.ics", get(caldav::get_event_ics)
            .put(caldav::put_event_ics)
            .delete(caldav::delete_event_ics))
        // Out-of-office settings
        .route("/api/v1/ooo", get(ooo::get_ooo))
        .route("/api/v1/ooo", put(ooo::set_ooo))
        .route("/api/v1/ooo", delete(ooo::delete_ooo))
        // Scheduling polls
        .route("/api/v1/polls", get(polls::list_polls))
        .route("/api/v1/polls", post(polls::create_poll))
        .route("/api/v1/polls/:id", get(polls::get_poll))
        .route("/api/v1/polls/:id/vote", post(polls::vote_poll))
        .route("/api/v1/polls/:id/confirm", post(polls::confirm_poll))
        // Category routes
        .route("/api/v1/categories", get(categories::list_categories).post(categories::create_category))
        .route("/api/v1/categories/:id", put(categories::update_category).delete(categories::delete_category))
        // Leave management routes
        .route("/api/v1/events/:id/approve", put(leave::approve_leave))
        .route("/api/v1/events/:id/reject", put(leave::reject_leave))
        .route("/api/v1/leave/balances", get(leave::get_balances))
        .route("/api/v1/leave/balances/predict", get(leave::predict_balance))
        .route("/api/v1/leave/team-conflicts", get(leave::team_conflicts))
        .route("/api/v1/leave/delegate", post(leave::delegate_tasks))
        // Presence management routes
        .route("/api/v1/presence/rules", get(presence::list_rules).post(presence::create_rule))
        .route(
            "/api/v1/presence/rules/:id",
            put(presence::update_rule).delete(presence::delete_rule),
        )
        .route("/api/v1/presence/validate", post(presence::validate_action))
        .route("/api/v1/presence/team-status", get(presence::team_status))
        .route("/api/v1/presence/headcount", get(presence::headcount))
        // Timesheet routes
        .route("/api/v1/timesheets", get(timesheets::list_timesheets))
        .route("/api/v1/timesheets/:id", put(timesheets::update_timesheet))
        .route("/api/v1/timesheets/validate", post(timesheets::validate_week))
        .route("/api/v1/timesheets/export", post(timesheets::export_timesheets))
        .route("/api/v1/timesheets/generate", post(timesheets::generate_timesheets))
        // Approval workflow routes
        .route(
            "/api/v1/approval-workflows",
            get(approval::list_workflows).post(approval::create_workflow),
        )
        .route(
            "/api/v1/approval-workflows/:id",
            put(approval::update_workflow).delete(approval::delete_workflow),
        )
        // Layer config routes
        .route(
            "/api/v1/layers/config",
            get(layers::get_layer_config).put(layers::save_layer_config),
        )
        // CRON job routes (scheduler absorbed into calendar)
        .route("/api/v1/cron-jobs", get(cron_jobs::list_cron_jobs))
        .route("/api/v1/cron-jobs", post(cron_jobs::create_cron_job))
        .route("/api/v1/cron-jobs/:id", put(cron_jobs::update_cron_job))
        .route("/api/v1/cron-jobs/:id", delete(cron_jobs::delete_cron_job))
        .route("/api/v1/cron-jobs/:id/run", post(cron_jobs::run_cron_job))
        .route_layer(middleware::from_fn(tenant_context_middleware))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    use tower_http::cors::{AllowOrigin, CorsLayer};
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            "http://localhost:3000"
                .parse()
                .expect("valid localhost origin"),
            "http://127.0.0.1:3000"
                .parse()
                .expect("valid localhost origin"),
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

    // Sharing sub-routers: State<SharingEngine> — additive, isolated from AppState.
    // The existing calendar.members / shares system is NOT touched.
    let sharing_sub = sharing_routes("calendars", ResourceType::Calendar)
        .with_state(sharing_engine.clone());
    let events_sharing_sub = sharing_routes("events", ResourceType::Event)
        .with_state(sharing_engine);

    public_routes
        .merge(protected_routes)
        .merge(sharing_sub)
        .merge(events_sharing_sub)
        .layer(DefaultBodyLimit::max(100 * 1024 * 1024))  // 100MB
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}

async fn health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "ok",
        "service": "signapps-calendar",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": signapps_common::healthz::uptime_seconds(),
        "app": {
            "id": "calendar",
            "label": "Calendrier",
            "description": "Agenda, événements et gestion du temps",
            "icon": "Calendar",
            "category": "Organisation",
            "color": "text-blue-500",
            "href": "/cal",
            "port": 3011
        }
    }))
}

/// Handle cross-service events received by the calendar service.
async fn handle_cross_event(_pool: &sqlx::PgPool, event: PlatformEvent) -> Result<(), sqlx::Error> {
    if event.event_type.as_str() == "mail.received" {
        // Log for now — full ICS parsing is a future enhancement
        if event.payload.get("has_ics").and_then(|v| v.as_bool()) == Some(true) {
            tracing::info!(
                email_id = %event.aggregate_id.map(|id| id.to_string()).unwrap_or_default(),
                "ICS attachment detected — auto-import pending"
            );
        }
    }
    Ok(())
}
