//! WH1: Webhook event dispatcher
//!
//! Background task that listens on the platform event bus and forwards
//! matching events to registered, active webhooks via HTTP POST.
//!
//! - SSRF protection: private/internal URLs are rejected before any HTTP call.
//! - Each webhook filters by its `events` list; wildcards ("*") are supported.
//! - `last_triggered` and `last_status` are updated after every dispatch attempt.

use signapps_common::pg_events::{PgEventBus, PlatformEvent};
use std::net::IpAddr;
use std::time::Instant;
use uuid::Uuid;

// ── SSRF guard (mirrors handlers/webhooks.rs) ─────────────────────────────────

fn is_private_url(url: &str) -> bool {
    if let Ok(parsed) = url::Url::parse(url) {
        if let Some(host) = parsed.host_str() {
            if host == "localhost" || host == "127.0.0.1" || host == "::1" || host == "[::1]" {
                return true;
            }
            if host == "169.254.169.254" || host == "metadata.google.internal" {
                return true;
            }
            if let Ok(ip) = host.parse::<IpAddr>() {
                return match ip {
                    IpAddr::V4(v4) => v4.is_private() || v4.is_loopback() || v4.is_link_local(),
                    IpAddr::V6(v6) => v6.is_loopback(),
                };
            }
            if host.starts_with("signapps-")
                || host.ends_with(".internal")
                || host.ends_with(".local")
            {
                return true;
            }
            return false;
        }
    }
    true
}

// ── Webhook row (minimal projection) ─────────────────────────────────────────

#[derive(sqlx::FromRow, Debug)]
struct ActiveWebhook {
    id: Uuid,
    url: String,
    secret: Option<String>,
    events: Vec<String>,
    headers: serde_json::Value,
}

// ── Dispatcher payload ────────────────────────────────────────────────────────

#[derive(serde::Serialize)]
struct DispatchPayload<'a> {
    event: &'a str,
    timestamp: chrono::DateTime<chrono::Utc>,
    data: &'a serde_json::Value,
}

// ── Main entry point ──────────────────────────────────────────────────────────

/// Runs indefinitely — should be called via `tokio::spawn`.
pub async fn run(pool: signapps_db::DatabasePool) {
    let pg_pool = pool.inner().clone();
    let bus = PgEventBus::new(pg_pool.clone(), "signapps-identity".to_string());

    let http_client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("webhook-dispatcher: failed to build HTTP client: {}", e);
            return;
        },
    };

    tracing::info!("webhook-dispatcher: starting");

    let result = bus
        .listen("webhook-dispatcher", move |event: PlatformEvent| {
            let pool_ref = pg_pool.clone();
            let client_ref = http_client.clone();
            Box::pin(async move { dispatch_event(pool_ref, client_ref, event).await })
        })
        .await;

    if let Err(e) = result {
        tracing::error!("webhook-dispatcher: listener exited with error: {}", e);
    }
}

// ── Concrete error type for the event handler ─────────────────────────────────

#[derive(Debug)]
struct DispatchError(String);

impl std::fmt::Display for DispatchError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "dispatch error: {}", self.0)
    }
}

impl std::error::Error for DispatchError {}

impl From<sqlx::Error> for DispatchError {
    fn from(e: sqlx::Error) -> Self {
        DispatchError(e.to_string())
    }
}

// ── Per-event dispatch logic ──────────────────────────────────────────────────

async fn dispatch_event(
    pg_pool: sqlx::PgPool,
    client: reqwest::Client,
    event: PlatformEvent,
) -> Result<(), DispatchError> {
    // Query all enabled webhooks
    let webhooks: Vec<ActiveWebhook> = sqlx::query_as(
        r#"
        SELECT id, url, secret, events, headers
        FROM identity.webhooks
        WHERE enabled = true
        "#,
    )
    .fetch_all(&pg_pool)
    .await?;

    for webhook in webhooks {
        // Filter by event type: webhook fires if its `events` list contains
        // the event type OR contains the wildcard "*".
        let should_fire = webhook
            .events
            .iter()
            .any(|e| e == "*" || e == &event.event_type);
        if !should_fire {
            continue;
        }

        // SSRF protection
        if is_private_url(&webhook.url) {
            tracing::warn!(
                webhook_id = %webhook.id,
                url = %webhook.url,
                "webhook-dispatcher: skipping private/internal URL"
            );
            continue;
        }

        fire_webhook(&pg_pool, &client, &webhook, &event).await;
    }

    Ok(())
}

async fn fire_webhook(
    pg_pool: &sqlx::PgPool,
    client: &reqwest::Client,
    webhook: &ActiveWebhook,
    event: &PlatformEvent,
) {
    let payload = DispatchPayload {
        event: &event.event_type,
        timestamp: event.created_at,
        data: &event.payload,
    };

    let payload_str = match serde_json::to_string(&payload) {
        Ok(s) => s,
        Err(e) => {
            tracing::error!(webhook_id = %webhook.id, error = %e, "failed to serialize payload");
            return;
        },
    };

    // Build request
    let mut req = client
        .post(&webhook.url)
        .header("Content-Type", "application/json")
        .header("User-Agent", "SignApps-Webhook/1.0")
        .header("X-SignApps-Event", &event.event_type);

    // Custom headers
    if let Some(obj) = webhook.headers.as_object() {
        for (key, value) in obj {
            if let Some(v) = value.as_str() {
                req = req.header(key.as_str(), v);
            }
        }
    }

    // HMAC signature if secret is set
    if let Some(ref secret) = webhook.secret {
        use hmac::{Hmac, Mac};
        use sha2::Sha256;
        type HmacSha256 = Hmac<Sha256>;
        if let Ok(mut mac) = HmacSha256::new_from_slice(secret.as_bytes()) {
            mac.update(payload_str.as_bytes());
            let sig = format!(
                "sha256={}",
                mac.finalize()
                    .into_bytes()
                    .iter()
                    .map(|b| format!("{:02x}", b))
                    .collect::<String>()
            );
            req = req.header("X-Webhook-Signature", sig);
        }
    }

    let start = Instant::now();
    let result = req.body(payload_str).send().await;
    let elapsed = start.elapsed().as_millis();

    match result {
        Ok(resp) => {
            let status = resp.status().as_u16() as i32;
            let success = resp.status().is_success();
            tracing::info!(
                webhook_id = %webhook.id,
                event_type = %event.event_type,
                status_code = status,
                elapsed_ms = elapsed,
                success = success,
                "webhook-dispatcher: dispatched"
            );
            let _ = update_webhook_status(pg_pool, webhook.id, status).await;
        },
        Err(e) => {
            tracing::warn!(
                webhook_id = %webhook.id,
                event_type = %event.event_type,
                error = %e,
                elapsed_ms = elapsed,
                "webhook-dispatcher: delivery failed"
            );
            let _ = update_webhook_status(pg_pool, webhook.id, 0).await;
        },
    }
}

async fn update_webhook_status(
    pg_pool: &sqlx::PgPool,
    webhook_id: Uuid,
    status_code: i32,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE identity.webhooks
        SET last_triggered = NOW(), last_status = $2, updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(webhook_id)
    .bind(status_code)
    .execute(pg_pool)
    .await?;
    Ok(())
}
