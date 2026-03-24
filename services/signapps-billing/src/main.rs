use axum::{routing::get, Json, Router};
use serde::Serialize;

#[derive(Serialize)]
struct Invoice {
    id: String,
    number: String,
    client_name: String,
    items: Vec<InvoiceItem>,
    total_ht: f64,
    tva_rate: f64,
    total_ttc: f64,
    status: String,
    created_at: String,
    due_date: String,
}

#[derive(Serialize)]
struct InvoiceItem {
    description: String,
    quantity: f64,
    unit_price: f64,
    total: f64,
}

#[derive(Serialize)]
struct InvoiceListResponse {
    invoices: Vec<Invoice>,
    total_count: u32,
}

async fn list_invoices() -> Json<InvoiceListResponse> {
    Json(InvoiceListResponse {
        invoices: vec![],
        total_count: 0,
    })
}

async fn health() -> &'static str {
    "OK"
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/api/invoices", get(list_invoices))
        .route("/health", get(health));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8096").await.unwrap();
    println!("signapps-billing listening on :8096");
    axum::serve(listener, app).await.unwrap();
}
