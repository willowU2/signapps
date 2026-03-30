//! SignApps Notifications Service
//! Per-user notification feed with read/unread state management

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    middleware,
    response::IntoResponse,
    routing::{get, patch, post},
    Extension, Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::bootstrap::{env_or, init_tracing, load_env};
use signapps_common::middleware::{auth_middleware, AuthState};
use signapps_common::{Claims, JwtConfig, PgEventBus, PlatformEvent};
use sqlx::{postgres::PgPoolOptions, FromRow, Pool, Postgres};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Notification {
    pub id: Uuid,
    pub user_id: Uuid,
    #[sqlx(rename = "type")]
    pub notification_type: String,
    pub title: String,
    pub body: Option<String>,
    pub source: Option<String>,
    pub priority: String,
    pub is_read: bool,
    pub read_at: Option<DateTime<Utc>>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Request / Query DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct ListNotificationsQuery {
    pub user_id: Option<Uuid>,
    pub unread_only: Option<bool>,
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateNotificationRequest {
    pub user_id: Uuid,
    #[serde(rename = "type")]
    pub notification_type: Option<String>,
    pub title: String,
    pub body: Option<String>,
    pub source: Option<String>,
    pub priority: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct ReadAllQuery {
    pub user_id: Option<Uuid>,
}

// ---------------------------------------------------------------------------
// Application state
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
// Helpers
// ---------------------------------------------------------------------------

/// Resolve the target user_id: prefer JWT claims, fall back to query param.
fn resolve_user_id(
    claims: Option<&Claims>,
    query_user_id: Option<Uuid>,
) -> Result<Uuid, (StatusCode, String)> {
    if let Some(c) = claims {
        return Ok(c.sub);
    }
    query_user_id.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "user_id query parameter is required".to_string(),
        )
    })
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /api/notifications
/// Lists notifications for the authenticated user (or user_id param).
async fn list_notifications(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ListNotificationsQuery>,
) -> Result<Json<Vec<Notification>>, (StatusCode, String)> {
    let user_id = resolve_user_id(Some(&claims), query.user_id)?;
    let limit = query.limit.unwrap_or(100).min(500);
    let unread_only = query.unread_only.unwrap_or(false);

    let notifications = if unread_only {
        sqlx::query_as::<_, Notification>(
            r#"
            SELECT * FROM notifications.notifications
            WHERE user_id = $1 AND is_read = false
            ORDER BY created_at DESC
            LIMIT $2
            "#,
        )
        .bind(user_id)
        .bind(limit)
        .fetch_all(&state.pool)
        .await
    } else {
        sqlx::query_as::<_, Notification>(
            r#"
            SELECT * FROM notifications.notifications
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            "#,
        )
        .bind(user_id)
        .bind(limit)
        .fetch_all(&state.pool)
        .await
    }
    .map_err(|e| {
        tracing::error!("Failed to list notifications: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    Ok(Json(notifications))
}

/// POST /api/notifications
/// Create a new notification for a user.
async fn create_notification(
    State(state): State<AppState>,
    Json(payload): Json<CreateNotificationRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let notif = sqlx::query_as::<_, Notification>(
        r#"
        INSERT INTO notifications.notifications
            (user_id, type, title, body, source, priority, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        "#,
    )
    .bind(payload.user_id)
    .bind(payload.notification_type.as_deref().unwrap_or("info"))
    .bind(&payload.title)
    .bind(&payload.body)
    .bind(&payload.source)
    .bind(payload.priority.as_deref().unwrap_or("normal"))
    .bind(payload.metadata.unwrap_or(serde_json::json!({})))
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create notification: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    tracing::info!(
        id = %notif.id,
        user_id = %notif.user_id,
        "Notification created"
    );
    Ok((StatusCode::CREATED, Json(notif)))
}

/// PATCH /api/notifications/:id/read
/// Mark a specific notification as read.
async fn mark_read(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Notification>, (StatusCode, String)> {
    let notif = sqlx::query_as::<_, Notification>(
        r#"
        UPDATE notifications.notifications
        SET is_read = true, read_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to mark notification {} as read: {}", id, e);
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?
    .ok_or_else(|| (StatusCode::NOT_FOUND, "Notification not found".to_string()))?;

    Ok(Json(notif))
}

/// POST /api/notifications/read-all
/// Mark all unread notifications as read for the authenticated user.
async fn mark_all_read(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ReadAllQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user_id = resolve_user_id(Some(&claims), query.user_id)?;

    let result = sqlx::query(
        r#"
        UPDATE notifications.notifications
        SET is_read = true, read_at = now()
        WHERE user_id = $1 AND is_read = false
        "#,
    )
    .bind(user_id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to mark all notifications as read: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    tracing::info!(
        user_id = %user_id,
        updated = result.rows_affected(),
        "Marked all notifications as read"
    );
    Ok(Json(
        serde_json::json!({ "updated": result.rows_affected() }),
    ))
}

// ---------------------------------------------------------------------------
// Platform event → notification mapping
// ---------------------------------------------------------------------------

async fn handle_platform_event(
    pool: &sqlx::PgPool,
    event: PlatformEvent,
) -> Result<(), sqlx::Error> {
    let (user_id, title, body, link) = match event.event_type.as_str() {
        "mail.received" => {
            let from = event.payload["from"].as_str().unwrap_or("inconnu");
            let subject = event.payload["subject"].as_str().unwrap_or("(sans objet)");
            (
                event.aggregate_id,
                "Nouveau mail".to_string(),
                format!("De {}: {}", from, subject),
                "/mail",
            )
        },
        "calendar.event.created" => {
            let title_str = event.payload["title"].as_str().unwrap_or("evenement");
            (
                event.aggregate_id,
                "Nouvel evenement".to_string(),
                title_str.to_string(),
                "/calendar",
            )
        },
        "calendar.task.completed" => {
            let title_str = event.payload["title"].as_str().unwrap_or("tache");
            (
                event.aggregate_id,
                "Tache terminee".to_string(),
                title_str.to_string(),
                "/tasks",
            )
        },
        "billing.invoice.created" => (
            event.aggregate_id,
            "Nouvelle facture".to_string(),
            "Une facture a ete creee".to_string(),
            "/billing",
        ),
        "forms.response.submitted" => (
            event.aggregate_id,
            "Reponse formulaire".to_string(),
            "Nouvelle reponse recue".to_string(),
            "/forms",
        ),
        "social.post.published" => (
            event.aggregate_id,
            "Post publie".to_string(),
            "Publication reussie".to_string(),
            "/social",
        ),
        "chat.message.created" => {
            let preview = event.payload["content_preview"]
                .as_str()
                .unwrap_or("message");
            (
                event.aggregate_id,
                "Nouveau message".to_string(),
                preview.to_string(),
                "/chat",
            )
        },
        "drive.file.uploaded" => {
            let name = event.payload["name"].as_str().unwrap_or("fichier");
            (
                event.aggregate_id,
                "Fichier uploade".to_string(),
                name.to_string(),
                "/drive",
            )
        },
        "contacts.created" => {
            let name = event.payload["name"].as_str().unwrap_or("contact");
            (
                event.aggregate_id,
                "Nouveau contact".to_string(),
                name.to_string(),
                "/contacts",
            )
        },
        _ => return Ok(()), // Skip unknown events
    };

    if let Some(uid) = user_id {
        sqlx::query(
            "INSERT INTO notifications.notifications \
             (user_id, type, title, body, source, priority, metadata) \
             VALUES ($1, 'event', $2, $3, 'platform', 'normal', $4)",
        )
        .bind(uid)
        .bind(&title)
        .bind(&body)
        .bind(serde_json::json!({
            "event_id": event.event_id.to_string(),
            "event_type": event.event_type,
            "aggregate_id": event.aggregate_id.map(|id| id.to_string()),
            "link": link,
        }))
        .execute(pool)
        .await?;

        tracing::info!(
            event_type = %event.event_type,
            user_id = %uid,
            "notification created from platform event"
        );
    } else {
        tracing::debug!(
            event_type = %event.event_type,
            "skipping platform event — no aggregate_id to target a user"
        );
    }

    Ok(())
}

async fn health() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "ok",
        "service": "signapps-notifications",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": signapps_common::healthz::uptime_seconds()
    }))
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

    let public_routes = Router::new().route("/health", get(health));

    let protected_routes = Router::new()
        .route(
            "/api/notifications",
            get(list_notifications).post(create_notification),
        )
        .route("/api/notifications/read-all", post(mark_all_read))
        .route("/api/notifications/:id/read", patch(mark_read))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    public_routes
        .merge(protected_routes)
        .layer(TraceLayer::new_for_http())
        .layer(axum::extract::DefaultBodyLimit::max(10 * 1024 * 1024))
        .layer(cors)
        .with_state(state)
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing("signapps_notifications");
    load_env();

    let port: u16 = env_or("SERVER_PORT", "8095").parse().unwrap_or(8095);
    let database_url = env_or(
        "DATABASE_URL",
        "postgres://signapps:password@localhost:5432/signapps",
    );
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| {
        tracing::warn!("JWT_SECRET not set, using insecure dev default");
        "dev_secret_change_in_production_32chars".to_string()
    });

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;
    tracing::info!("Database connected");

    let jwt_config = JwtConfig {
        secret: jwt_secret,
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
        access_expiration: 900,
        refresh_expiration: 604800,
    };

    let state = AppState {
        pool: pool.clone(),
        jwt_config,
    };
    let app = create_router(state);

    // Spawn platform-event listener
    let listener_pool = pool.clone();
    let event_bus = PgEventBus::new(listener_pool.clone(), "signapps-notifications".to_string());
    tokio::spawn(async move {
        if let Err(e) = event_bus
            .listen("notifications-consumer", move |event| {
                let p = listener_pool.clone();
                Box::pin(async move { handle_platform_event(&p, event).await })
            })
            .await
        {
            tracing::error!("Event listener crashed: {}", e);
        }
    });

    let addr = format!("0.0.0.0:{}", port);
    tracing::info!("signapps-notifications listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(signapps_common::graceful_shutdown())
        .await?;

    Ok(())
}
