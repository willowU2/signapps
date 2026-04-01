//! Invoice payment handlers — AQ-BILLDB.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use uuid::Uuid;

use crate::{AppState, Payment};

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/// Request payload for CreatePayment operation.
#[derive(Debug, Deserialize)]
pub struct CreatePaymentRequest {
    pub amount_cents: i32,
    pub currency: Option<String>,
    pub method: Option<String>,
    pub reference: Option<String>,
    pub paid_at: Option<DateTime<Utc>>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// List all payments recorded against an invoice.
pub async fn list_payments(
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

/// Record a payment against an invoice and auto-mark it paid when fully covered.
pub async fn create_payment(
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
