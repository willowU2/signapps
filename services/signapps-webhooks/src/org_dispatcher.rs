//! Org-events fan-out dispatcher — SO4 IN3.
//!
//! Subscribes to the `platform.events` PgEventBus stream, filters
//! events whose type starts with `org.` (or is the synthetic
//! `test.webhook`), looks up matching active webhooks via
//! [`WebhookRepository::list_active_subscribed_to`] and dispatches
//! HMAC-SHA256-signed POSTs.
//!
//! Retry strategy : exponential backoff at 30 s, 2 min, 10 min.
//! After [`MAX_CONSECUTIVE_FAILURES`] cumulative failures the webhook
//! is auto-disabled by [`WebhookRepository::record_attempt_outcome`].
//!
//! [`MAX_CONSECUTIVE_FAILURES`]: signapps_db::repositories::org::MAX_CONSECUTIVE_FAILURES

use std::sync::Arc;
use std::time::Duration;

use hmac::{Hmac, Mac};
use sha2::Sha256;
use signapps_common::pg_events::{PgEventBus, PlatformEvent};
use signapps_db::models::org::Webhook;
use signapps_db::repositories::org::WebhookRepository;
use signapps_db::DatabasePool;

/// Spawn the org-events dispatcher in the background.
///
/// One supervisor task that runs [`PgEventBus::listen`] under a stable
/// consumer name (`org-webhooks-dispatcher`). On each platform event it
/// forwards to [`dispatch_event`] which performs the fan-out.
pub fn spawn(pool: DatabasePool, event_bus: Arc<PgEventBus>) {
    let dispatcher_pool = pool.clone();
    let bus = event_bus.clone();
    tokio::spawn(async move {
        tracing::info!("org-webhooks dispatcher started");
        let consumer = "org-webhooks-dispatcher";
        let pool_for_handler = dispatcher_pool.clone();
        let result = bus
            .listen(consumer, move |evt: PlatformEvent| {
                let pool = pool_for_handler.clone();
                async move {
                    if let Err(e) = dispatch_event(&pool, evt).await {
                        tracing::warn!(?e, "org-webhooks dispatch failed");
                    }
                    Ok::<(), std::io::Error>(())
                }
            })
            .await;
        if let Err(e) = result {
            tracing::error!(?e, "org-webhooks dispatcher exited");
        }
    });
}

/// Filter + fan-out for one event. Public to enable unit-testing the
/// matching logic without going through the supervisor.
///
/// # Errors
///
/// Returns the underlying repository error.
pub async fn dispatch_event(pool: &DatabasePool, event: PlatformEvent) -> anyhow::Result<()> {
    if !is_org_topic(&event.event_type) {
        return Ok(());
    }
    let repo = WebhookRepository::new(pool.inner());
    let webhooks = repo.list_active_subscribed_to(&event.event_type).await?;
    if webhooks.is_empty() {
        return Ok(());
    }
    tracing::info!(
        event_type = %event.event_type,
        count = webhooks.len(),
        "fanning out org webhook event"
    );

    let payload = serde_json::json!({
        "event_type": event.event_type,
        "timestamp": event.created_at,
        "aggregate_id": event.aggregate_id,
        "data": event.payload,
    });

    for w in webhooks {
        let pool_clone = pool.clone();
        let payload_clone = payload.clone();
        tokio::spawn(async move {
            deliver_with_retry(pool_clone, w, payload_clone).await;
        });
    }
    Ok(())
}

/// Drive the 3-attempt exponential backoff for one webhook.
async fn deliver_with_retry(
    pool: DatabasePool,
    webhook: Webhook,
    payload: serde_json::Value,
) {
    const BACKOFF: [u64; 3] = [30, 2 * 60, 10 * 60];

    let event_type = payload
        .get("event_type")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();
    let body = serde_json::to_string(&payload).unwrap_or_else(|_| "{}".to_string());
    let signature = sign_hmac(&webhook.secret, body.as_bytes());

    let repo = WebhookRepository::new(pool.inner());
    let mut attempt: i32 = 0;

    loop {
        attempt += 1;
        let outcome = post_signed(&webhook.url, &body, &signature).await;
        let status_code: Option<i32> = outcome.as_ref().ok().map(|s| i32::from(*s));
        let succeeded = status_code.map_or(false, |s| (200..300).contains(&s));
        let error_message = outcome.as_ref().err().map(ToString::to_string);

        if let Err(e) = repo
            .record_delivery(
                webhook.id,
                &event_type,
                &payload,
                status_code,
                None,
                error_message.as_deref(),
                attempt,
            )
            .await
        {
            tracing::warn!(?e, "record_delivery failed");
        }

        if let Err(e) = repo
            .record_attempt_outcome(webhook.id, status_code, succeeded)
            .await
        {
            tracing::warn!(?e, "record_attempt_outcome failed");
        }

        if succeeded || attempt as usize >= BACKOFF.len() {
            return;
        }
        let delay = BACKOFF[(attempt as usize) - 1];
        tokio::time::sleep(Duration::from_secs(delay)).await;
    }
}

/// `true` for any event_type that should be considered for org webhooks.
#[must_use]
pub fn is_org_topic(event_type: &str) -> bool {
    event_type.starts_with("org.") || event_type == "test.webhook"
}

/// Compute hex-encoded HMAC-SHA256(secret, body).
#[must_use]
pub fn sign_hmac(secret: &str, body: &[u8]) -> String {
    type HmacSha256 = Hmac<Sha256>;
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .expect("HMAC accepts any key size");
    mac.update(body);
    let bytes = mac.finalize().into_bytes();
    hex_encode(&bytes)
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push(HEX[(b >> 4) as usize] as char);
        out.push(HEX[(b & 0x0F) as usize] as char);
    }
    out
}

/// Send a POST and return the HTTP status. Body is sent as-is, the
/// caller has already pre-serialized the JSON.
async fn post_signed(url: &str, body: &str, signature: &str) -> Result<u16, reqwest::Error> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()?;
    let resp = client
        .post(url)
        .header("Content-Type", "application/json")
        .header("X-SignApps-Signature", format!("sha256={signature}"))
        .body(body.to_string())
        .send()
        .await?;
    Ok(resp.status().as_u16())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_org_topic_filters_correctly() {
        assert!(is_org_topic("org.person.created"));
        assert!(is_org_topic("org.node.updated"));
        assert!(is_org_topic("test.webhook"));
        assert!(!is_org_topic("calendar.event.created"));
        assert!(!is_org_topic(""));
    }

    #[test]
    fn hex_encode_round_trip_known_vector() {
        let bytes = [0xDE, 0xAD, 0xBE, 0xEF];
        assert_eq!(hex_encode(&bytes), "deadbeef");
    }

    #[test]
    fn sign_hmac_known_vector() {
        // RFC 4231 test case 1.
        let key = "key";
        let body = b"The quick brown fox jumps over the lazy dog";
        let sig = sign_hmac(key, body);
        // Expected: f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8
        assert_eq!(
            sig,
            "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8"
        );
    }
}
