//! SignApps Billing Service
//! Plans, invoices, line items and payments management — AQ-BILLDB

use axum::{
    extract::{Path, State},
    http::StatusCode,
    middleware,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::bootstrap::{env_or, init_tracing, load_env};
use signapps_common::middleware::{auth_middleware, AuthState};
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
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

// ---------------------------------------------------------------------------
// Invoice handlers
// ---------------------------------------------------------------------------

async fn list_invoices(
    State(state): State<AppState>,
) -> Result<Json<Vec<Invoice>>, (StatusCode, String)> {
    let invoices =
        sqlx::query_as::<_, Invoice>("SELECT * FROM billing.invoices ORDER BY created_at DESC")
            .fetch_all(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to list invoices: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
            })?;

    Ok(Json(invoices))
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
    Ok((StatusCode::CREATED, Json(invoice)))
}

async fn get_invoice(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Invoice>, (StatusCode, String)> {
    let invoice = sqlx::query_as::<_, Invoice>("SELECT * FROM billing.invoices WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error fetching invoice {}: {}", id, e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Invoice not found".to_string()))?;

    Ok(Json(invoice))
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
        .route("/api/plans", get(list_plans));

    let protected_routes = Router::new()
        .route("/api/invoices", get(list_invoices).post(create_invoice))
        .route("/api/invoices/:id", get(get_invoice))
        // Line items — AQ-BILLDB
        .route(
            "/api/invoices/:id/line-items",
            get(list_line_items).post(create_line_item),
        )
        .route(
            "/api/invoices/:id/line-items/:item_id",
            axum::routing::delete(delete_line_item),
        )
        // Payments — AQ-BILLDB
        .route(
            "/api/invoices/:id/payments",
            get(list_payments).post(create_payment),
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
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| {
        tracing::warn!("JWT_SECRET not set, using insecure dev default");
        "dev_secret_change_in_production_32chars".to_string()
    });

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

    let state = AppState { pool, jwt_config };
    let app = create_router(state);

    let addr = format!("0.0.0.0:{}", port);
    tracing::info!("signapps-billing listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
