//! SignApps Billing Service
//! Plans, invoices, line items and payments management — AQ-BILLDB

use axum::{
    extract::{Path, State},
    http::StatusCode,
    middleware,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::bootstrap::{env_or, init_tracing, load_env};
use signapps_common::middleware::{auth_middleware, AuthState};
use signapps_common::pg_events::{NewEvent, PgEventBus, PlatformEvent};
use signapps_common::JwtConfig;
use sqlx::{postgres::PgPoolOptions, FromRow, Pool, Postgres};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Plan {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub price_cents: i32,
    pub currency: String,
    pub features: serde_json::Value,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Invoice {
    pub id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub plan_id: Option<Uuid>,
    pub number: String,
    pub amount_cents: i32,
    pub currency: String,
    pub status: String,
    pub issued_at: DateTime<Utc>,
    pub due_at: Option<DateTime<Utc>>,
    pub paid_at: Option<DateTime<Utc>>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LineItem {
    pub id: Uuid,
    pub invoice_id: Uuid,
    pub description: String,
    pub quantity: i32,
    pub unit_price_cents: i32,
    pub total_cents: i32,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Payment {
    pub id: Uuid,
    pub invoice_id: Uuid,
    pub amount_cents: i32,
    pub currency: String,
    pub method: String,
    pub reference: Option<String>,
    pub paid_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Request DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CreateInvoiceRequest {
    pub tenant_id: Option<Uuid>,
    pub plan_id: Option<Uuid>,
    pub number: String,
    pub amount_cents: i32,
    pub currency: Option<String>,
    pub due_at: Option<DateTime<Utc>>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLineItemRequest {
    pub description: String,
    pub quantity: Option<i32>,
    pub unit_price_cents: i32,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePaymentRequest {
    pub amount_cents: i32,
    pub currency: Option<String>,
    pub method: Option<String>,
    pub reference: Option<String>,
    pub paid_at: Option<DateTime<Utc>>,
}

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------

#[derive(Clone)]
pub struct AppState {
    pub pool: Pool<Postgres>,
    pub jwt_config: JwtConfig,
    pub event_bus: PgEventBus,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

// ---------------------------------------------------------------------------
// Response DTOs with computed fields (SYNC-BILLING-TYPES)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct InvoiceResponse {
    pub id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub plan_id: Option<Uuid>,
    pub number: String,
    // Raw fields
    pub amount_cents: i32,
    pub currency: String,
    pub status: String,
    pub issued_at: DateTime<Utc>,
    pub due_at: Option<DateTime<Utc>>,
    pub paid_at: Option<DateTime<Utc>>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    // Computed aliases for frontend compatibility
    pub client_name: Option<String>,
    pub total_ttc: f64,
    pub due_date: Option<DateTime<Utc>>,
    pub download_url: Option<String>,
}

impl From<Invoice> for InvoiceResponse {
    fn from(inv: Invoice) -> Self {
        let total_ttc = inv.amount_cents as f64 / 100.0;
        let client_name = inv
            .metadata
            .get("client_name")
            .and_then(|v| v.as_str())
            .map(String::from);
        let download_url = Some(format!("/api/v1/invoices/{}/download", inv.id));
        InvoiceResponse {
            id: inv.id,
            tenant_id: inv.tenant_id,
            plan_id: inv.plan_id,
            number: inv.number,
            amount_cents: inv.amount_cents,
            currency: inv.currency,
            status: inv.status,
            issued_at: inv.issued_at,
            due_at: inv.due_at,
            paid_at: inv.paid_at,
            metadata: inv.metadata,
            created_at: inv.created_at,
            client_name,
            total_ttc,
            due_date: inv.due_at,
            download_url,
        }
    }
}

// ---------------------------------------------------------------------------
// Usage response (SYNC-BILLING-PREFIX / SYNC-BILLING-TYPES)
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct UsageResponse {
    pub storage_used_bytes: i64,
    pub storage_limit_bytes: i64,
    pub api_calls_this_month: i64,
    pub api_calls_limit: i64,
    pub active_users: i64,
    pub user_limit: i64,
}

async fn get_usage(
    State(state): State<AppState>,
) -> Result<Json<UsageResponse>, (StatusCode, String)> {
    // Query aggregated usage from billing metadata / plans
    let storage_row = sqlx::query_scalar::<_, i64>(
        "SELECT COALESCE(SUM((metadata->>'storage_bytes')::bigint), 0) FROM billing.invoices WHERE status != 'draft'"
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let api_calls_row = sqlx::query_scalar::<_, i64>(
        "SELECT COALESCE(SUM((metadata->>'api_calls')::bigint), 0) FROM billing.invoices \
         WHERE issued_at >= date_trunc('month', now())",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let active_users_row = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(DISTINCT tenant_id) FROM billing.invoices WHERE status = 'paid'",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    Ok(Json(UsageResponse {
        storage_used_bytes: storage_row,
        storage_limit_bytes: 107_374_182_400, // 100 GB default
        api_calls_this_month: api_calls_row,
        api_calls_limit: 1_000_000,
        active_users: active_users_row,
        user_limit: 100,
    }))
}

// ---------------------------------------------------------------------------
// Invoice handlers
// ---------------------------------------------------------------------------

async fn list_invoices(
    State(state): State<AppState>,
) -> Result<Json<Vec<InvoiceResponse>>, (StatusCode, String)> {
    let invoices =
        sqlx::query_as::<_, Invoice>("SELECT * FROM billing.invoices ORDER BY created_at DESC")
            .fetch_all(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to list invoices: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
            })?;

    Ok(Json(
        invoices.into_iter().map(InvoiceResponse::from).collect(),
    ))
}

async fn create_invoice(
    State(state): State<AppState>,
    Json(payload): Json<CreateInvoiceRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let invoice = sqlx::query_as::<_, Invoice>(
        r#"
        INSERT INTO billing.invoices
            (tenant_id, plan_id, number, amount_cents, currency, due_at, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        "#,
    )
    .bind(payload.tenant_id)
    .bind(payload.plan_id)
    .bind(&payload.number)
    .bind(payload.amount_cents)
    .bind(payload.currency.as_deref().unwrap_or("EUR"))
    .bind(payload.due_at)
    .bind(payload.metadata.unwrap_or(serde_json::json!({})))
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create invoice: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    tracing::info!(id = %invoice.id, number = %invoice.number, "Invoice created");
    let _ = state
        .event_bus
        .publish(NewEvent {
            event_type: "billing.invoice.created".into(),
            aggregate_id: Some(invoice.id),
            payload: serde_json::json!({
                "number": invoice.number,
                "amount_cents": invoice.amount_cents,
                "currency": invoice.currency,
            }),
        })
        .await;
    Ok((StatusCode::CREATED, Json(InvoiceResponse::from(invoice))))
}

async fn get_invoice(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<InvoiceResponse>, (StatusCode, String)> {
    let invoice = sqlx::query_as::<_, Invoice>("SELECT * FROM billing.invoices WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error fetching invoice {}: {}", id, e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Invoice not found".to_string()))?;

    Ok(Json(InvoiceResponse::from(invoice)))
}

/// Patch request for invoice status update
#[derive(Debug, Deserialize)]
pub struct PatchInvoiceRequest {
    pub status: Option<String>,
}

async fn patch_invoice(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<PatchInvoiceRequest>,
) -> Result<Json<InvoiceResponse>, (StatusCode, String)> {
    if let Some(status) = payload.status {
        sqlx::query("UPDATE billing.invoices SET status = $1 WHERE id = $2")
            .bind(&status)
            .bind(id)
            .execute(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to patch invoice {}: {}", id, e);
                (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
            })?;
    }
    let invoice = sqlx::query_as::<_, Invoice>("SELECT * FROM billing.invoices WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Invoice not found".to_string()))?;
    Ok(Json(InvoiceResponse::from(invoice)))
}

async fn list_plans(
    State(state): State<AppState>,
) -> Result<Json<Vec<Plan>>, (StatusCode, String)> {
    let plans = sqlx::query_as::<_, Plan>(
        "SELECT * FROM billing.plans WHERE is_active = true ORDER BY price_cents ASC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list plans: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    Ok(Json(plans))
}

// ---------------------------------------------------------------------------
// Line item handlers — AQ-BILLDB
// ---------------------------------------------------------------------------

async fn list_line_items(
    State(state): State<AppState>,
    Path(invoice_id): Path<Uuid>,
) -> Result<Json<Vec<LineItem>>, (StatusCode, String)> {
    let items = sqlx::query_as::<_, LineItem>(
        "SELECT * FROM billing.line_items WHERE invoice_id = $1 ORDER BY sort_order, created_at",
    )
    .bind(invoice_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(items))
}

async fn create_line_item(
    State(state): State<AppState>,
    Path(invoice_id): Path<Uuid>,
    Json(payload): Json<CreateLineItemRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let qty = payload.quantity.unwrap_or(1);
    let total = qty * payload.unit_price_cents;
    let item = sqlx::query_as::<_, LineItem>(
        r#"INSERT INTO billing.line_items (invoice_id, description, quantity, unit_price_cents, total_cents, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *"#,
    )
    .bind(invoice_id)
    .bind(&payload.description)
    .bind(qty)
    .bind(payload.unit_price_cents)
    .bind(total)
    .bind(payload.sort_order.unwrap_or(0))
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok((StatusCode::CREATED, Json(item)))
}

async fn delete_line_item(
    State(state): State<AppState>,
    Path((_invoice_id, item_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let r = sqlx::query("DELETE FROM billing.line_items WHERE id = $1")
        .bind(item_id)
        .execute(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if r.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Line item not found".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// Payment handlers — AQ-BILLDB
// ---------------------------------------------------------------------------

async fn list_payments(
    State(state): State<AppState>,
    Path(invoice_id): Path<Uuid>,
) -> Result<Json<Vec<Payment>>, (StatusCode, String)> {
    let payments = sqlx::query_as::<_, Payment>(
        "SELECT * FROM billing.payments WHERE invoice_id = $1 ORDER BY paid_at DESC",
    )
    .bind(invoice_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(payments))
}

async fn create_payment(
    State(state): State<AppState>,
    Path(invoice_id): Path<Uuid>,
    Json(payload): Json<CreatePaymentRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let payment = sqlx::query_as::<_, Payment>(
        r#"INSERT INTO billing.payments (invoice_id, amount_cents, currency, method, reference, paid_at)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *"#,
    )
    .bind(invoice_id)
    .bind(payload.amount_cents)
    .bind(payload.currency.as_deref().unwrap_or("EUR"))
    .bind(payload.method.as_deref().unwrap_or("bank_transfer"))
    .bind(&payload.reference)
    .bind(payload.paid_at.unwrap_or_else(Utc::now))
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Auto-mark invoice as paid when fully covered
    let _ = sqlx::query(
        r#"UPDATE billing.invoices
           SET status = 'paid', paid_at = NOW()
           WHERE id = $1 AND amount_cents <= (
               SELECT COALESCE(SUM(amount_cents), 0) FROM billing.payments WHERE invoice_id = $1
           ) AND status != 'paid'"#,
    )
    .bind(invoice_id)
    .execute(&state.pool)
    .await;

    Ok((StatusCode::CREATED, Json(payment)))
}

async fn health() -> impl IntoResponse {
    Json(serde_json::json!({ "status": "ok" }))
}

// ---------------------------------------------------------------------------
// Stripe integration — EX3
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

/// Create a Stripe Checkout session for an invoice.
///
/// Requires `STRIPE_SECRET_KEY` in environment.
async fn create_stripe_checkout(
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
async fn stripe_webhook(
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
                .publish(signapps_common::pg_events::NewEvent {
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
fn verify_stripe_signature(payload: &[u8], sig_header: &str, secret: &str) -> anyhow::Result<()> {
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

/// Handle cross-service events received by the billing service.
async fn handle_cross_event(
    pool: &Pool<Postgres>,
    event: PlatformEvent,
) -> Result<(), sqlx::Error> {
    if event.event_type.as_str() == "crm.deal.won" {
        let amount = event.payload["amount"].as_i64().unwrap_or(0) as i32;
        let contact_id = event.payload["contact_id"]
            .as_str()
            .and_then(|s| s.parse::<Uuid>().ok());
        // Generate a unique invoice number from the deal id (first 8 chars)
        let deal_short = event
            .aggregate_id
            .map(|id| id.to_string().replace('-', "")[..8].to_string())
            .unwrap_or_else(|| "DEAL0000".to_string());
        let number = format!("AUTO-{}", deal_short.to_uppercase());
        sqlx::query(
            "INSERT INTO billing.invoices \
                 (tenant_id, number, amount_cents, currency, status, metadata) \
                 VALUES ($1, $2, $3, 'EUR', 'draft', $4)",
        )
        .bind(event.aggregate_id) // use aggregate_id as tenant proxy
        .bind(&number)
        .bind(amount)
        .bind(serde_json::json!({
            "deal_id": event.aggregate_id.map(|id| id.to_string()),
            "contact_id": contact_id,
            "auto_generated": true
        }))
        .execute(pool)
        .await?;
        tracing::info!(
            deal_id = %event.aggregate_id.map(|id| id.to_string()).unwrap_or_default(),
            amount = amount,
            "Auto-created draft invoice from won deal"
        );
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            "http://localhost:3000".parse().unwrap(),
            "http://127.0.0.1:3000".parse().unwrap(),
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
        .route("/api/v1/plans", get(list_plans))
        // EX3: Stripe webhook (unauthenticated — verified by HMAC signature)
        .route("/api/v1/billing/stripe/webhook", post(stripe_webhook));

    let protected_routes = Router::new()
        .route("/api/v1/invoices", get(list_invoices).post(create_invoice))
        .route("/api/v1/invoices/:id", get(get_invoice).patch(patch_invoice))
        // Usage endpoint (SYNC-BILLING-PREFIX)
        .route("/api/v1/usage", get(get_usage))
        // Line items — AQ-BILLDB
        .route(
            "/api/v1/invoices/:id/line-items",
            get(list_line_items).post(create_line_item),
        )
        .route(
            "/api/v1/invoices/:id/line-items/:item_id",
            axum::routing::delete(delete_line_item),
        )
        // Payments — AQ-BILLDB
        .route(
            "/api/v1/invoices/:id/payments",
            get(list_payments).post(create_payment),
        )
        // EX3: Stripe Checkout session creation (requires auth)
        .route(
            "/api/v1/billing/stripe/checkout",
            post(create_stripe_checkout),
        )
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    public_routes
        .merge(protected_routes)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing("signapps_billing");
    load_env();

    let port: u16 = env_or("SERVER_PORT", "8096").parse().unwrap_or(8096);
    let database_url = env_or(
        "DATABASE_URL",
        "postgres://signapps:password@localhost:5432/signapps",
    );
    let jwt_secret = std::env::var("JWT_SECRET")
        .expect("JWT_SECRET environment variable must be set (minimum 32 characters)");
    assert!(
        jwt_secret.len() >= 32,
        "JWT_SECRET must be at least 32 characters long"
    );

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;
    tracing::info!("Database connected");

    let jwt_config = JwtConfig {
        secret: jwt_secret,
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
        access_expiration: 900,
        refresh_expiration: 604800,
    };

    let event_bus = PgEventBus::new(pool.clone(), "signapps-billing".to_string());

    // Spawn cross-service event listener (crm.deal.won → auto-create draft invoice)
    let billing_listener_pool = pool.clone();
    let billing_bus = PgEventBus::new(
        billing_listener_pool.clone(),
        "signapps-billing".to_string(),
    );
    tokio::spawn(async move {
        if let Err(e) = billing_bus
            .listen("billing-consumer", move |event| {
                let p = billing_listener_pool.clone();
                Box::pin(async move { handle_cross_event(&p, event).await })
            })
            .await
        {
            tracing::error!("Billing event listener crashed: {}", e);
        }
    });

    let state = AppState {
        pool,
        jwt_config,
        event_bus,
    };
    let app = create_router(state);

    let addr = format!("0.0.0.0:{}", port);
    tracing::info!("signapps-billing listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(signapps_common::graceful_shutdown())
        .await?;

    Ok(())
}
