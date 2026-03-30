//! Generic incoming webhook receiver — EX4
//!
//! Route: POST /api/v1/webhooks/incoming/:source
//!
//! Allows n8n, Zapier, Make.com and any external tool to trigger SignApps
//! platform events by POSTing a JSON payload to this endpoint.
//!
//! The `:source` path parameter is used to determine which platform event type
//! to publish. Example mappings:
//!   zapier           → platform.webhook.zapier
//!   n8n              → platform.webhook.n8n
//!   github           → platform.webhook.github
//!   stripe           → platform.webhook.stripe
//!   (any other)      → platform.webhook.<source>

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::AppState;

// ── Request / Response types ──────────────────────────────────────────────────

/// Acknowledgement response sent back to the caller.
#[derive(Debug, Serialize)]
pub struct WebhookAck {
    pub status: &'static str,
    pub event_type: String,
    pub source: String,
}

/// Sanitize the source name to prevent log injection or unexpected characters.
fn sanitize_source(source: &str) -> String {
    source
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .take(64)
        .collect::<String>()
        .to_lowercase()
}

/// Map a source name + optional `event` field in the payload to a platform event type.
fn resolve_event_type(source: &str, payload: &Value) -> String {
    // Allow the payload to override the event type via a top-level `event` or `event_type` field
    if let Some(event) = payload.get("event").or_else(|| payload.get("event_type")) {
        if let Some(s) = event.as_str() {
            let clean: String = s
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '_' || *c == '-')
                .take(128)
                .collect();
            if !clean.is_empty() {
                return clean;
            }
        }
    }

    // Fallback: derive from source name
    format!("platform.webhook.{source}")
}

// ── Handler ───────────────────────────────────────────────────────────────────

/// Receive an external webhook payload and publish it to the platform event bus.
///
/// This handler is intentionally permissive about payload shape — it accepts
/// any valid JSON object. The caller is responsible for structuring meaningful data.
///
/// Security: this endpoint requires authentication (protected_routes middleware).
/// For unauthenticated public webhooks (e.g. Stripe), a separate signed endpoint
/// is provided in the billing service.
#[tracing::instrument(skip_all)]
pub async fn receive_incoming_webhook(
    State(_state): State<AppState>,
    Path(source): Path<String>,
    payload: Option<Json<Value>>,
) -> Result<Json<WebhookAck>, (StatusCode, Json<serde_json::Value>)> {
    let source = sanitize_source(&source);

    if source.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Invalid source name" })),
        ));
    }

    let body = payload.map(|Json(v)| v).unwrap_or(Value::Object(Default::default()));

    let event_type = resolve_event_type(&source, &body);

    tracing::info!(
        source = %source,
        event_type = %event_type,
        "Incoming webhook received"
    );

    // In a full implementation, publish to PgEventBus here:
    // state.event_bus.publish(NewEvent { event_type: event_type.clone(), aggregate_id: None, payload: body }).await;
    //
    // For now, just log and ack — the event bus requires AppState to carry it,
    // which will be wired up when the identity service adds event_bus to its AppState.

    Ok(Json(WebhookAck {
        status: "received",
        event_type,
        source,
    }))
}

// ── Public (unauthenticated) variant ─────────────────────────────────────────

/// Unauthenticated webhook receiver for trusted external services.
///
/// This endpoint does NOT require a JWT. It should only be exposed for sources
/// that provide their own signature verification (e.g. Stripe HMAC-SHA256).
///
/// NOTE: Per-source HMAC signature verification (e.g. Stripe webhook signing secrets) must be
/// added before this endpoint is enabled in production — tracked in backlog.
#[tracing::instrument(skip_all)]
pub async fn receive_public_webhook(
    State(_state): State<AppState>,
    Path(source): Path<String>,
    headers: axum::http::HeaderMap,
    payload: Option<Json<Value>>,
) -> Result<Json<WebhookAck>, (StatusCode, Json<serde_json::Value>)> {
    let source = sanitize_source(&source);

    if source.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Invalid source name" })),
        ));
    }

    let body = payload.map(|Json(v)| v).unwrap_or(Value::Object(Default::default()));
    let event_type = resolve_event_type(&source, &body);

    // Log signature header if present (for future verification)
    let signature = headers
        .get("x-hub-signature-256")
        .or_else(|| headers.get("stripe-signature"))
        .or_else(|| headers.get("x-webhook-signature"))
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    tracing::info!(
        source = %source,
        event_type = %event_type,
        signature = ?signature,
        "Public incoming webhook received"
    );

    Ok(Json(WebhookAck {
        status: "received",
        event_type,
        source,
    }))
}
