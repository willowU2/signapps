pub mod handlers;
pub mod models;
pub mod oauth_consumer;
pub mod platforms;
pub mod publisher;

use axum::{
    middleware,
    routing::{delete, get, patch, post},
    Router,
};
use signapps_common::bootstrap::{env_or, init_tracing, load_env};
use signapps_common::middleware::{auth_middleware, tenant_context_middleware, AuthState};
use signapps_common::pg_events::PgEventBus;
use signapps_common::JwtConfig;
use signapps_keystore::{Keystore, KeystoreBackend, TokenColumnSpec};
use sqlx::{postgres::PgPoolOptions, Pool, Postgres};
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};

use handlers::{
    accounts, ai_threads, analytics, api_keys, automation, content_sets, inbox, media, oauth,
    post_comments, posts, short_urls, signatures, time_slots, webhooks, workspaces,
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

#[derive(Clone)]
/// Application state for  service.
pub struct AppState {
    pub pool: Pool<Postgres>,
    pub jwt_config: JwtConfig,
    pub event_bus: PgEventBus,
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
            "http://localhost:3000".parse().expect("valid CORS origin"),
            "http://127.0.0.1:3000".parse().expect("valid CORS origin"),
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

    let public_routes = Router::new()
        .route("/health", get(|| async {
            axum::Json(serde_json::json!({
                "status": "ok",
                "service": "signapps-social",
                "version": env!("CARGO_PKG_VERSION"),
                "app": {
                    "id": "social",
                    "label": "Social",
                    "description": "Réseau social interne",
                    "icon": "Users2",
                    "category": "Communication",
                    "color": "text-pink-500",
                    "href": "/social",
                    "port": 3019
                }
            }))
        }))
        .route("/s/:code", get(short_urls::track_click))
        // OAuth callbacks are public — the platform redirects to these after login
        .route(
            "/api/v1/social/oauth/:platform/callback",
            get(oauth::oauth_callback),
        );

    let protected_routes = Router::new()
        // OAuth authorize (protected — needs user JWT to store state with user_id)
        .route(
            "/api/v1/social/oauth/:platform/authorize",
            get(oauth::oauth_authorize),
        )
        // OAuth credentials save (admin stores client_id/secret in DB)
        .route(
            "/api/v1/social/oauth/credentials",
            post(oauth::save_oauth_credentials),
        )
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
        // Post approval workflow
        .route(
            "/api/v1/social/posts/:id/submit-for-review",
            post(posts::submit_for_review),
        )
        .route(
            "/api/v1/social/posts/:id/approve",
            post(posts::approve_post),
        )
        .route(
            "/api/v1/social/posts/:id/reject",
            post(posts::reject_post),
        )
        .route(
            "/api/v1/social/posts/review-queue",
            get(posts::list_review_queue),
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
        // SYNC-SOCIAL-ANALYTICS: additional analytics endpoints
        .route(
            "/api/v1/social/analytics/followers",
            get(analytics::followers_timeline),
        )
        .route(
            "/api/v1/social/analytics/by-platform",
            get(analytics::by_platform),
        )
        .route(
            "/api/v1/social/analytics/top-posts",
            get(analytics::top_posts),
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
        // SYNC-SOCIAL-RSSCHECK: immediate check trigger
        .route(
            "/api/v1/social/rss-feeds/:id/check",
            post(automation::check_rss_feed_now),
        )
        // Templates
        .route(
            "/api/v1/social/templates",
            get(automation::list_templates).post(automation::create_template),
        )
        .route(
            "/api/v1/social/templates/:id",
            patch(automation::update_template).delete(automation::delete_template),
        )
        // AI
        .route("/api/v1/social/ai/generate", post(automation::ai_generate))
        .route("/api/v1/social/ai/hashtags", post(automation::ai_hashtags))
        .route(
            "/api/v1/social/ai/best-time",
            post(automation::ai_best_time),
        )
        // SYNC-SOCIAL-SMARTREPLY
        .route(
            "/api/v1/social/ai/smart-replies/:inbox_item_id",
            get(automation::ai_smart_replies),
        )
        // Signatures
        .route(
            "/api/v1/social/signatures",
            get(signatures::list_signatures).post(signatures::create_signature),
        )
        .route(
            "/api/v1/social/signatures/:id",
            patch(signatures::update_signature).delete(signatures::delete_signature),
        )
        // Media library
        .route(
            "/api/v1/social/media",
            get(media::list_media).post(media::create_media),
        )
        .route("/api/v1/social/media/:id", delete(media::delete_media))
        // Short URLs
        .route(
            "/api/v1/social/short-urls",
            get(short_urls::list_short_urls).post(short_urls::create_short_url),
        )
        .route(
            "/api/v1/social/short-urls/:id",
            delete(short_urls::delete_short_url),
        )
        // Webhooks
        .route(
            "/api/v1/social/webhooks",
            get(webhooks::list_webhooks).post(webhooks::create_webhook),
        )
        .route(
            "/api/v1/social/webhooks/:id",
            patch(webhooks::update_webhook).delete(webhooks::delete_webhook),
        )
        .route(
            "/api/v1/social/webhooks/:id/test",
            post(webhooks::test_webhook),
        )
        // Workspaces
        .route(
            "/api/v1/social/workspaces",
            get(workspaces::list_workspaces).post(workspaces::create_workspace),
        )
        .route(
            "/api/v1/social/workspaces/:id",
            get(workspaces::get_workspace).delete(workspaces::delete_workspace),
        )
        .route(
            "/api/v1/social/workspaces/:id/members",
            get(workspaces::list_members).post(workspaces::invite_member),
        )
        .route(
            "/api/v1/social/workspaces/:id/members/:user_id",
            delete(workspaces::remove_member),
        )
        // Post comments (team review)
        .route(
            "/api/v1/social/posts/:id/comments",
            get(post_comments::list_comments).post(post_comments::create_comment),
        )
        .route(
            "/api/v1/social/posts/:post_id/comments/:id",
            delete(post_comments::delete_comment),
        )
        // Time slots
        .route(
            "/api/v1/social/time-slots",
            get(time_slots::list_time_slots).post(time_slots::create_time_slot),
        )
        .route(
            "/api/v1/social/time-slots/:id",
            delete(time_slots::delete_time_slot),
        )
        // Content sets
        .route(
            "/api/v1/social/content-sets",
            get(content_sets::list_content_sets).post(content_sets::create_content_set),
        )
        .route(
            "/api/v1/social/content-sets/:id",
            delete(content_sets::delete_content_set),
        )
        // API keys
        .route(
            "/api/v1/social/api-keys",
            get(api_keys::list_api_keys).post(api_keys::create_api_key),
        )
        .route(
            "/api/v1/social/api-keys/:id/revoke",
            post(api_keys::revoke_api_key),
        )
        // AI chat threads
        .route(
            "/api/v1/social/ai-threads",
            get(ai_threads::list_ai_threads).post(ai_threads::create_ai_thread),
        )
        .route(
            "/api/v1/social/ai-threads/:id",
            get(ai_threads::get_ai_thread)
                .put(ai_threads::update_ai_thread)
                .delete(ai_threads::delete_ai_thread),
        )
        .route_layer(middleware::from_fn(tenant_context_middleware))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    public_routes
        .merge(protected_routes)
        .merge(handlers::openapi::swagger_router())
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

    // JWT configuration — auto-detects RS256 or HS256 from environment
    let jwt_config = JwtConfig::from_env();

    let event_bus = PgEventBus::new(pool.clone(), "signapps-social".to_string());

    let state = AppState {
        pool: pool.clone(),
        jwt_config,
        event_bus,
    };

    // ── Keystore + boot guardrail ────────────────────────────────────────────
    // Load the master key from env (KEYSTORE_MASTER_KEY). If the env var is
    // absent we log a warning and continue — this allows running in test/dev
    // environments without a keystore.
    let keystore = Keystore::init(KeystoreBackend::EnvVar).await;
    if let Err(ref e) = keystore {
        tracing::warn!(
            "Keystore unavailable ({}); OAuth token guardrail skipped",
            e
        );
    }
    if keystore.is_ok() {
        if let Err(e) = signapps_keystore::assert_tokens_encrypted(
            &pool,
            &[
                TokenColumnSpec {
                    table: "social.accounts",
                    text_col: "access_token",
                    enc_col: "access_token_enc",
                },
                TokenColumnSpec {
                    table: "social.accounts",
                    text_col: "refresh_token",
                    enc_col: "refresh_token_enc",
                },
            ],
        )
        .await
        {
            tracing::error!("Plaintext OAuth token guardrail failed: {}", e);
            std::process::exit(1);
        }
    }

    // ── OAuth consumer ───────────────────────────────────────────────────────
    // Subscribes to oauth.tokens.acquired events and upserts into
    // social.accounts.
    oauth_consumer::spawn_consumer(
        pool.clone(),
        std::sync::Arc::new(PgEventBus::new(pool.clone(), "signapps-social".to_string())),
    );

    // Start background publisher
    tokio::spawn(publisher::start_publisher(pool.clone()));

    let app = create_router(state);

    let addr: std::net::SocketAddr = format!("0.0.0.0:{}", port)
        .parse()
        .expect("valid socket address");
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("bind to socket address");
    tracing::info!("signapps-social ready at http://localhost:{}", port);
    axum::serve(listener, app)
        .with_graceful_shutdown(signapps_common::graceful_shutdown())
        .await
        .expect("server run");
}
