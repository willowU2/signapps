//! SignApps Meet Service
//! Video conferencing rooms management with LiveKit integration

use axum::{middleware, Router};
use signapps_common::bootstrap::{env_or, env_required, init_tracing, load_env};
use signapps_common::middleware::{auth_middleware, AuthState};
use signapps_common::JwtConfig;
use sqlx::{postgres::PgPoolOptions, Pool, Postgres};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

mod handlers;
mod livekit;
mod models;

#[derive(Clone)]
/// Application state for  service.
pub struct AppState {
    pub pool: Pool<Postgres>,
    pub jwt_config: JwtConfig,
    pub livekit_config: LiveKitConfig,
}

#[derive(Clone)]
/// Configuration for LiveKit.
pub struct LiveKitConfig {
    pub api_key: String,
    pub api_secret: String,
    pub server_url: String,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize using bootstrap helpers
    init_tracing("signapps_meet");
    load_env();

    let port: u16 = env_or("SERVER_PORT", "3014").parse().unwrap_or(3014);
    tracing::info!("🚀 Starting signapps-meet on port {}", port);

    // Database
    let database_url = env_or(
        "DATABASE_URL",
        "postgres://signapps:password@localhost:5432/signapps",
    );
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;
    tracing::info!("Database connected");

    // JWT configuration (custom: audience="signapps" for all services)
    let jwt_secret = env_required("JWT_SECRET");
    let jwt_config = JwtConfig {
        secret: jwt_secret,
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
        access_expiration: 900,
        refresh_expiration: 604800,
    };

    // LiveKit configuration
    let livekit_config = LiveKitConfig {
        api_key: std::env::var("LIVEKIT_API_KEY").unwrap_or_else(|_| {
            if cfg!(debug_assertions) {
                "devkey".to_string()
            } else {
                panic!("LIVEKIT_API_KEY must be set in production")
            }
        }),
        api_secret: std::env::var("LIVEKIT_API_SECRET").unwrap_or_else(|_| {
            if cfg!(debug_assertions) {
                "secret".to_string()
            } else {
                panic!("LIVEKIT_API_SECRET must be set in production")
            }
        }),
        server_url: env_or("LIVEKIT_URL", "ws://localhost:7880"),
    };

    let state = AppState {
        pool,
        jwt_config,
        livekit_config,
    };

    let app = build_router(state);

    // Start server
    let addr: std::net::SocketAddr = format!("0.0.0.0:{}", port)
        .parse()
        .expect("server address is valid");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("✅ signapps-meet ready at http://localhost:{}", port);
    axum::serve(listener, app)
        .with_graceful_shutdown(signapps_common::graceful_shutdown())
        .await?;
    Ok(())
}

async fn meet_health() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "ok",
        "service": "signapps-meet",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": signapps_common::healthz::uptime_seconds()
    }))
}

fn build_router(state: AppState) -> Router {
    use axum::routing::{delete, get, patch, post};
    use handlers::{
        participants, recordings, rooms, tokens, transcription, video_messages, voicemails,
        waiting_room,
    };

    // Public routes
    let public_routes = Router::new()
        .route("/health", get(meet_health))
        .route("/api/v1/meet/config", get(handlers::get_config));

    // Protected routes
    let protected_routes = Router::new()
        // Room management
        .route("/api/v1/meet/rooms", get(rooms::list_rooms).post(rooms::create_room))
        .route("/api/v1/meet/rooms/:id", get(rooms::get_room).put(rooms::update_room).delete(rooms::delete_room))
        .route("/api/v1/meet/rooms/:id/end", post(rooms::end_room))
        // Token generation
        .route("/api/v1/meet/token", get(tokens::get_token))
        .route("/api/v1/meet/rooms/:id/token", get(tokens::get_room_token))
        // Participants
        .route("/api/v1/meet/rooms/:id/participants", get(participants::list_participants))
        .route("/api/v1/meet/rooms/:id/participants/:user_id/kick", post(participants::kick_participant))
        .route("/api/v1/meet/rooms/:id/participants/:user_id/mute", post(participants::mute_participant))
        // Recordings (list/start via rooms)
        .route("/api/v1/meet/rooms/:id/recordings", get(recordings::list_recordings).post(recordings::start_recording))
        .route("/api/v1/meet/recordings/:recording_id", get(recordings::get_recording).delete(recordings::delete_recording))
        .route("/api/v1/meet/recordings/:recording_id/stop", post(recordings::stop_recording))
        // Room-scoped recording convenience endpoints
        .route("/api/v1/meet/rooms/:id/recording", get(recordings::get_active_recording))
        .route("/api/v1/meet/rooms/:id/recording/start", post(recordings::start_recording))
        .route("/api/v1/meet/rooms/:id/recording/stop", post(recordings::stop_room_recording))
        // Waiting room
        .route("/api/v1/meet/rooms/:id/waiting-room", get(waiting_room::list_waiting).post(waiting_room::join_waiting_room))
        .route("/api/v1/meet/rooms/:id/waiting-room/admit/:user_id", post(waiting_room::admit_user))
        .route("/api/v1/meet/rooms/:id/waiting-room/deny/:user_id", post(waiting_room::deny_user))
        // Meeting history
        .route("/api/v1/meet/history", get(rooms::list_history))
        // Voicemails
        .route("/api/v1/meet/voicemails", get(voicemails::list_voicemails))
        .route("/api/v1/meet/voicemails/:id", delete(voicemails::delete_voicemail))
        .route("/api/v1/meet/voicemails/:id/read", patch(voicemails::mark_voicemail_read))
        // Transcription — event-driven auto-transcription of recordings
        .route(
            "/api/v1/meet/events/session-ended",
            post(transcription::handle_session_ended),
        )
        // Video messages
        .route(
            "/api/v1/meet/video-messages",
            get(video_messages::list_video_messages).post(video_messages::create_video_message),
        )
        .route("/api/v1/meet/video-messages/:id", delete(video_messages::delete_video_message))
        .route(
            "/api/v1/meet/video-messages/:id/read",
            patch(video_messages::mark_video_message_read),
        )
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    let cors = CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::PATCH,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::HeaderName::from_static("x-request-id"),
            axum::http::HeaderName::from_static("x-workspace-id"),
        ]);

    public_routes
        .merge(protected_routes)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
