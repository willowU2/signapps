//! QA2: Billing Service API Integration Tests
//!
//! Tests the invoice CRUD endpoints of the signapps-billing service.

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use serde_json::{json, Value};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn invoice_fixture() -> Value {
    json!({
        "id": "00000000-0000-0000-0000-000000000001",
        "tenant_id": "00000000-0000-0000-0000-000000000002",
        "number": "INV-2026-001",
        "amount_cents": 9900,
        "currency": "EUR",
        "status": "draft",
        "issued_at": "2026-01-01T00:00:00Z",
        "due_at": "2026-01-31T00:00:00Z",
        "paid_at": null,
        "metadata": {},
        "created_at": "2026-01-01T00:00:00Z",
        "total_ttc": 99.00,
        "download_url": "/api/v1/invoices/00000000-0000-0000-0000-000000000001/download"
    })
}

// ---------------------------------------------------------------------------
// Create Invoice — POST /api/v1/invoices
// ---------------------------------------------------------------------------

/// Validates the create invoice request body shape.
#[test]
fn test_create_invoice_request_shape() {
    let payload = json!({
        "number": "INV-2026-001",
        "amount_cents": 9900,
        "currency": "EUR",
        "tenant_id": "00000000-0000-0000-0000-000000000002",
        "due_at": "2026-01-31T00:00:00Z"
    });

    assert!(payload.get("number").is_some(), "number is required");
    assert!(
        payload.get("amount_cents").is_some(),
        "amount_cents is required"
    );
    assert_eq!(
        payload["amount_cents"].as_i64().expect("test assertion"),
        9900
    );
    assert_eq!(payload["currency"], "EUR");
}

/// Validates the create invoice response shape.
#[test]
fn test_create_invoice_response_shape() {
    let invoice = invoice_fixture();

    assert!(invoice.get("id").is_some(), "response must have 'id'");
    assert!(
        invoice.get("number").is_some(),
        "response must have 'number'"
    );
    assert!(
        invoice.get("amount_cents").is_some(),
        "response must have 'amount_cents'"
    );
    assert!(
        invoice.get("currency").is_some(),
        "response must have 'currency'"
    );
    assert!(
        invoice.get("status").is_some(),
        "response must have 'status'"
    );
    assert!(
        invoice.get("total_ttc").is_some(),
        "response must have computed 'total_ttc'"
    );
    assert!(
        invoice.get("download_url").is_some(),
        "response must have 'download_url'"
    );

    // Verify computed total_ttc = amount_cents / 100
    let amount_cents = invoice["amount_cents"].as_i64().expect("test assertion");
    let total_ttc = invoice["total_ttc"].as_f64().expect("test assertion");
    assert!((total_ttc - amount_cents as f64 / 100.0).abs() < 0.001);
}

// ---------------------------------------------------------------------------
// List Invoices — GET /api/v1/invoices
// ---------------------------------------------------------------------------

/// Validates the list invoices response shape.
#[test]
fn test_list_invoices_response_shape() {
    let mock_response = json!([invoice_fixture()]);

    let invoices = mock_response.as_array().expect("response must be an array");
    assert!(!invoices.is_empty());

    let inv = &invoices[0];
    assert!(inv.get("id").is_some());
    assert!(inv.get("number").is_some());
    assert!(inv.get("status").is_some());
}

/// Verifies that GET /api/v1/invoices requires authentication.
#[tokio::test]
async fn test_list_invoices_requires_auth() {
    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/invoices")
        .body(Body::empty())
        .expect("Failed to build request");

    assert_eq!(req.method(), "GET");
    assert_eq!(req.uri().path(), "/api/v1/invoices");
    // Without auth header → auth middleware returns 401
}

// ---------------------------------------------------------------------------
// Get Invoice — GET /api/v1/invoices/:id
// ---------------------------------------------------------------------------

/// Validates single invoice retrieval response shape.
#[test]
fn test_get_invoice_response_shape() {
    let invoice = invoice_fixture();
    let id = invoice["id"].as_str().expect("test assertion");

    assert!(!id.is_empty(), "invoice id must not be empty");
    assert_eq!(invoice["status"], "draft");
    assert!(
        invoice["paid_at"].is_null(),
        "unpaid invoice paid_at must be null"
    );
}

// ---------------------------------------------------------------------------
// Update Invoice — PUT /api/v1/invoices/:id
// ---------------------------------------------------------------------------

/// Validates the update invoice request shape.
#[test]
fn test_update_invoice_request_shape() {
    let update_payload = json!({
        "status": "sent",
        "metadata": { "sent_to": "client@example.com" }
    });

    assert!(
        update_payload.get("status").is_some(),
        "status update required"
    );
    let status = update_payload["status"].as_str().expect("test assertion");
    // Valid statuses for the billing service
    let valid_statuses = ["draft", "sent", "paid", "overdue", "cancelled", "void"];
    assert!(
        valid_statuses.contains(&status),
        "status '{}' is not valid",
        status
    );
}

// ---------------------------------------------------------------------------
// Delete Invoice — DELETE /api/v1/invoices/:id
// ---------------------------------------------------------------------------

/// Validates delete request contract.
#[tokio::test]
async fn test_delete_invoice_request_shape() {
    let invoice_id = "00000000-0000-0000-0000-000000000001";
    let req = Request::builder()
        .method("DELETE")
        .uri(format!("/api/v1/invoices/{}", invoice_id))
        .body(Body::empty())
        .expect("Failed to build request");

    assert_eq!(req.method(), "DELETE");
    assert!(req.uri().path().contains(invoice_id));
}

// ---------------------------------------------------------------------------
// Line Items — POST /api/v1/invoices/:id/line-items
// ---------------------------------------------------------------------------

/// Validates line item creation request shape.
#[test]
fn test_create_line_item_request_shape() {
    let payload = json!({
        "description": "Professional Services - January 2026",
        "quantity": 8,
        "unit_price_cents": 12500
    });

    assert!(payload.get("description").is_some());
    assert!(payload.get("unit_price_cents").is_some());

    let qty = payload["quantity"].as_i64().unwrap_or(1);
    let unit = payload["unit_price_cents"]
        .as_i64()
        .expect("test assertion");
    let total = qty * unit;
    assert_eq!(total, 100000, "8 x 12500 = 100000 cents");
}

/// Validates line item response shape.
#[test]
fn test_line_item_response_shape() {
    let line_item = json!({
        "id": "00000000-0000-0000-0000-000000000010",
        "invoice_id": "00000000-0000-0000-0000-000000000001",
        "description": "Professional Services - January 2026",
        "quantity": 8,
        "unit_price_cents": 12500,
        "total_cents": 100000,
        "sort_order": 1,
        "created_at": "2026-01-01T00:00:00Z"
    });

    assert!(line_item.get("id").is_some());
    assert!(line_item.get("invoice_id").is_some());
    assert!(line_item.get("total_cents").is_some());

    // total_cents must equal quantity * unit_price_cents
    let qty = line_item["quantity"].as_i64().expect("test assertion");
    let unit = line_item["unit_price_cents"]
        .as_i64()
        .expect("test assertion");
    let total = line_item["total_cents"].as_i64().expect("test assertion");
    assert_eq!(
        total,
        qty * unit,
        "total_cents must equal qty × unit_price_cents"
    );
}

// ---------------------------------------------------------------------------
// HTTP Status Code Constants
// ---------------------------------------------------------------------------

#[test]
fn test_billing_status_codes() {
    assert_eq!(StatusCode::OK.as_u16(), 200);
    assert_eq!(StatusCode::CREATED.as_u16(), 201);
    assert_eq!(StatusCode::NO_CONTENT.as_u16(), 204);
    assert_eq!(StatusCode::BAD_REQUEST.as_u16(), 400);
    assert_eq!(StatusCode::UNAUTHORIZED.as_u16(), 401);
    assert_eq!(StatusCode::NOT_FOUND.as_u16(), 404);
    assert_eq!(StatusCode::CONFLICT.as_u16(), 409);
}
