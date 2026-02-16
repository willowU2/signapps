//! SignApps Calendar Service
//! Manages shared calendars, events, recurring meetings, and tasks with hierarchical support

use axum::{
    extract::DefaultBodyLimit,
    http::StatusCode,
    routing::get,
    Router,
};
use signapps_common::middleware::AuthState;
use signapps_common::JwtConfig;
use signapps_db::{create_pool, run_migrations, DatabasePool};
use tower_http::trace::TraceLayer;
use tracing::info;

mod error;
pub use error::CalendarError;

mod handlers;
mod services;

/// Application state shared across all handlers.
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
    let state = AppState { pool, jwt_config };

    // Build router
    let app = build_router(state);

    // Start server
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", server_port)).await?;
    info!("Calendar service listening on port {}", server_port);

    axum::serve(listener, app).await?;
    Ok(())
}

fn build_router(state: AppState) -> Router {
    use handlers::{calendars, events, recurrence, timezones};
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
        .layer(DefaultBodyLimit::max(100 * 1024 * 1024))  // 100MB
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

async fn health_check() -> StatusCode {
    StatusCode::OK
}
