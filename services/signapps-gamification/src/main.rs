//! SignApps Gamification Service
//!
//! XP tracking, badges, streaks, and leaderboards.
//! Persists user progression in PostgreSQL instead of localStorage.

mod openapi;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    middleware,
    response::IntoResponse,
    routing::{get, post},
    Extension, Json, Router,
};
use chrono::{NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::{auth_middleware, AuthState};
use signapps_common::Claims;
use signapps_common::JwtConfig;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

/// A user's XP profile.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct UserXpRow {
    /// Unique identifier.
    pub id: Uuid,
    /// Owner user.
    pub user_id: Uuid,
    /// Cumulative XP earned.
    pub total_xp: i32,
    /// Current level (computed from XP).
    pub level: i32,
    /// Consecutive active days.
    pub streak_days: i32,
    /// Date of last recorded activity.
    pub last_activity_date: Option<NaiveDate>,
    /// Row creation timestamp.
    pub created_at: Option<chrono::DateTime<Utc>>,
    /// Row update timestamp.
    pub updated_at: Option<chrono::DateTime<Utc>>,
}

/// A single XP gain event.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct XpEventRow {
    /// Unique identifier.
    pub id: Uuid,
    /// User who earned XP.
    pub user_id: Uuid,
    /// Action that triggered the XP gain (e.g. `document.create`).
    pub action: String,
    /// Amount of XP awarded.
    pub xp_amount: i32,
    /// Originating module (e.g. `docs`, `mail`).
    pub source_module: Option<String>,
    /// Originating entity identifier.
    pub source_id: Option<Uuid>,
    /// Timestamp.
    pub created_at: Option<chrono::DateTime<Utc>>,
}

/// A badge earned by a user.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct BadgeRow {
    /// Unique identifier.
    pub id: Uuid,
    /// User who earned the badge.
    pub user_id: Uuid,
    /// Badge type identifier (e.g. `streak_7`, `level_5`).
    pub badge_type: String,
    /// When the badge was earned.
    pub earned_at: Option<chrono::DateTime<Utc>>,
}

// ---------------------------------------------------------------------------
// Request / response DTOs
// ---------------------------------------------------------------------------

/// Request body for awarding XP.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct AwardXpRequest {
    /// Action identifier (e.g. `document.create`).
    pub action: String,
    /// Source module name.
    pub source_module: Option<String>,
    /// Source entity UUID.
    pub source_id: Option<Uuid>,
}

/// Leaderboard query parameters.
#[derive(Debug, Deserialize)]
pub struct LeaderboardQuery {
    /// Period filter: `weekly`, `monthly`, or `alltime`.
    pub period: Option<String>,
}

/// Leaderboard entry returned to the client.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct LeaderEntry {
    /// Rank position.
    pub rank: i64,
    /// User identifier.
    pub id: Uuid,
    /// Display name (placeholder — enriched by frontend).
    pub display_name: String,
    /// Total XP.
    pub xp: i32,
    /// Level.
    pub level: i32,
    /// Current streak in days.
    pub streak: i32,
    /// Number of badges earned.
    pub badges_count: i64,
}

/// Streak data returned to the client.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct StreakResponse {
    /// Current consecutive days.
    pub current: i32,
    /// Longest streak ever (same as current for now).
    pub longest: i32,
    /// ISO date of last activity.
    pub last_active: String,
}

// ---------------------------------------------------------------------------
// XP table lookup
// ---------------------------------------------------------------------------

/// XP awarded per action.
fn xp_for_action(action: &str) -> i32 {
    match action {
        "document.create" => 15,
        "email.send" => 5,
        "meeting.attend" => 20,
        "task.complete" => 10,
        "review.submit" => 25,
        "login.daily" => 5,
        "file.upload" => 5,
        "comment.create" => 3,
        _ => 5,
    }
}

/// Compute level from total XP (100 XP per level).
fn level_from_xp(xp: i32) -> i32 {
    (xp / 100) + 1
}

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------

/// Application state for the gamification service.
#[derive(Clone)]
pub struct AppState {
    /// JWT configuration for auth middleware.
    pub jwt_config: JwtConfig,
    /// Database pool.
    pub pool: sqlx::PgPool,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /api/v1/gamification/xp — get current user's XP profile.
///
/// Creates the profile row on first access (upsert).
///
/// # Errors
///
/// Returns 500 on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/api/v1/gamification/xp",
    responses(
        (status = 200, description = "User XP profile", body = UserXpRow),
        (status = 500, description = "Internal error"),
    ),
    security(("bearerAuth" = [])),
    tag = "gamification"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
async fn get_my_xp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let result = sqlx::query_as::<_, UserXpRow>(
        r#"INSERT INTO gamification.user_xp (user_id)
           VALUES ($1)
           ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
           RETURNING *"#,
    )
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await;

    match result {
        Ok(row) => (StatusCode::OK, Json(serde_json::to_value(row).unwrap_or_default())),
        Err(e) => {
            tracing::error!(?e, "Failed to get user XP");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            )
        },
    }
}

/// POST /api/v1/gamification/xp — award XP to the current user.
///
/// Upserts the user_xp row, records an xp_events row, and updates streak.
///
/// # Errors
///
/// Returns 500 on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    post,
    path = "/api/v1/gamification/xp",
    request_body = AwardXpRequest,
    responses(
        (status = 200, description = "Updated XP profile", body = UserXpRow),
        (status = 500, description = "Internal error"),
    ),
    security(("bearerAuth" = [])),
    tag = "gamification"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
async fn award_xp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<AwardXpRequest>,
) -> impl IntoResponse {
    let xp = xp_for_action(&payload.action);
    let today = Utc::now().date_naive();

    // 1. Record XP event
    let event_result = sqlx::query(
        r#"INSERT INTO gamification.xp_events (user_id, action, xp_amount, source_module, source_id)
           VALUES ($1, $2, $3, $4, $5)"#,
    )
    .bind(claims.sub)
    .bind(&payload.action)
    .bind(xp)
    .bind(&payload.source_module)
    .bind(payload.source_id)
    .execute(&state.pool)
    .await;

    if let Err(e) = event_result {
        tracing::error!(?e, "Failed to insert xp_event");
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Internal Error" })),
        );
    }

    // 2. Upsert user_xp: add XP, update level, update streak
    let result = sqlx::query_as::<_, UserXpRow>(
        r#"INSERT INTO gamification.user_xp (user_id, total_xp, level, streak_days, last_activity_date)
           VALUES ($1, $2, $3, 1, $4)
           ON CONFLICT (user_id) DO UPDATE SET
               total_xp = gamification.user_xp.total_xp + $2,
               level = (gamification.user_xp.total_xp + $2) / 100 + 1,
               streak_days = CASE
                   WHEN gamification.user_xp.last_activity_date = $4::date - INTERVAL '1 day'
                       THEN gamification.user_xp.streak_days + 1
                   WHEN gamification.user_xp.last_activity_date = $4::date
                       THEN gamification.user_xp.streak_days
                   ELSE 1
               END,
               last_activity_date = $4,
               updated_at = NOW()
           RETURNING *"#,
    )
    .bind(claims.sub)
    .bind(xp)
    .bind(level_from_xp(xp))
    .bind(today)
    .fetch_one(&state.pool)
    .await;

    match result {
        Ok(row) => {
            tracing::info!(user_id = %claims.sub, action = %payload.action, xp, "XP awarded");
            (StatusCode::OK, Json(serde_json::to_value(row).unwrap_or_default()))
        },
        Err(e) => {
            tracing::error!(?e, "Failed to upsert user XP");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            )
        },
    }
}

/// GET /api/v1/gamification/badges — get current user's badges.
///
/// # Errors
///
/// Returns 500 on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/api/v1/gamification/badges",
    responses(
        (status = 200, description = "List of badges", body = Vec<BadgeRow>),
        (status = 500, description = "Internal error"),
    ),
    security(("bearerAuth" = [])),
    tag = "gamification"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
async fn get_my_badges(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let result = sqlx::query_as::<_, BadgeRow>(
        "SELECT * FROM gamification.badges WHERE user_id = $1 ORDER BY earned_at DESC",
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await;

    match result {
        Ok(rows) => (StatusCode::OK, Json(serde_json::to_value(rows).unwrap_or_default())),
        Err(e) => {
            tracing::error!(?e, "Failed to get badges");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            )
        },
    }
}

/// GET /api/v1/gamification/streak — get current user's streak data.
///
/// # Errors
///
/// Returns 500 on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/api/v1/gamification/streak",
    responses(
        (status = 200, description = "Streak data", body = StreakResponse),
        (status = 500, description = "Internal error"),
    ),
    security(("bearerAuth" = [])),
    tag = "gamification"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
async fn get_streak(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let result = sqlx::query_as::<_, UserXpRow>(
        "SELECT * FROM gamification.user_xp WHERE user_id = $1",
    )
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await;

    match result {
        Ok(Some(row)) => {
            let resp = StreakResponse {
                current: row.streak_days,
                longest: row.streak_days, // TODO: track longest separately
                last_active: row
                    .last_activity_date
                    .map(|d| d.to_string())
                    .unwrap_or_default(),
            };
            (StatusCode::OK, Json(serde_json::to_value(resp).unwrap_or_default()))
        },
        Ok(None) => {
            let resp = StreakResponse {
                current: 0,
                longest: 0,
                last_active: String::new(),
            };
            (StatusCode::OK, Json(serde_json::to_value(resp).unwrap_or_default()))
        },
        Err(e) => {
            tracing::error!(?e, "Failed to get streak");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            )
        },
    }
}

/// GET /api/v1/gamification/leaderboard — top users by XP.
///
/// # Errors
///
/// Returns 500 on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/api/v1/gamification/leaderboard",
    responses(
        (status = 200, description = "Leaderboard entries", body = Vec<LeaderEntry>),
        (status = 500, description = "Internal error"),
    ),
    security(("bearerAuth" = [])),
    tag = "gamification"
)]
#[tracing::instrument(skip(state, _claims))]
async fn get_leaderboard(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Query(_query): Query<LeaderboardQuery>,
) -> impl IntoResponse {
    // Leaderboard: top 50 users by XP, with badge count
    let result = sqlx::query_as::<_, LeaderEntry>(
        r#"SELECT
               ROW_NUMBER() OVER (ORDER BY ux.total_xp DESC) AS rank,
               ux.user_id AS id,
               'User ' || SUBSTR(ux.user_id::text, 1, 8) AS display_name,
               ux.total_xp AS xp,
               ux.level,
               ux.streak_days AS streak,
               COALESCE(bc.cnt, 0) AS badges_count
           FROM gamification.user_xp ux
           LEFT JOIN (
               SELECT user_id, COUNT(*) AS cnt FROM gamification.badges GROUP BY user_id
           ) bc ON bc.user_id = ux.user_id
           ORDER BY ux.total_xp DESC
           LIMIT 50"#,
    )
    .fetch_all(&state.pool)
    .await;

    match result {
        Ok(rows) => (StatusCode::OK, Json(serde_json::to_value(rows).unwrap_or_default())),
        Err(e) => {
            tracing::error!(?e, "Failed to get leaderboard");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            )
        },
    }
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

/// Health check endpoint.
async fn health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "ok",
        "service": "signapps-gamification",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": signapps_common::healthz::uptime_seconds(),
        "app": {
            "id": "gamification",
            "label": "Gamification",
            "description": "Progression, XP, badges et classement",
            "icon": "Zap",
            "category": "Organisation",
            "color": "text-yellow-500",
            "href": "/gamification",
            "port": 3033
        }
    }))
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/// Build the Axum router for the gamification service.
fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            "http://localhost:3000".parse().expect("valid origin"),
            "http://127.0.0.1:3000".parse().expect("valid origin"),
        ]))
        .allow_credentials(true)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
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

    let public_routes = Router::new().route("/health", get(health_check));

    let protected_routes = Router::new()
        .route(
            "/api/v1/gamification/xp",
            get(get_my_xp).post(award_xp),
        )
        .route("/api/v1/gamification/badges", get(get_my_badges))
        .route("/api/v1/gamification/streak", get(get_streak))
        .route("/api/v1/gamification/leaderboard", get(get_leaderboard))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    public_routes
        .merge(protected_routes)
        .merge(openapi::swagger_router())
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing("signapps_gamification");
    load_env();

    let config = ServiceConfig::from_env("signapps-gamification", 3033);
    config.log_startup();

    let db_pool = signapps_db::create_pool(&config.database_url).await?;

    if let Err(e) = signapps_db::run_migrations(&db_pool).await {
        tracing::warn!("Failed to apply database migrations for Gamification: {}", e);
    }

    tracing::info!("Running fallback SQL creation for gamification schema...");
    let fallback_sql = include_str!("../../../migrations/253_gamification_schema.sql");
    use sqlx::Executor;
    match db_pool.inner().execute(fallback_sql).await {
        Ok(_) => tracing::info!("Gamification tables successfully created via fallback SQL"),
        Err(e) => tracing::error!("Fallback SQL execution failed: {}", e),
    }

    let pool = db_pool.inner().clone();

    let jwt_config = JwtConfig::from_env();

    let state = AppState { jwt_config, pool };

    tracing::info!("Database connected & service ready");

    let app = create_router(state);

    signapps_common::bootstrap::run_server(app, &config).await?;

    Ok(())
}
