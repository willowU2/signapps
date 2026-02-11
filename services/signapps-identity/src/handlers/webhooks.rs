//! Webhook management handlers.

use crate::AppState;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use signapps_db::repositories::GroupRepository;
use std::time::Instant;
use uuid::Uuid;

/// Webhook configuration response.
#[derive(Debug, Clone, Serialize)]
pub struct WebhookResponse {
    pub id: Uuid,
    pub name: String,
    pub url: String,
    pub events: Vec<String>,
    pub enabled: bool,
    pub secret: Option<String>,
    pub headers: serde_json::Value,
    pub last_triggered: Option<chrono::DateTime<chrono::Utc>>,
    pub last_status: Option<i32>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// Request to create a new webhook.
#[derive(Debug, Deserialize)]
pub struct CreateWebhookRequest {
    pub name: String,
    pub url: String,
    pub events: Vec<String>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    pub secret: Option<String>,
    pub headers: Option<serde_json::Value>,
}

fn default_enabled() -> bool {
    true
}

/// Request to update an existing webhook.
#[derive(Debug, Deserialize)]
pub struct UpdateWebhookRequest {
    pub name: Option<String>,
    pub url: Option<String>,
    pub events: Option<Vec<String>>,
    pub enabled: Option<bool>,
    pub secret: Option<String>,
    pub headers: Option<serde_json::Value>,
}

/// Result of a webhook test.
#[derive(Debug, Serialize)]
pub struct WebhookTestResult {
    pub success: bool,
    pub status_code: Option<i32>,
    pub response_time_ms: i64,
    pub response_body: Option<String>,
    pub error: Option<String>,
}

/// Test payload sent to webhook.
#[derive(Debug, Serialize)]
struct WebhookTestPayload {
    pub event: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub data: serde_json::Value,
}

/// List all webhooks.
#[tracing::instrument(skip(state))]
pub async fn list(State(state): State<AppState>) -> Result<Json<Vec<WebhookResponse>>> {
    let repo = GroupRepository::new(&state.pool);
    let webhooks = repo.list_webhooks().await?;

    let response: Vec<WebhookResponse> = webhooks
        .into_iter()
        .map(|w| WebhookResponse {
            id: w.id,
            name: w.name,
            url: w.url,
            events: w.events,
            enabled: w.enabled,
            secret: w.secret,
            headers: w.headers,
            last_triggered: w.last_triggered,
            last_status: w.last_status,
            created_at: w.created_at,
            updated_at: w.updated_at,
        })
        .collect();

    Ok(Json(response))
}

/// Get a single webhook by ID.
#[tracing::instrument(skip(state))]
pub async fn get(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<WebhookResponse>> {
    let repo = GroupRepository::new(&state.pool);
    let webhook = repo
        .find_webhook(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Webhook {}", id)))?;

    Ok(Json(WebhookResponse {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        enabled: webhook.enabled,
        secret: webhook.secret,
        headers: webhook.headers,
        last_triggered: webhook.last_triggered,
        last_status: webhook.last_status,
        created_at: webhook.created_at,
        updated_at: webhook.updated_at,
    }))
}

/// Create new webhook.
#[tracing::instrument(skip(state))]
pub async fn create(
    State(state): State<AppState>,
    Json(payload): Json<CreateWebhookRequest>,
) -> Result<Json<WebhookResponse>> {
    // Validate URL
    if !payload.url.starts_with("http://") && !payload.url.starts_with("https://") {
        return Err(Error::Validation(
            "Webhook URL must start with http:// or https://".to_string(),
        ));
    }

    // Validate events are not empty
    if payload.events.is_empty() {
        return Err(Error::Validation(
            "At least one event must be specified".to_string(),
        ));
    }

    let repo = GroupRepository::new(&state.pool);
    let create_payload = signapps_db::models::CreateWebhook {
        name: payload.name,
        url: payload.url,
        events: payload.events,
        enabled: payload.enabled,
        secret: payload.secret,
        headers: payload.headers,
    };
    let webhook = repo.create_webhook(create_payload).await?;

    tracing::info!(webhook_id = %webhook.id, "Webhook created");

    Ok(Json(WebhookResponse {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        enabled: webhook.enabled,
        secret: webhook.secret,
        headers: webhook.headers,
        last_triggered: webhook.last_triggered,
        last_status: webhook.last_status,
        created_at: webhook.created_at,
        updated_at: webhook.updated_at,
    }))
}

/// Update webhook.
#[tracing::instrument(skip(state))]
pub async fn update(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateWebhookRequest>,
) -> Result<Json<WebhookResponse>> {
    let repo = GroupRepository::new(&state.pool);

    // Find existing webhook
    let existing = repo
        .find_webhook(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Webhook {}", id)))?;

    // Validate URL if provided
    if let Some(ref url) = payload.url {
        if !url.starts_with("http://") && !url.starts_with("https://") {
            return Err(Error::Validation(
                "Webhook URL must start with http:// or https://".to_string(),
            ));
        }
    }

    // Validate events if provided
    if let Some(ref events) = payload.events {
        if events.is_empty() {
            return Err(Error::Validation(
                "At least one event must be specified".to_string(),
            ));
        }
    }

    // Update webhook
    let headers_to_use = payload.headers.as_ref().unwrap_or(&existing.headers);
    let webhook = repo
        .update_webhook(
            id,
            payload.name.as_deref().unwrap_or(&existing.name),
            payload.url.as_deref().unwrap_or(&existing.url),
            payload.events.as_ref().unwrap_or(&existing.events),
            payload.enabled.unwrap_or(existing.enabled),
            payload.secret.as_ref().or(existing.secret.as_ref()),
            Some(headers_to_use),
        )
        .await?;

    tracing::info!(webhook_id = %id, "Webhook updated");

    Ok(Json(WebhookResponse {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        enabled: webhook.enabled,
        secret: webhook.secret,
        headers: webhook.headers,
        last_triggered: webhook.last_triggered,
        last_status: webhook.last_status,
        created_at: webhook.created_at,
        updated_at: webhook.updated_at,
    }))
}

/// Delete webhook.
#[tracing::instrument(skip(state))]
pub async fn delete(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<StatusCode> {
    let repo = GroupRepository::new(&state.pool);

    // Verify webhook exists
    let _ = repo
        .find_webhook(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Webhook {}", id)))?;

    repo.delete_webhook(id).await?;

    tracing::info!(webhook_id = %id, "Webhook deleted");

    Ok(StatusCode::NO_CONTENT)
}

/// Test webhook by sending a test event.
#[tracing::instrument(skip(state))]
pub async fn test(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<WebhookTestResult>> {
    let repo = GroupRepository::new(&state.pool);

    // Get webhook
    let webhook = repo
        .find_webhook(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Webhook {}", id)))?;

    // Build test payload
    let test_payload = WebhookTestPayload {
        event: "test".to_string(),
        timestamp: chrono::Utc::now(),
        data: serde_json::json!({
            "webhook_id": id,
            "message": "This is a test event from SignApps Identity Service"
        }),
    };

    // Build HTTP client
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| Error::Internal(format!("Failed to create HTTP client: {}", e)))?;

    // Build request
    let mut request = client
        .post(&webhook.url)
        .header("Content-Type", "application/json")
        .header("User-Agent", "SignApps-Webhook/1.0");

    // Add custom headers if present
    if let Some(obj) = webhook.headers.as_object() {
        for (key, value) in obj {
            if let Some(v) = value.as_str() {
                request = request.header(key.as_str(), v);
            }
        }
    }

    // Add signature if secret is present
    if let Some(ref secret) = webhook.secret {
        let payload_str = serde_json::to_string(&test_payload)
            .map_err(|e| Error::Internal(format!("Failed to serialize payload: {}", e)))?;

        // Simple HMAC-like signature (in production, use proper HMAC-SHA256)
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        secret.hash(&mut hasher);
        payload_str.hash(&mut hasher);
        let signature = format!("sha256={:x}", hasher.finish());

        request = request.header("X-Webhook-Signature", signature);
    }

    // Send request and measure time
    let start = Instant::now();
    let result = request.json(&test_payload).send().await;
    let elapsed = start.elapsed().as_millis() as i64;

    match result {
        Ok(response) => {
            let status = response.status().as_u16() as i32;
            let success = response.status().is_success();
            let body = response.text().await.ok();

            // Update last triggered and status
            let _ = repo.update_webhook_status(id, status).await;

            tracing::info!(
                webhook_id = %id,
                status_code = status,
                response_time_ms = elapsed,
                success = success,
                "Webhook test completed"
            );

            Ok(Json(WebhookTestResult {
                success,
                status_code: Some(status),
                response_time_ms: elapsed,
                response_body: body,
                error: None,
            }))
        },
        Err(e) => {
            tracing::warn!(
                webhook_id = %id,
                error = %e,
                "Webhook test failed"
            );

            Ok(Json(WebhookTestResult {
                success: false,
                status_code: None,
                response_time_ms: elapsed,
                response_body: None,
                error: Some(e.to_string()),
            }))
        },
    }
}
