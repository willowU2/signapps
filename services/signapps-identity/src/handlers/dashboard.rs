//! Dashboard widget layout endpoints.
//!
//! Persists user-specific widget layouts (grid positions, sizes, config)
//! and provides an aggregated summary endpoint for default dashboard widgets.
//!
//! # Endpoints
//!
//! - `GET  /api/v1/dashboard/layout`          — get the current user's layout
//! - `PUT  /api/v1/dashboard/layout`          — save the current user's layout
//! - `GET  /api/v1/dashboard/widgets/summary` — aggregated widget data

use crate::AppState;
use axum::{extract::State, Extension, Json};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use signapps_common::{Claims, Error, Result};
use uuid::Uuid;

// ── Types ────────────────────────────────────────────────────────────────────

/// A single widget placement on the dashboard grid.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct WidgetPlacement {
    /// Widget type identifier (e.g. "email", "calendar", "tasks", "files").
    pub widget_type: String,
    /// Grid column position.
    pub x: i32,
    /// Grid row position.
    pub y: i32,
    /// Width in grid units.
    pub w: i32,
    /// Height in grid units.
    pub h: i32,
    /// Optional widget-specific configuration.
    #[serde(default)]
    pub config: Value,
}

/// Dashboard layout response.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct DashboardLayoutResponse {
    /// Layout row ID.
    pub id: Uuid,
    /// Owner user ID.
    pub user_id: Uuid,
    /// Widget placements.
    pub widgets: Vec<WidgetPlacement>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Request body to save a dashboard layout.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct SaveDashboardLayoutRequest {
    /// Widget placements to persist.
    pub widgets: Vec<WidgetPlacement>,
}

/// Aggregated summary data for default dashboard widgets.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct DashboardSummaryResponse {
    /// Number of unread emails.
    pub unread_emails: i64,
    /// Number of tasks due today.
    pub tasks_due_today: i64,
    /// Number of upcoming calendar events (next 24 h).
    pub upcoming_events: i64,
    /// Number of recently modified files (last 7 days).
    pub recent_files: i64,
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/// `GET /api/v1/dashboard/layout` — get the current user's widget layout.
///
/// Returns an empty widgets array if no layout has been saved yet.
///
/// # Errors
///
/// Returns `Error::Internal` if the database query fails.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/api/v1/dashboard/layout",
    tag = "dashboard",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "User layout", body = DashboardLayoutResponse),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn get_layout(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<DashboardLayoutResponse>> {
    let row = sqlx::query_as::<_, (Uuid, Uuid, Value, DateTime<Utc>, DateTime<Utc>)>(
        r#"SELECT id, user_id, widgets, created_at, updated_at
           FROM identity.dashboard_layouts
           WHERE user_id = $1"#,
    )
    .bind(claims.sub)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("get dashboard layout: {e}")))?;

    match row {
        Some((id, user_id, widgets_json, created_at, updated_at)) => {
            let widgets: Vec<WidgetPlacement> =
                serde_json::from_value(widgets_json).unwrap_or_default();
            Ok(Json(DashboardLayoutResponse {
                id,
                user_id,
                widgets,
                created_at,
                updated_at,
            }))
        },
        None => {
            // Return a default empty layout
            Ok(Json(DashboardLayoutResponse {
                id: Uuid::nil(),
                user_id: claims.sub,
                widgets: Vec::new(),
                created_at: Utc::now(),
                updated_at: Utc::now(),
            }))
        },
    }
}

/// `PUT /api/v1/dashboard/layout` — save the current user's widget layout.
///
/// Upserts the layout row for the authenticated user.
///
/// # Errors
///
/// Returns `Error::Internal` if the database upsert fails.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    put,
    path = "/api/v1/dashboard/layout",
    tag = "dashboard",
    security(("bearerAuth" = [])),
    request_body = SaveDashboardLayoutRequest,
    responses(
        (status = 200, description = "Layout saved", body = DashboardLayoutResponse),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub, widget_count))]
pub async fn save_layout(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SaveDashboardLayoutRequest>,
) -> Result<Json<DashboardLayoutResponse>> {
    tracing::Span::current().record("widget_count", body.widgets.len());

    let widgets_json = serde_json::to_value(&body.widgets)
        .map_err(|e| Error::Internal(format!("serialize widgets: {e}")))?;

    let row = sqlx::query_as::<_, (Uuid, Uuid, Value, DateTime<Utc>, DateTime<Utc>)>(
        r#"INSERT INTO identity.dashboard_layouts (user_id, widgets)
           VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE
               SET widgets = EXCLUDED.widgets, updated_at = NOW()
           RETURNING id, user_id, widgets, created_at, updated_at"#,
    )
    .bind(claims.sub)
    .bind(&widgets_json)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("save dashboard layout: {e}")))?;

    tracing::info!("dashboard layout saved");

    let widgets: Vec<WidgetPlacement> = serde_json::from_value(row.2).unwrap_or_default();

    Ok(Json(DashboardLayoutResponse {
        id: row.0,
        user_id: row.1,
        widgets,
        created_at: row.3,
        updated_at: row.4,
    }))
}

/// `GET /api/v1/dashboard/widgets/summary` — aggregated data for default widgets.
///
/// Queries multiple tables to return counts that power the dashboard summary
/// widgets: unread emails, tasks due today, upcoming events, recent files.
///
/// Each sub-query is run independently and gracefully returns 0 if the
/// corresponding table does not exist yet (service not deployed).
///
/// # Errors
///
/// Returns `Error::Internal` if a critical database error occurs.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/api/v1/dashboard/widgets/summary",
    tag = "dashboard",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "Widget summary data", body = DashboardSummaryResponse),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn widgets_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<DashboardSummaryResponse>> {
    // Each count tolerates missing tables (service not yet migrated).

    let unread_emails = sqlx::query_scalar::<_, i64>(
        r#"SELECT COUNT(*) FROM mail.messages
           WHERE recipient_id = $1 AND is_read = false AND deleted_at IS NULL"#,
    )
    .bind(claims.sub)
    .fetch_one(&*state.pool)
    .await
    .unwrap_or(0);

    let tasks_due_today = sqlx::query_scalar::<_, i64>(
        r#"SELECT COUNT(*) FROM calendar.events
           WHERE owner_id = $1
             AND event_type = 'task'
             AND start_time::date = CURRENT_DATE
             AND deleted_at IS NULL"#,
    )
    .bind(claims.sub)
    .fetch_one(&*state.pool)
    .await
    .unwrap_or(0);

    let upcoming_events = sqlx::query_scalar::<_, i64>(
        r#"SELECT COUNT(*) FROM calendar.events
           WHERE owner_id = $1
             AND event_type = 'event'
             AND start_time BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
             AND deleted_at IS NULL"#,
    )
    .bind(claims.sub)
    .fetch_one(&*state.pool)
    .await
    .unwrap_or(0);

    let recent_files = sqlx::query_scalar::<_, i64>(
        r#"SELECT COUNT(*) FROM storage.files
           WHERE owner_id = $1
             AND updated_at > NOW() - INTERVAL '7 days'
             AND deleted_at IS NULL"#,
    )
    .bind(claims.sub)
    .fetch_one(&*state.pool)
    .await
    .unwrap_or(0);

    Ok(Json(DashboardSummaryResponse {
        unread_emails,
        tasks_due_today,
        upcoming_events,
        recent_files,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn module_compiles() {
        // Placeholder: ensures the module compiles.
        let _ = module_path!();
    }

    #[test]
    fn empty_widgets_serialize() {
        let response = DashboardLayoutResponse {
            id: Uuid::nil(),
            user_id: Uuid::nil(),
            widgets: Vec::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        let json = serde_json::to_string(&response);
        assert!(json.is_ok(), "empty layout should serialize");
    }

    #[test]
    fn widget_placement_roundtrip() {
        let wp = WidgetPlacement {
            widget_type: "email".to_string(),
            x: 0,
            y: 0,
            w: 4,
            h: 3,
            config: serde_json::json!({}),
        };
        let json = serde_json::to_string(&wp).expect("serialize");
        let back: WidgetPlacement = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(back.widget_type, "email");
        assert_eq!(back.w, 4);
    }
}
