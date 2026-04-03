//! Invoice CRUD handlers.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{AppState, Invoice};
use signapps_common::pg_events::NewEvent;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/// Request payload for CreateInvoice operation.
#[derive(Debug, Deserialize)]
pub struct CreateInvoiceRequest {
    pub tenant_id: Option<Uuid>,
    pub plan_id: Option<Uuid>,
    pub number: Option<String>,
    #[serde(default)]
    pub amount_cents: i32,
    pub currency: Option<String>,
    pub due_at: Option<DateTime<Utc>>,
    pub metadata: Option<serde_json::Value>,
}

/// Patch request for invoice update.
#[derive(Debug, Deserialize)]
pub struct PatchInvoiceRequest {
    pub status: Option<String>,
    pub amount_cents: Option<i32>,
    pub currency: Option<String>,
    pub due_at: Option<DateTime<Utc>>,
    pub metadata: Option<serde_json::Value>,
}

/// Response payload for Invoice operation.
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
// Handlers
// ---------------------------------------------------------------------------

/// List all invoices ordered by creation date descending.
pub async fn list_invoices(
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

/// Create a new invoice and publish a billing event.
pub async fn create_invoice(
    State(state): State<AppState>,
    Json(payload): Json<CreateInvoiceRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let number = payload.number.unwrap_or_else(|| {
        let ts = chrono::Utc::now().format("%Y%m%d%H%M%S");
        format!("INV-{ts}")
    });

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
    .bind(&number)
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

/// Fetch a single invoice by its UUID.
pub async fn get_invoice(
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

/// Partially update an invoice's mutable fields.
pub async fn patch_invoice(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<PatchInvoiceRequest>,
) -> Result<Json<InvoiceResponse>, (StatusCode, String)> {
    sqlx::query(
        r#"UPDATE billing.invoices SET
            status      = COALESCE($2, status),
            amount_cents = COALESCE($3, amount_cents),
            currency    = COALESCE($4, currency),
            due_at      = COALESCE($5, due_at),
            metadata    = COALESCE($6, metadata)
           WHERE id = $1"#,
    )
    .bind(id)
    .bind(&payload.status)
    .bind(payload.amount_cents)
    .bind(&payload.currency)
    .bind(payload.due_at)
    .bind(&payload.metadata)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to patch invoice {}: {}", id, e);
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    let invoice = sqlx::query_as::<_, Invoice>("SELECT * FROM billing.invoices WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Invoice not found".to_string()))?;
    Ok(Json(InvoiceResponse::from(invoice)))
}

/// Delete an invoice (only draft invoices may be removed).
pub async fn delete_invoice(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Only allow deletion of draft invoices
    let invoice = sqlx::query_as::<_, Invoice>("SELECT * FROM billing.invoices WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Invoice not found".to_string()))?;

    if invoice.status != "draft" {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            "Only draft invoices can be deleted".to_string(),
        ));
    }

    sqlx::query("DELETE FROM billing.invoices WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete invoice {}: {}", id, e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?;

    tracing::info!(id = %id, "Invoice deleted");
    Ok(StatusCode::NO_CONTENT)
}
