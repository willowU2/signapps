//! SignApps Billing Service
//! Plans, invoices, line items and payments management — AQ-BILLDB

mod handlers;

use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::bootstrap::{env_or, init_tracing, load_env};
use signapps_common::middleware::{auth_middleware, tenant_context_middleware, AuthState};
use signapps_common::pg_events::PgEventBus;
use signapps_common::JwtConfig;
use sqlx::{postgres::PgPoolOptions, FromRow, Pool, Postgres};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/// Represents a plan.
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

/// Represents an invoice.
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

/// Represents a line item.
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

/// Represents a payment.
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
// Application state
// ---------------------------------------------------------------------------

/// Application state for the billing service.
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
// Router
// ---------------------------------------------------------------------------

fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            "http://localhost:3000".parse().expect("valid origin"),
            "http://127.0.0.1:3000".parse().expect("valid origin"),
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
        .route("/health", get(handlers::health::health))
        // EX3: Stripe webhook (unauthenticated — verified by HMAC signature)
        .route(
            "/api/v1/billing/stripe/webhook",
            post(handlers::stripe::stripe_webhook),
        )
        .merge(signapps_common::version::router("signapps-billing"));

    let protected_routes = Router::new()
        .route(
            "/api/v1/plans",
            get(handlers::plans::list_plans).post(handlers::plans::create_plan),
        )
        .route(
            "/api/v1/plans/:id",
            axum::routing::put(handlers::plans::update_plan)
                .delete(handlers::plans::delete_plan),
        )
        .route(
            "/api/v1/invoices",
            get(handlers::invoices::list_invoices).post(handlers::invoices::create_invoice),
        )
        .route(
            "/api/v1/invoices/:id",
            get(handlers::invoices::get_invoice)
                .patch(handlers::invoices::patch_invoice)
                .delete(handlers::invoices::delete_invoice),
        )
        // Usage endpoint (SYNC-BILLING-PREFIX)
        .route("/api/v1/usage", get(handlers::usage::get_usage))
        // Line items — AQ-BILLDB
        .route(
            "/api/v1/invoices/:id/line-items",
            get(handlers::line_items::list_line_items)
                .post(handlers::line_items::create_line_item),
        )
        .route(
            "/api/v1/invoices/:id/line-items/:item_id",
            axum::routing::delete(handlers::line_items::delete_line_item),
        )
        // Payments — AQ-BILLDB
        .route(
            "/api/v1/invoices/:id/payments",
            get(handlers::payments::list_payments).post(handlers::payments::create_payment),
        )
        // EX3: Stripe Checkout session creation (requires auth)
        .route(
            "/api/v1/billing/stripe/checkout",
            post(handlers::stripe::create_stripe_checkout),
        )
        // Accounting — chart of accounts, journal entries, reports, seed
        // (moved from signapps-identity — Refactor 34 Phase 3)
        .route(
            "/api/v1/accounting/accounts",
            get(handlers::accounting::list_accounts).post(handlers::accounting::create_account),
        )
        .route(
            "/api/v1/accounting/accounts/:id",
            get(handlers::accounting::get_account)
                .put(handlers::accounting::update_account)
                .delete(handlers::accounting::delete_account),
        )
        .route(
            "/api/v1/accounting/entries",
            get(handlers::accounting::list_entries).post(handlers::accounting::create_entry),
        )
        .route(
            "/api/v1/accounting/entries/:id/post",
            post(handlers::accounting::post_entry),
        )
        .route(
            "/api/v1/accounting/reports",
            get(handlers::accounting::get_reports),
        )
        .route(
            "/api/v1/accounting/reports/balance-sheet",
            get(handlers::accounting::get_balance_sheet),
        )
        .route(
            "/api/v1/accounting/reports/profit-loss",
            get(handlers::accounting::get_profit_loss),
        )
        .route(
            "/api/v1/accounting/reports/trial-balance",
            get(handlers::accounting::get_trial_balance),
        )
        .route(
            "/api/v1/accounting/seed",
            post(handlers::accounting::seed_default_coa),
        )
        .route_layer(middleware::from_fn(tenant_context_middleware))
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

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing("signapps_billing");
    load_env();

    let port: u16 = env_or("SERVER_PORT", "8096").parse().unwrap_or(8096);
    let database_url = env_or(
        "DATABASE_URL",
        "postgres://signapps:password@localhost:5432/signapps",
    );
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;
    tracing::info!("Database connected");

    // JWT config — auto-detects RS256 or HS256 from environment
    let jwt_config = JwtConfig::from_env();

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
                Box::pin(async move { handlers::events::handle_cross_event(&p, event).await })
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
