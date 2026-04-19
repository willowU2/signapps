//! Public library interface for signapps-notifications.
//!
//! Exposes [`router`] so the single-binary runtime can mount the
//! notifications routes without owning its own pool.

pub mod handlers;
pub mod openapi;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    middleware,
    response::IntoResponse,
    routing::{delete, get, patch, post, put},
    Extension, Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::middleware::{auth_middleware, tenant_context_middleware, AuthState};
use signapps_common::{Claims, JwtConfig, PgEventBus, PlatformEvent};
use signapps_service::shared_state::SharedState;
use sqlx::{FromRow, Pool, Postgres};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, utoipa::ToSchema)]
/// Represents a notification.
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

#[derive(Debug, Deserialize, utoipa::IntoParams)]
/// Query parameters for filtering and pagination.
pub struct ListNotificationsQuery {
    pub user_id: Option<Uuid>,
    pub unread_only: Option<bool>,
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for CreateNotification operation.
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

#[derive(Debug, Deserialize, utoipa::IntoParams)]
/// Query parameters for filtering and pagination.
pub struct ReadAllQuery {
    pub user_id: Option<Uuid>,
}

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------

#[derive(Clone)]
/// Application state for the Notifications service.
pub struct AppState {
    pub pool: Pool<Postgres>,
    pub jwt_config: JwtConfig,
    /// Shared RBAC resolver injected by the runtime. `None` in tests.
    pub resolver: Option<
        std::sync::Arc<dyn signapps_common::rbac::resolver::OrgPermissionResolver>,
    >,
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
#[utoipa::path(
    get,
    path = "/api/notifications",
    params(ListNotificationsQuery),
    responses(
        (status = 200, description = "List of notifications", body = Vec<Notification>),
        (status = 400, description = "user_id required when not authenticated"),
        (status = 500, description = "Database error"),
    ),
    security(("bearerAuth" = [])),
    tag = "notifications"
)]
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
#[utoipa::path(
    post,
    path = "/api/notifications",
    request_body = CreateNotificationRequest,
    responses(
        (status = 201, description = "Notification created", body = Notification),
        (status = 500, description = "Database error"),
    ),
    security(("bearerAuth" = [])),
    tag = "notifications"
)]
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
#[utoipa::path(
    patch,
    path = "/api/notifications/{id}/read",
    params(("id" = Uuid, Path, description = "Notification UUID")),
    responses(
        (status = 200, description = "Notification marked as read", body = Notification),
        (status = 404, description = "Notification not found"),
        (status = 500, description = "Database error"),
    ),
    security(("bearerAuth" = [])),
    tag = "notifications"
)]
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
#[utoipa::path(
    post,
    path = "/api/notifications/read-all",
    params(ReadAllQuery),
    responses(
        (status = 200, description = "Count of notifications marked as read"),
        (status = 400, description = "user_id required when not authenticated"),
        (status = 500, description = "Database error"),
    ),
    security(("bearerAuth" = [])),
    tag = "notifications"
)]
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

/// Insert a Meet-related notification row.
async fn insert_meet_notification(
    pool: &sqlx::PgPool,
    user_id: Uuid,
    notif_type: &str,
    title: &str,
    body: &str,
    metadata: serde_json::Value,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO notifications.notifications \
         (user_id, type, title, body, source, priority, metadata) \
         VALUES ($1, $2, $3, $4, 'meet', 'normal', $5)",
    )
    .bind(user_id)
    .bind(notif_type)
    .bind(title)
    .bind(body)
    .bind(metadata)
    .execute(pool)
    .await
    .map(|_| ())
}

async fn handle_chat_video_call_started(
    pool: &sqlx::PgPool,
    event: &PlatformEvent,
) -> Result<(), sqlx::Error> {
    let thread_id: Option<Uuid> = event
        .payload
        .get("thread_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());
    let Some(thread_id) = thread_id else {
        return Ok(());
    };

    let room_code = event
        .payload
        .get("room_code")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let initiator_id: Option<Uuid> = event
        .payload
        .get("initiator_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());
    let initiator_name = event
        .payload
        .get("initiator_name")
        .and_then(|v| v.as_str())
        .unwrap_or("Un collegue");
    let link = event
        .payload
        .get("link")
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or_else(|| format!("/meet/{}", room_code));

    let rows: Vec<(Uuid,)> = sqlx::query_as(
        "SELECT DISTINCT user_id FROM ( \
             SELECT created_by AS user_id FROM chat.channels WHERE id = $1 \
             UNION \
             SELECT user_id FROM chat.channel_members WHERE channel_id = $1 \
         ) t",
    )
    .bind(thread_id)
    .fetch_all(pool)
    .await?;

    let title = format!("Appel video demarre par {initiator_name}");
    let body = format!("Rejoignez l'appel : {link}");
    let metadata = serde_json::json!({
        "event_type": "meet.invited",
        "room_code": room_code,
        "link": link,
        "initiator_id": initiator_id,
        "initiator_name": initiator_name,
        "thread_id": thread_id,
    });
    for (uid,) in rows {
        if Some(uid) == initiator_id {
            continue;
        }
        if let Err(e) =
            insert_meet_notification(pool, uid, "meet.invited", &title, &body, metadata.clone())
                .await
        {
            tracing::warn!(?e, user_id = %uid, "failed to insert meet.invited");
        }
    }
    Ok(())
}

async fn handle_meet_knock_requested(
    pool: &sqlx::PgPool,
    event: &PlatformEvent,
) -> Result<(), sqlx::Error> {
    let room_id: Option<Uuid> = event
        .payload
        .get("room_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());
    let Some(room_id) = room_id else {
        return Ok(());
    };

    let room_code = event
        .payload
        .get("room_code")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let identity = event
        .payload
        .get("identity")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let display_name = event
        .payload
        .get("display_name")
        .and_then(|v| v.as_str())
        .unwrap_or("Invite");

    let host: Option<(Uuid,)> = sqlx::query_as("SELECT created_by FROM meet.rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(pool)
        .await?;
    let Some((host_id,)) = host else {
        return Ok(());
    };

    let title = format!("{display_name} attend dans la salle");
    let body = format!("{display_name} demande a rejoindre votre reunion {room_code}.");
    let metadata = serde_json::json!({
        "event_type": "meet.knock_received",
        "room_code": room_code,
        "identity": identity,
        "display_name": display_name,
        "link": format!("/meet/{}", room_code),
    });
    insert_meet_notification(
        pool,
        host_id,
        "meet.knock_received",
        &title,
        &body,
        metadata,
    )
    .await
}

async fn handle_meet_recording_ready(
    pool: &sqlx::PgPool,
    event: &PlatformEvent,
) -> Result<(), sqlx::Error> {
    let room_id: Option<Uuid> = event
        .payload
        .get("room_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());
    let Some(room_id) = room_id else {
        return Ok(());
    };

    let recording_id = event
        .payload
        .get("recording_id")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let row: Option<(Uuid, String)> =
        sqlx::query_as("SELECT created_by, room_code FROM meet.rooms WHERE id = $1")
            .bind(room_id)
            .fetch_optional(pool)
            .await?;
    let Some((host_id, room_code)) = row else {
        return Ok(());
    };

    let title = "Enregistrement disponible".to_string();
    let body = format!("Votre enregistrement de la reunion {room_code} est pret.");
    let metadata = serde_json::json!({
        "event_type": "meet.recording_ready",
        "room_code": room_code,
        "recording_id": recording_id,
        "link": format!("/meet/recordings/{}", recording_id),
    });
    insert_meet_notification(
        pool,
        host_id,
        "meet.recording_ready",
        &title,
        &body,
        metadata,
    )
    .await
}

async fn fanout_calendar_meet_invite(
    pool: &sqlx::PgPool,
    event: &PlatformEvent,
) -> Result<(), sqlx::Error> {
    let title_str = event.payload["title"].as_str().unwrap_or("Reunion");
    let room_code = event
        .payload
        .get("meet_room_code")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let organizer_id: Option<Uuid> = event
        .payload
        .get("organizer_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());
    let link = format!("/meet/{}", room_code);

    let guest_ids: Vec<Uuid> = event
        .payload
        .get("guest_ids")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().and_then(|s| Uuid::parse_str(s).ok()))
                .collect()
        })
        .unwrap_or_default();

    if guest_ids.is_empty() {
        tracing::debug!(
            "calendar.event.created has_meet_room=true with no guest_ids, skipping fanout"
        );
        return Ok(());
    }

    let body = format!("Rejoignez la reunion : {link}");
    let metadata = serde_json::json!({
        "event_type": "meet.invited",
        "room_code": room_code,
        "link": link,
        "source": "calendar",
    });
    for uid in guest_ids {
        if Some(uid) == organizer_id {
            continue;
        }
        let title = format!("Invitation : {title_str}");
        if let Err(e) =
            insert_meet_notification(pool, uid, "meet.invited", &title, &body, metadata.clone())
                .await
        {
            tracing::warn!(?e, user_id = %uid, "failed to insert calendar meet.invited");
        }
    }
    Ok(())
}

async fn handle_platform_event(
    pool: &sqlx::PgPool,
    event: PlatformEvent,
) -> Result<(), sqlx::Error> {
    match event.event_type.as_str() {
        "chat.video_call.started" => {
            return handle_chat_video_call_started(pool, &event).await;
        },
        "meet.knock.requested" => {
            return handle_meet_knock_requested(pool, &event).await;
        },
        "meet.recording.ready" => {
            return handle_meet_recording_ready(pool, &event).await;
        },
        _ => {},
    }

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
            if event
                .payload
                .get("has_meet_room")
                .and_then(|v| v.as_bool())
                .unwrap_or(false)
            {
                if let Err(e) = fanout_calendar_meet_invite(pool, &event).await {
                    tracing::warn!(?e, "meet.invited fanout failed");
                }
            }
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
        _ => return Ok(()),
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
        "uptime_seconds": signapps_common::healthz::uptime_seconds(),
        "app": {
            "id": "notifications",
            "label": "Notifications",
            "description": "Centre de notifications",
            "icon": "Bell",
            "category": "Communication",
            "color": "text-amber-500",
            "href": "/notifications",
            "port": 8095
        }
    }))
}

// ---------------------------------------------------------------------------
// Public router builder
// ---------------------------------------------------------------------------

/// Build the notifications router using the shared runtime state.
///
/// # Errors
///
/// Returns an error if shared-state cloning fails.
pub async fn router(shared: SharedState) -> anyhow::Result<Router> {
    let state = build_state(&shared).await?;

    // Spawn platform-event listener. The listener owns its own PgEventBus +
    // dedicated pool clone; it must die when the factory closure is dropped
    // (supervisor respawn) — which happens naturally since tokio::spawn tasks
    // are cancelled when their parent runtime shuts down.
    let listener_pool = state.pool.clone();
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

    Ok(create_router(state))
}

async fn build_state(shared: &SharedState) -> anyhow::Result<AppState> {
    Ok(AppState {
        pool: shared.pool.inner().clone(),
        jwt_config: (*shared.jwt).clone(),
        resolver: shared.resolver.clone(),
    })
}

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
        .route("/health", get(health))
        .merge(signapps_common::version::router("signapps-notifications"));

    let protected_routes = Router::new()
        .route(
            "/api/notifications",
            get(list_notifications).post(create_notification),
        )
        .route("/api/notifications/read-all", post(mark_all_read))
        .route("/api/notifications/:id/read", patch(mark_read))
        .route_layer(middleware::from_fn(tenant_context_middleware))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    let v1_routes = Router::new()
        .route(
            "/api/v1/notifications",
            get(handlers::notifications::list_notifications)
                .post(handlers::notifications::create_notification),
        )
        .route(
            "/api/v1/notifications/unread-count",
            get(handlers::notifications::unread_count),
        )
        .route(
            "/api/v1/notifications/read-all",
            put(handlers::notifications::mark_all_read),
        )
        .route(
            "/api/v1/notifications/preferences",
            get(handlers::notifications::get_preferences)
                .put(handlers::notifications::update_preferences),
        )
        .route(
            "/api/v1/notifications/:id/read",
            put(handlers::notifications::mark_read),
        )
        .route(
            "/api/v1/notifications/:id",
            delete(handlers::notifications::delete_notification),
        )
        .route_layer(middleware::from_fn(tenant_context_middleware))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    public_routes
        .merge(protected_routes)
        .merge(v1_routes)
        .merge(openapi::swagger_router())
        .layer(TraceLayer::new_for_http())
        .layer(axum::extract::DefaultBodyLimit::max(10 * 1024 * 1024))
        .layer(cors)
        .with_state(state)
}
