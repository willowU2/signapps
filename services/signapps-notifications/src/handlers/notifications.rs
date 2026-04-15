//! Notification feed endpoints — list, create, read, delete, preferences.
//!
//! # Endpoints
//!
//! - `GET    /api/v1/notifications`              — list notifications (cursor-paginated)
//! - `GET    /api/v1/notifications/unread-count`  — return `{count: N}`
//! - `POST   /api/v1/notifications`              — create notification (internal)
//! - `PUT    /api/v1/notifications/:id/read`      — mark one as read
//! - `PUT    /api/v1/notifications/read-all`      — mark all as read
//! - `DELETE /api/v1/notifications/:id`           — delete notification
//! - `GET    /api/v1/notifications/preferences`   — get user preferences
//! - `PUT    /api/v1/notifications/preferences`   — update user preferences

use crate::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use signapps_common::{Claims, Error, Result};
use uuid::Uuid;

// ── Domain types ────────────────────────────────────────────────────────────

/// A rich notification item stored in `notifications.items`.
///
/// Supports typed notifications with deep-links back to the source entity.
///
/// # Examples
///
/// ```ignore
/// let item = NotificationItem { title: "New comment".into(), ..Default::default() };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct NotificationItem {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Target user.
    pub user_id: Uuid,
    /// Notification type: system, mention, assignment, reminder, approval, share, comment, reaction.
    #[serde(rename = "type")]
    #[sqlx(rename = "type")]
    pub notification_type: String,
    /// Short title displayed in the feed.
    pub title: String,
    /// Optional longer body text.
    pub body: Option<String>,
    /// Source module (calendar, mail, drive, etc.).
    pub module: String,
    /// Optional entity type (task, document, email, etc.).
    pub entity_type: Option<String>,
    /// Optional entity UUID for deep-linking.
    pub entity_id: Option<Uuid>,
    /// URL path to navigate to when clicked.
    pub deep_link: Option<String>,
    /// Whether the notification has been read.
    pub read: bool,
    /// Timestamp when notification was read.
    pub read_at: Option<DateTime<Utc>>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
}

/// User notification preferences stored in `notifications.preferences`.
///
/// Controls delivery channels, quiet hours, digest frequency, and muted modules.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct NotificationPreferences {
    /// Unique identifier.
    pub id: Uuid,
    /// User this preference belongs to.
    pub user_id: Uuid,
    /// Channel toggles: `{"in_app": true, "email": true, "push": false}`.
    pub channels: Value,
    /// Start of quiet hours (no notifications sent).
    pub quiet_hours_start: Option<NaiveTime>,
    /// End of quiet hours.
    pub quiet_hours_end: Option<NaiveTime>,
    /// Digest frequency: "none", "daily", "weekly".
    pub digest_frequency: Option<String>,
    /// List of module names that are muted.
    pub muted_modules: Option<Vec<String>>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

// ── Request / Response DTOs ─────────────────────────────────────────────────

/// Query parameters for listing notifications.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListNotificationsQuery {
    /// Filter to unread notifications only.
    pub unread_only: Option<bool>,
    /// Filter by notification type.
    #[serde(rename = "type")]
    pub notification_type: Option<String>,
    /// Filter by source module.
    pub module: Option<String>,
    /// Cursor-based pagination: pass the `created_at` of the last item.
    pub cursor: Option<DateTime<Utc>>,
    /// Maximum number of results (default 50, max 200).
    pub limit: Option<i64>,
}

/// Request body for creating a notification.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateNotificationRequest {
    /// Target user UUID.
    pub user_id: Uuid,
    /// Notification type.
    #[serde(rename = "type")]
    pub notification_type: String,
    /// Short title.
    pub title: String,
    /// Optional body text.
    pub body: Option<String>,
    /// Source module name.
    pub module: String,
    /// Optional entity type.
    pub entity_type: Option<String>,
    /// Optional entity UUID.
    pub entity_id: Option<Uuid>,
    /// Optional deep-link URL path.
    pub deep_link: Option<String>,
}

/// Response for unread count endpoint.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct UnreadCountResponse {
    /// Number of unread notifications.
    pub count: i64,
}

/// Request body for updating preferences.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdatePreferencesRequest {
    /// Channel toggles (partial update).
    pub channels: Option<Value>,
    /// Quiet hours start time.
    pub quiet_hours_start: Option<NaiveTime>,
    /// Quiet hours end time.
    pub quiet_hours_end: Option<NaiveTime>,
    /// Digest frequency.
    pub digest_frequency: Option<String>,
    /// Muted module list.
    pub muted_modules: Option<Vec<String>>,
}

/// Response wrapping an update count.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct UpdatedCountResponse {
    /// Number of rows affected.
    pub updated: u64,
}

// ── Handlers ────────────────────────────────────────────────────────────────

/// `GET /api/v1/notifications` — list notifications for the authenticated user.
///
/// Supports cursor-based pagination plus optional filters on `type`, `module`,
/// and `unread_only`.
///
/// # Errors
///
/// Returns `Error::Internal` if the database query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/notifications",
    params(ListNotificationsQuery),
    responses(
        (status = 200, description = "Paginated list of notifications", body = Vec<NotificationItem>),
        (status = 401, description = "Not authenticated"),
        (status = 500, description = "Database error"),
    ),
    security(("bearerAuth" = [])),
    tag = "notifications-v1"
)]
#[tracing::instrument(skip_all, fields(user_id))]
pub async fn list_notifications(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ListNotificationsQuery>,
) -> Result<Json<Vec<NotificationItem>>> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));

    let limit = query.limit.unwrap_or(50).min(200);
    let unread_only = query.unread_only.unwrap_or(false);

    // Build the query dynamically based on filters
    let mut sql = String::from(
        "SELECT id, user_id, type, title, body, module, entity_type, entity_id, \
         deep_link, read, read_at, created_at \
         FROM notifications.items WHERE user_id = $1",
    );
    let mut param_idx = 2u32;

    if unread_only {
        sql.push_str(" AND read = false");
    }

    // We'll bind type and module dynamically; track positions
    if query.notification_type.is_some() {
        let idx = param_idx;
        param_idx += 1;
        sql.push_str(&format!(" AND type = ${idx}"));
    }

    if query.module.is_some() {
        let idx = param_idx;
        param_idx += 1;
        sql.push_str(&format!(" AND module = ${idx}"));
    }

    if query.cursor.is_some() {
        let idx = param_idx;
        param_idx += 1;
        sql.push_str(&format!(" AND created_at < ${idx}"));
    }

    sql.push_str(&format!(" ORDER BY created_at DESC LIMIT ${param_idx}"));

    // Use sqlx::query_as with dynamic binding
    let mut q = sqlx::query_as::<_, NotificationItem>(&sql).bind(claims.sub);

    if let Some(ref t) = query.notification_type {
        q = q.bind(t);
    }
    if let Some(ref m) = query.module {
        q = q.bind(m);
    }
    if let Some(cursor) = query.cursor {
        q = q.bind(cursor);
    }
    q = q.bind(limit);

    let items = q
        .fetch_all(&state.pool)
        .await
        .map_err(|e| Error::Internal(format!("list notifications: {e}")))?;

    Ok(Json(items))
}

/// `GET /api/v1/notifications/unread-count` — return unread notification count.
///
/// # Errors
///
/// Returns `Error::Internal` if the database query fails.
///
/// # Panics
///
/// No panics.
#[utoipa::path(
    get,
    path = "/api/v1/notifications/unread-count",
    responses(
        (status = 200, description = "Unread count", body = UnreadCountResponse),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = [])),
    tag = "notifications-v1"
)]
#[tracing::instrument(skip_all, fields(user_id))]
pub async fn unread_count(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<UnreadCountResponse>> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));

    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM notifications.items WHERE user_id = $1 AND read = false",
    )
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| Error::Internal(format!("unread count: {e}")))?;

    Ok(Json(UnreadCountResponse { count }))
}

/// `POST /api/v1/notifications` — create a notification (internal, used by other services).
///
/// # Errors
///
/// Returns `Error::BadRequest` if required fields are missing.
/// Returns `Error::Internal` if the database insert fails.
///
/// # Panics
///
/// No panics.
#[utoipa::path(
    post,
    path = "/api/v1/notifications",
    request_body = CreateNotificationRequest,
    responses(
        (status = 201, description = "Notification created", body = NotificationItem),
        (status = 400, description = "Invalid input"),
        (status = 500, description = "Database error"),
    ),
    security(("bearerAuth" = [])),
    tag = "notifications-v1"
)]
#[tracing::instrument(skip_all, fields(target_user = %body.user_id, module = %body.module))]
pub async fn create_notification(
    State(state): State<AppState>,
    Json(body): Json<CreateNotificationRequest>,
) -> Result<(StatusCode, Json<NotificationItem>)> {
    if body.title.is_empty() {
        return Err(Error::BadRequest("title is required".to_string()));
    }
    if body.module.is_empty() {
        return Err(Error::BadRequest("module is required".to_string()));
    }

    let item = sqlx::query_as::<_, NotificationItem>(
        r#"INSERT INTO notifications.items
            (user_id, type, title, body, module, entity_type, entity_id, deep_link)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, user_id, type, title, body, module, entity_type, entity_id,
                  deep_link, read, read_at, created_at"#,
    )
    .bind(body.user_id)
    .bind(&body.notification_type)
    .bind(&body.title)
    .bind(&body.body)
    .bind(&body.module)
    .bind(&body.entity_type)
    .bind(body.entity_id)
    .bind(&body.deep_link)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| Error::Internal(format!("create notification: {e}")))?;

    tracing::info!(
        notification_id = %item.id,
        user_id = %item.user_id,
        "notification created"
    );

    Ok((StatusCode::CREATED, Json(item)))
}

/// `PUT /api/v1/notifications/:id/read` — mark a specific notification as read.
///
/// Only the owning user can mark their notification as read.
///
/// # Errors
///
/// Returns `Error::NotFound` if the notification does not exist or belongs to another user.
/// Returns `Error::Internal` on database failure.
///
/// # Panics
///
/// No panics.
#[utoipa::path(
    put,
    path = "/api/v1/notifications/{id}/read",
    params(("id" = Uuid, Path, description = "Notification UUID")),
    responses(
        (status = 200, description = "Notification marked as read", body = NotificationItem),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Notification not found"),
    ),
    security(("bearerAuth" = [])),
    tag = "notifications-v1"
)]
#[tracing::instrument(skip_all, fields(user_id, notification_id = %id))]
pub async fn mark_read(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<NotificationItem>> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));

    let item = sqlx::query_as::<_, NotificationItem>(
        r#"UPDATE notifications.items
        SET read = true, read_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING id, user_id, type, title, body, module, entity_type, entity_id,
                  deep_link, read, read_at, created_at"#,
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| Error::Internal(format!("mark read: {e}")))?
    .ok_or_else(|| Error::NotFound("Notification not found".to_string()))?;

    Ok(Json(item))
}

/// `PUT /api/v1/notifications/read-all` — mark all unread notifications as read.
///
/// # Errors
///
/// Returns `Error::Internal` on database failure.
///
/// # Panics
///
/// No panics.
#[utoipa::path(
    put,
    path = "/api/v1/notifications/read-all",
    responses(
        (status = 200, description = "Count of marked notifications", body = UpdatedCountResponse),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = [])),
    tag = "notifications-v1"
)]
#[tracing::instrument(skip_all, fields(user_id))]
pub async fn mark_all_read(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<UpdatedCountResponse>> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));

    let result = sqlx::query(
        "UPDATE notifications.items SET read = true, read_at = NOW() \
         WHERE user_id = $1 AND read = false",
    )
    .bind(claims.sub)
    .execute(&state.pool)
    .await
    .map_err(|e| Error::Internal(format!("mark all read: {e}")))?;

    tracing::info!(
        user_id = %claims.sub,
        updated = result.rows_affected(),
        "marked all notifications as read"
    );

    Ok(Json(UpdatedCountResponse {
        updated: result.rows_affected(),
    }))
}

/// `DELETE /api/v1/notifications/:id` — delete a notification.
///
/// Only the owning user can delete their notification.
///
/// # Errors
///
/// Returns `Error::NotFound` if the notification does not exist or belongs to another user.
/// Returns `Error::Internal` on database failure.
///
/// # Panics
///
/// No panics.
#[utoipa::path(
    delete,
    path = "/api/v1/notifications/{id}",
    params(("id" = Uuid, Path, description = "Notification UUID")),
    responses(
        (status = 204, description = "Notification deleted"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Notification not found"),
    ),
    security(("bearerAuth" = [])),
    tag = "notifications-v1"
)]
#[tracing::instrument(skip_all, fields(user_id, notification_id = %id))]
pub async fn delete_notification(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));

    let result = sqlx::query("DELETE FROM notifications.items WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(&state.pool)
        .await
        .map_err(|e| Error::Internal(format!("delete notification: {e}")))?;

    if result.rows_affected() == 0 {
        return Err(Error::NotFound("Notification not found".to_string()));
    }

    tracing::info!("notification deleted");
    Ok(StatusCode::NO_CONTENT)
}

/// `GET /api/v1/notifications/preferences` — get user notification preferences.
///
/// Creates default preferences if none exist yet (upsert on first access).
///
/// # Errors
///
/// Returns `Error::Internal` on database failure.
///
/// # Panics
///
/// No panics.
#[utoipa::path(
    get,
    path = "/api/v1/notifications/preferences",
    responses(
        (status = 200, description = "User preferences", body = NotificationPreferences),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = [])),
    tag = "notifications-v1"
)]
#[tracing::instrument(skip_all, fields(user_id))]
pub async fn get_preferences(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<NotificationPreferences>> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));

    // Upsert: create default preferences if they don't exist
    let prefs = sqlx::query_as::<_, NotificationPreferences>(
        r#"INSERT INTO notifications.preferences (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
        RETURNING *"#,
    )
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| Error::Internal(format!("get preferences: {e}")))?;

    Ok(Json(prefs))
}

/// `PUT /api/v1/notifications/preferences` — update user notification preferences.
///
/// Accepts partial updates — only provided fields are changed.
///
/// # Errors
///
/// Returns `Error::Internal` on database failure.
///
/// # Panics
///
/// No panics.
#[utoipa::path(
    put,
    path = "/api/v1/notifications/preferences",
    request_body = UpdatePreferencesRequest,
    responses(
        (status = 200, description = "Updated preferences", body = NotificationPreferences),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = [])),
    tag = "notifications-v1"
)]
#[tracing::instrument(skip_all, fields(user_id))]
pub async fn update_preferences(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdatePreferencesRequest>,
) -> Result<Json<NotificationPreferences>> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));

    let prefs = sqlx::query_as::<_, NotificationPreferences>(
        r#"INSERT INTO notifications.preferences (user_id, channels, quiet_hours_start,
               quiet_hours_end, digest_frequency, muted_modules)
        VALUES ($1, COALESCE($2, '{"in_app": true, "email": true, "push": false}'::jsonb),
                $3, $4, COALESCE($5, 'none'), COALESCE($6, '{}'::text[]))
        ON CONFLICT (user_id) DO UPDATE SET
            channels = COALESCE($2, notifications.preferences.channels),
            quiet_hours_start = COALESCE($3, notifications.preferences.quiet_hours_start),
            quiet_hours_end = COALESCE($4, notifications.preferences.quiet_hours_end),
            digest_frequency = COALESCE($5, notifications.preferences.digest_frequency),
            muted_modules = COALESCE($6, notifications.preferences.muted_modules),
            updated_at = NOW()
        RETURNING *"#,
    )
    .bind(claims.sub)
    .bind(&body.channels)
    .bind(body.quiet_hours_start)
    .bind(body.quiet_hours_end)
    .bind(&body.digest_frequency)
    .bind(&body.muted_modules)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| Error::Internal(format!("update preferences: {e}")))?;

    tracing::info!("notification preferences updated");
    Ok(Json(prefs))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }

    #[test]
    fn unread_count_response_serializes() {
        let resp = UnreadCountResponse { count: 42 };
        let json = serde_json::to_value(&resp).expect("serialize");
        assert_eq!(json["count"], 42);
    }

    #[test]
    fn updated_count_response_serializes() {
        let resp = UpdatedCountResponse { updated: 5 };
        let json = serde_json::to_value(&resp).expect("serialize");
        assert_eq!(json["updated"], 5);
    }

    #[test]
    fn create_request_deserializes() {
        let json = serde_json::json!({
            "user_id": "00000000-0000-0000-0000-000000000001",
            "type": "mention",
            "title": "You were mentioned",
            "module": "chat",
            "body": "In #general",
            "deep_link": "/chat/general"
        });
        let req: CreateNotificationRequest = serde_json::from_value(json).expect("deserialize");
        assert_eq!(req.notification_type, "mention");
        assert_eq!(req.module, "chat");
    }

    #[test]
    fn update_prefs_request_deserializes_partial() {
        let json = serde_json::json!({
            "digest_frequency": "daily"
        });
        let req: UpdatePreferencesRequest = serde_json::from_value(json).expect("deserialize");
        assert_eq!(req.digest_frequency.as_deref(), Some("daily"));
        assert!(req.channels.is_none());
        assert!(req.muted_modules.is_none());
    }
}
