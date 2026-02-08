//! Webhook management handlers.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Serialize;
use signapps_common::{Error, Result};
use signapps_db::repositories::GroupRepository;
use uuid::Uuid;
use crate::AppState;

#[derive(Serialize)]
pub struct WebhookResponse {
    pub id: Uuid,
    pub name: String,
    pub url: String,
    pub events: Vec<String>,
    pub enabled: bool,
    pub last_triggered: Option<chrono::DateTime<chrono::Utc>>,
    pub last_status: Option<i32>,
}

#[derive(Serialize)]
pub struct WebhookTestResult {
    pub success: bool,
    pub status_code: Option<i32>,
    pub response_time_ms: i64,
    pub error: Option<String>,
}

/// List all webhooks.
pub async fn list(
    State(state): State<AppState>,
) -> Result<Json<Vec<WebhookResponse>>> {
    let repo = GroupRepository::new(&state.pool);
    let webhooks = repo.list_webhooks().await?;

    let response: Vec<WebhookResponse> = webhooks.into_iter().map(|w| WebhookResponse {
        id: w.id,
        name: w.name,
        url: w.url,
        events: w.events,
        enabled: w.enabled,
        last_triggered: w.last_triggered,
        last_status: w.last_status,
    }).collect();

    Ok(Json(response))
}

/// Create new webhook.
pub async fn create(
    State(state): State<AppState>,
    Json(payload): Json<signapps_db::models::CreateWebhook>,
) -> Result<Json<WebhookResponse>> {
    let repo = GroupRepository::new(&state.pool);
    let webhook = repo.create_webhook(payload).await?;

    Ok(Json(WebhookResponse {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        enabled: webhook.enabled,
        last_triggered: webhook.last_triggered,
        last_status: webhook.last_status,
    }))
}

/// Update webhook.
pub async fn update(
    State(_state): State<AppState>,
    Path(_id): Path<Uuid>,
    Json(_payload): Json<signapps_db::models::CreateWebhook>,
) -> Result<Json<WebhookResponse>> {
    // TODO: Implement webhook update
    Err(Error::Internal("Not implemented".to_string()))
}

/// Delete webhook.
pub async fn delete(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let repo = GroupRepository::new(&state.pool);
    repo.delete_webhook(id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Test webhook.
pub async fn test(
    State(_state): State<AppState>,
    Path(_id): Path<Uuid>,
) -> Result<Json<WebhookTestResult>> {
    // TODO: Send test event to webhook
    // 1. Get webhook by ID
    // 2. Send test payload
    // 3. Measure response time
    // 4. Return result

    Err(Error::Internal("Not implemented".to_string()))
}
