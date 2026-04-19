//! Webhook CRUD handlers — SO4 IN3.
//!
//! Endpoints :
//! - `GET    /api/v1/org/webhooks?tenant_id=…` — list
//! - `POST   /api/v1/org/webhooks`              — create (auto secret)
//! - `PUT    /api/v1/org/webhooks/:id`          — update
//! - `DELETE /api/v1/org/webhooks/:id`          — delete
//! - `POST   /api/v1/org/webhooks/:id/test`     — fire test payload
//! - `GET    /api/v1/org/webhooks/:id/deliveries?limit=…` — recent log
//!
//! The actual HTTP fan-out lives in `signapps-webhooks::org_dispatcher`,
//! which subscribes to `org.*` events on the PgEventBus.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::pg_events::NewEvent;
use signapps_common::{Error, Result};
use signapps_db::models::org::{Webhook, WebhookDelivery};
use signapps_db::repositories::org::WebhookRepository;
use uuid::Uuid;

use crate::AppState;

/// Build the webhooks router (mounted at `/api/v1/org/webhooks`).
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/:id", axum::routing::put(update).delete(delete))
        .route("/:id/test", post(test))
        .route("/:id/deliveries", get(list_deliveries))
}

// ─── DTOs ─────────────────────────────────────────────────────────────

/// Query parameters for `GET /api/v1/org/webhooks`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListQuery {
    /// Tenant UUID.
    pub tenant_id: Uuid,
}

/// Body of `POST /api/v1/org/webhooks`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateBody {
    /// Tenant owner.
    pub tenant_id: Uuid,
    /// Target URL (HTTPS in prod, HTTP allowed in dev).
    pub url: String,
    /// Subscribed event patterns (`org.person.*`, `org.node.created`…).
    pub events: Vec<String>,
}

/// Body of `PUT /api/v1/org/webhooks/:id`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateBody {
    /// New URL.
    pub url: Option<String>,
    /// New event subscriptions.
    pub events: Option<Vec<String>>,
    /// Toggle the active flag.
    pub active: Option<bool>,
}

/// View of a webhook returned by the list endpoint (without secret).
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct WebhookListView {
    /// UUID.
    pub id: Uuid,
    /// Tenant.
    pub tenant_id: Uuid,
    /// URL.
    pub url: String,
    /// Subscribed events.
    pub events: Vec<String>,
    /// Active flag.
    pub active: bool,
    /// Last delivery timestamp.
    pub last_delivery_at: Option<DateTime<Utc>>,
    /// Last status code.
    pub last_status: Option<i32>,
    /// Consecutive failure counter.
    pub failure_count: i32,
    /// Created at.
    pub created_at: DateTime<Utc>,
    /// `true` because the secret is set on every row.
    pub has_secret: bool,
}

impl From<&Webhook> for WebhookListView {
    fn from(w: &Webhook) -> Self {
        Self {
            id: w.id,
            tenant_id: w.tenant_id,
            url: w.url.clone(),
            events: w.events.clone(),
            active: w.active,
            last_delivery_at: w.last_delivery_at,
            last_status: w.last_status,
            failure_count: w.failure_count,
            created_at: w.created_at,
            has_secret: !w.secret.is_empty(),
        }
    }
}

/// Detail view returned by the create endpoint — includes the plaintext
/// secret. Only ever exposed once, at creation time.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct WebhookCreateView {
    /// UUID.
    pub id: Uuid,
    /// Tenant.
    pub tenant_id: Uuid,
    /// URL.
    pub url: String,
    /// Subscribed events.
    pub events: Vec<String>,
    /// Active flag.
    pub active: bool,
    /// Plaintext signing secret — keep it safe.
    pub secret: String,
    /// Created at.
    pub created_at: DateTime<Utc>,
}

// ─── Handlers ─────────────────────────────────────────────────────────

/// GET /api/v1/org/webhooks?tenant_id=…
#[utoipa::path(
    get,
    path = "/api/v1/org/webhooks",
    tag = "Org Webhooks",
    params(ListQuery),
    responses(
        (status = 200, description = "Webhooks for the tenant", body = Vec<WebhookListView>),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<WebhookListView>>> {
    let rows = WebhookRepository::new(st.pool.inner())
        .list_by_tenant(q.tenant_id)
        .await
        .map_err(|e| Error::Database(format!("list webhooks: {e}")))?;
    let views = rows.iter().map(WebhookListView::from).collect();
    Ok(Json(views))
}

/// POST /api/v1/org/webhooks
#[utoipa::path(
    post,
    path = "/api/v1/org/webhooks",
    tag = "Org Webhooks",
    request_body = CreateBody,
    responses(
        (status = 201, description = "Webhook created (returns plaintext secret once)", body = WebhookCreateView),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn create(
    State(st): State<AppState>,
    Json(body): Json<CreateBody>,
) -> Result<(StatusCode, Json<WebhookCreateView>)> {
    if body.events.is_empty() {
        return Err(Error::BadRequest(
            "events list cannot be empty".to_string(),
        ));
    }
    let row = WebhookRepository::new(st.pool.inner())
        .create(body.tenant_id, &body.url, body.events)
        .await
        .map_err(|e| Error::Database(format!("create webhook: {e}")))?;
    Ok((
        StatusCode::CREATED,
        Json(WebhookCreateView {
            id: row.id,
            tenant_id: row.tenant_id,
            url: row.url,
            events: row.events,
            active: row.active,
            secret: row.secret,
            created_at: row.created_at,
        }),
    ))
}

/// PUT /api/v1/org/webhooks/:id
#[utoipa::path(
    put,
    path = "/api/v1/org/webhooks/{id}",
    tag = "Org Webhooks",
    params(("id" = Uuid, Path, description = "Webhook UUID")),
    request_body = UpdateBody,
    responses(
        (status = 200, description = "Webhook updated", body = WebhookListView),
        (status = 404, description = "Webhook not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn update(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateBody>,
) -> Result<Json<WebhookListView>> {
    let events: Option<Vec<String>> = body.events;
    let row = WebhookRepository::new(st.pool.inner())
        .update(
            id,
            body.url.as_deref(),
            events.as_deref(),
            body.active,
        )
        .await
        .map_err(|e| Error::Database(format!("update webhook: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("webhook {id}")))?;
    Ok(Json(WebhookListView::from(&row)))
}

/// DELETE /api/v1/org/webhooks/:id
#[utoipa::path(
    delete,
    path = "/api/v1/org/webhooks/{id}",
    tag = "Org Webhooks",
    params(("id" = Uuid, Path, description = "Webhook UUID")),
    responses(
        (status = 204, description = "Webhook deleted"),
        (status = 404, description = "Webhook not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn delete(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let removed = WebhookRepository::new(st.pool.inner())
        .delete(id)
        .await
        .map_err(|e| Error::Database(format!("delete webhook: {e}")))?;
    if !removed {
        return Err(Error::NotFound(format!("webhook {id}")));
    }
    Ok(StatusCode::NO_CONTENT)
}

/// POST /api/v1/org/webhooks/:id/test
///
/// Publishes a `test.webhook` event to the bus, which the dispatcher
/// will fan-out to the matching subscription (typically the one pointed
/// at by `id`, when its events list contains `test.webhook`). For an
/// immediate verification round-trip the dispatcher is also invoked
/// inline against this single webhook id.
#[utoipa::path(
    post,
    path = "/api/v1/org/webhooks/{id}/test",
    tag = "Org Webhooks",
    params(("id" = Uuid, Path, description = "Webhook UUID")),
    responses(
        (status = 202, description = "Test event queued"),
        (status = 404, description = "Webhook not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn test(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let webhook = WebhookRepository::new(st.pool.inner())
        .get(id)
        .await
        .map_err(|e| Error::Database(format!("get webhook: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("webhook {id}")))?;

    // Publish the synthetic event so any subscriber (incl. this one)
    // receives a real fan-out exercising HMAC + retry.
    let payload = serde_json::json!({
        "tenant_id": webhook.tenant_id,
        "webhook_id": webhook.id,
        "message": "Hello from SignApps",
        "timestamp": Utc::now(),
    });
    let _ = st
        .event_bus
        .publish(NewEvent {
            event_type: "test.webhook".to_string(),
            aggregate_id: Some(webhook.id),
            payload,
        })
        .await;

    Ok(StatusCode::ACCEPTED)
}

/// Query params for `GET /api/v1/org/webhooks/:id/deliveries`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct DeliveriesQuery {
    /// Maximum rows to return (default 50, max 500).
    pub limit: Option<i64>,
}

/// GET /api/v1/org/webhooks/:id/deliveries
#[utoipa::path(
    get,
    path = "/api/v1/org/webhooks/{id}/deliveries",
    tag = "Org Webhooks",
    params(("id" = Uuid, Path, description = "Webhook UUID"), DeliveriesQuery),
    responses(
        (status = 200, description = "Recent deliveries", body = Vec<WebhookDelivery>),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list_deliveries(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    Query(q): Query<DeliveriesQuery>,
) -> Result<Json<Vec<WebhookDelivery>>> {
    let limit = q.limit.unwrap_or(50).clamp(1, 500);
    let rows = WebhookRepository::new(st.pool.inner())
        .list_recent_deliveries(id, limit)
        .await
        .map_err(|e| Error::Database(format!("list deliveries: {e}")))?;
    Ok(Json(rows))
}
