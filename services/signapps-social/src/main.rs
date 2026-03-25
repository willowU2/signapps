pub mod handlers;
pub mod models;
pub mod platforms;
pub mod publisher;

use axum::{
    middleware,
    routing::{delete, get, patch, post},
    Router,
};
use signapps_common::bootstrap::{env_or, env_required, init_tracing, load_env};
use signapps_common::middleware::{auth_middleware, AuthState};
use signapps_common::JwtConfig;
use sqlx::{postgres::PgPoolOptions, Pool, Postgres};
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};

use handlers::{accounts, analytics, automation, inbox, posts};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

#[derive(Clone)]
pub struct AppState {
    pub pool: Pool<Postgres>,
    pub jwt_config: JwtConfig,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            "http://localhost:3000".parse().unwrap(),
            "http://127.0.0.1:3000".parse().unwrap(),
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

    let public_routes =
        Router::new().route("/health", get(|| async { axum::http::StatusCode::OK }));

    let protected_routes = Router::new()
        // Accounts
        .route(
            "/api/v1/social/accounts",
            get(accounts::list_accounts).post(accounts::create_account),
        )
        .route(
            "/api/v1/social/accounts/:id",
            get(accounts::get_account)
                .patch(accounts::update_account)
                .delete(accounts::delete_account),
        )
        .route(
            "/api/v1/social/accounts/:id/refresh-token",
            post(accounts::refresh_token),
        )
        // Posts
        .route(
            "/api/v1/social/posts",
            get(posts::list_posts).post(posts::create_post),
        )
        .route(
            "/api/v1/social/posts/:id",
            get(posts::get_post)
                .patch(posts::update_post)
                .delete(posts::delete_post),
        )
        .route("/api/v1/social/posts/:id/publish", post(posts::publish_post))
        .route(
            "/api/v1/social/posts/:id/schedule",
            post(posts::schedule_post),
        )
        // Inbox
        .route("/api/v1/social/inbox", get(inbox::list_inbox))
        .route("/api/v1/social/inbox/:id/read", patch(inbox::mark_read))
        .route("/api/v1/social/inbox/:id/reply", post(inbox::reply_inbox))
        // Analytics
        .route(
            "/api/v1/social/analytics/overview",
            get(analytics::overview),
        )
        .route(
            "/api/v1/social/analytics/posts/:id",
            get(analytics::post_analytics),
        )
        // RSS Feeds
        .route(
            "/api/v1/social/rss-feeds",
            get(automation::list_rss_feeds).post(automation::create_rss_feed),
        )
        .route(
            "/api/v1/social/rss-feeds/:id",
            delete(automation::delete_rss_feed),
        )
        // Templates
        .route(
            "/api/v1/social/templates",
            get(automation::list_templates).post(automation::create_template),
        )
        .route(
            "/api/v1/social/templates/:id",
            delete(automation::delete_template),
        )
        // AI
        .route("/api/v1/social/ai/generate", post(automation::ai_generate))
        .route("/api/v1/social/ai/hashtags", post(automation::ai_hashtags))
        .route(
            "/api/v1/social/ai/best-time",
            post(automation::ai_best_time),
        )
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    public_routes
        .merge(protected_routes)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() {
    init_tracing("signapps_social");
    load_env();

    let port: u16 = env_or("SERVER_PORT", "3019").parse().unwrap_or(3019);
    tracing::info!("Starting signapps-social on port {}", port);

    let database_url = env_or(
        "DATABASE_URL",
        "postgres://signapps:password@localhost:5432/signapps",
    );
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await
        .expect("Failed to connect to Postgres");

    let jwt_secret = env_required("JWT_SECRET");
    let jwt_config = JwtConfig {
        secret: jwt_secret,
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
        access_expiration: 3600,
        refresh_expiration: 86400 * 7,
    };

    let state = AppState {
        pool: pool.clone(),
        jwt_config,
    };

    // Start background publisher
    tokio::spawn(publisher::start_publisher(pool.clone()));

    let app = create_router(state);

    let addr: std::net::SocketAddr = format!("0.0.0.0:{}", port).parse().unwrap();
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    tracing::info!("signapps-social ready at http://localhost:{}", port);
    axum::serve(listener, app).await.unwrap();
}
