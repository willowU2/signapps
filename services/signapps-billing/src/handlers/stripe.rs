//! Stripe integration handlers — EX3.

use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{AppState, Invoice};
use signapps_common::pg_events::NewEvent;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/// Request body for creating a Stripe Checkout session.
#[derive(Debug, Deserialize)]
pub struct StripeCheckoutRequest {
    pub invoice_id: Uuid,
    pub success_url: Option<String>,
    pub cancel_url: Option<String>,
}

/// Response after creating a Stripe Checkout session.
#[derive(Debug, Serialize)]
pub struct StripeCheckoutResponse {
    pub checkout_url: String,
    pub session_id: String,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// Create a Stripe Checkout session for an invoice.
///
/// Requires `STRIPE_SECRET_KEY` in environment.
pub async fn create_stripe_checkout(
    State(state): State<AppState>,
    Json(payload): Json<StripeCheckoutRequest>,
) -> Result<Json<StripeCheckoutResponse>, (StatusCode, String)> {
    let stripe_key = std::env::var("STRIPE_SECRET_KEY").map_err(|_| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "STRIPE_SECRET_KEY not configured".to_string(),
        )
    })?;

    let invoice = sqlx::query_as::<_, Invoice>("SELECT * FROM billing.invoices WHERE id = $1")
        .bind(payload.invoice_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Invoice not found".to_string()))?;

    let success_url = payload
        .success_url
        .unwrap_or_else(|| "https://app.signapps.io/billing?payment=success".to_string());
    let cancel_url = payload
        .cancel_url
        .unwrap_or_else(|| "https://app.signapps.io/billing?payment=cancelled".to_string());

    let client = reqwest::Client::new();
    let invoice_id_str = invoice.id.to_string();
    let amount_str = invoice.amount_cents.to_string();
    let currency_lower = invoice.currency.to_lowercase();
    let name = format!("Facture {}", invoice.number);

    let params = vec![
        ("mode", "payment"),
        ("currency", currency_lower.as_str()),
        ("success_url", success_url.as_str()),
        ("cancel_url", cancel_url.as_str()),
        ("metadata[invoice_id]", invoice_id_str.as_str()),
        ("metadata[invoice_number]", invoice.number.as_str()),
        (
            "line_items[0][price_data][currency]",
            currency_lower.as_str(),
        ),
        (
            "line_items[0][price_data][unit_amount]",
            amount_str.as_str(),
        ),
        (
            "line_items[0][price_data][product_data][name]",
            name.as_str(),
        ),
        ("line_items[0][quantity]", "1"),
    ];

    let resp = client
        .post("https://api.stripe.com/v1/checkout/sessions")
        .basic_auth(&stripe_key, Option::<&str>::None)
        .form(&params)
        .send()
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_GATEWAY,
                format!("Stripe request failed: {e}"),
            )
        })?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        tracing::error!(stripe_error = %body, "Stripe checkout creation failed");
        return Err((StatusCode::BAD_GATEWAY, format!("Stripe error: {body}")));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))?;

    let checkout_url = json["url"]
        .as_str()
        .ok_or_else(|| {
            (
                StatusCode::BAD_GATEWAY,
                "Missing url in Stripe response".to_string(),
            )
        })?
        .to_string();
    let session_id = json["id"]
        .as_str()
        .ok_or_else(|| {
            (
                StatusCode::BAD_GATEWAY,
                "Missing id in Stripe response".to_string(),
            )
        })?
        .to_string();

    tracing::info!(invoice_id = %payload.invoice_id, session_id = %session_id, "Stripe checkout session created");

    Ok(Json(StripeCheckoutResponse {
        checkout_url,
        session_id,
    }))
}

/// Handle incoming Stripe webhook events.
///
/// Requires `STRIPE_WEBHOOK_SECRET` for HMAC-SHA256 signature verification.
/// Publishes `billing.invoice.paid` on `payment_intent.succeeded`.
pub async fn stripe_webhook(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    body: axum::body::Bytes,
) -> Result<StatusCode, (StatusCode, String)> {
    let webhook_secret = std::env::var("STRIPE_WEBHOOK_SECRET").unwrap_or_default();

    if !webhook_secret.is_empty() {
        let sig_header = headers
            .get("stripe-signature")
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| {
                (
                    StatusCode::BAD_REQUEST,
                    "Missing Stripe-Signature header".to_string(),
                )
            })?;

        verify_stripe_signature(&body, sig_header, &webhook_secret).map_err(|e| {
            tracing::warn!("Stripe signature verification failed: {}", e);
            (StatusCode::BAD_REQUEST, e.to_string())
        })?;
    }

    let event: serde_json::Value =
        serde_json::from_slice(&body).map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    let event_type = event["type"].as_str().unwrap_or("");

    if event_type == "payment_intent.succeeded" {
        let invoice_id = event["data"]["object"]["metadata"]["invoice_id"]
            .as_str()
            .and_then(|s| s.parse::<Uuid>().ok());

        if let Some(id) = invoice_id {
            let _ = sqlx::query(
                "UPDATE billing.invoices SET status = 'paid', paid_at = NOW() WHERE id = $1",
            )
            .bind(id)
            .execute(&state.pool)
            .await;

            let _ = state
                .event_bus
                .publish(NewEvent {
                    event_type: "billing.invoice.paid".into(),
                    aggregate_id: Some(id),
                    payload: serde_json::json!({ "source": "stripe", "stripe_event": event_type }),
                })
                .await;

            tracing::info!(invoice_id = %id, "Invoice marked paid via Stripe webhook");
        }
    }

    Ok(StatusCode::OK)
}

/// Verify a Stripe webhook HMAC-SHA256 signature with replay-attack protection.
pub fn verify_stripe_signature(
    payload: &[u8],
    sig_header: &str,
    secret: &str,
) -> anyhow::Result<()> {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;

    let mut timestamp: Option<&str> = None;
    let mut sig: Option<&str> = None;
    for part in sig_header.split(',') {
        if let Some(v) = part.strip_prefix("t=") {
            timestamp = Some(v);
        } else if let Some(v) = part.strip_prefix("v1=") {
            sig = Some(v);
        }
    }

    let ts = timestamp.ok_or_else(|| anyhow::anyhow!("Missing timestamp in Stripe-Signature"))?;
    let expected = sig.ok_or_else(|| anyhow::anyhow!("Missing v1 signature"))?;

    let ts_secs: i64 = ts.parse()?;
    let now = chrono::Utc::now().timestamp();
    if (now - ts_secs).abs() > 300 {
        anyhow::bail!("Stripe webhook timestamp too old (replay attack?)");
    }

    let signed_payload = format!("{}.{}", ts, String::from_utf8_lossy(payload));
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes())?;
    mac.update(signed_payload.as_bytes());
    let computed = hex::encode(mac.finalize().into_bytes());

    if computed != expected {
        anyhow::bail!("Stripe signature mismatch");
    }
    Ok(())
}
