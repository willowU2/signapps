//! SignApps Meet Service
//! Video conferencing rooms management with LiveKit integration

use axum::{middleware, Router};
use signapps_common::bootstrap::{env_or, init_tracing, load_env};
use signapps_common::middleware::{auth_middleware, AuthState};
use signapps_common::JwtConfig;
use sqlx::{postgres::PgPoolOptions, Pool, Postgres};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

mod handlers;
mod livekit;
mod models;

#[derive(Clone)]
pub struct AppState {
    pub pool: Pool<Postgres>,
    pub jwt_config: JwtConfig,
    pub livekit_config: LiveKitConfig,
}

#[derive(Clone)]
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
    let jwt_secret = env_or("JWT_SECRET", "dev-secret-change-me");
    let jwt_config = JwtConfig {
        secret: jwt_secret,
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
        access_expiration: 900,
        refresh_expiration: 604800,
    };

    // LiveKit configuration
    let livekit_config = LiveKitConfig {
        api_key: env_or("LIVEKIT_API_KEY", "devkey"),
        api_secret: env_or("LIVEKIT_API_SECRET", "secret"),
        server_url: env_or("LIVEKIT_URL", "ws://localhost:7880"),
    };

    let state = AppState {
        pool,
        jwt_config,
        livekit_config,
    };

    let app = build_router(state);

    // Start server
    let addr: std::net::SocketAddr = format!("0.0.0.0:{}", port).parse().unwrap();
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("✅ signapps-meet ready at http://localhost:{}", port);
    axum::serve(listener, app).await?;
    Ok(())
}

fn build_router(state: AppState) -> Router {
    use axum::routing::{get, post};
    use handlers::{participants, recordings, rooms, tokens};

    // Public routes
    let public_routes = Router::new()
        .route("/health", get(|| async { "OK" }))
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
        // Recordings
        .route("/api/v1/meet/rooms/:id/recordings", get(recordings::list_recordings).post(recordings::start_recording))
        .route("/api/v1/meet/recordings/:recording_id", get(recordings::get_recording).delete(recordings::delete_recording))
        .route("/api/v1/meet/recordings/:recording_id/stop", post(recordings::stop_recording))
        // Meeting history
        .route("/api/v1/meet/history", get(rooms::list_history))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    let cors = CorsLayer::permissive();

    public_routes
        .merge(protected_routes)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
